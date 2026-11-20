const ytSearch = require("yt-search");

const MAX_RESULTS = 10;          // সাধারণ ভিডিও সার্চে ডিফল্ট কয়টা
const MAX_VIDEO_LIMIT = 30;      // সাধারণ ভিডিও সার্চে সর্বোচ্চ
const DEFAULT_SHORTS = 30;       // Shorts সার্চে ডিফল্ট কয়টা
const MAX_SHORTS = 60;           // Shorts সার্চে সর্বোচ্চ কয়টা
const MAX_PAGES = 8;             // YouTube এর কয় পাতা পর্যন্ত যাবে (পরের পাতা = আরও Shorts)
const MAX_QUERY_LENGTH = 180;
const MAX_SHORT_DURATION = 180;  // ফলব্যাক সার্চে Shorts ধরার সর্বোচ্চ সময় (সেকেন্ড)
const SESSION_MAX_AGE = 6 * 60 * 60 * 1000; // ৬ ঘণ্টা পর YouTube সেশন নতুন করে বানানো

/* ══════════════════════════════════════════════════════════════
   🔌 YouTube এর নিজস্ব (InnerTube) সংযোগ
   ══════════════════════════════════════════════════════════════ */
let factory = async () => {
	// youtubei.js নতুন ভার্সনে ESM, তাই dynamic import (CommonJS থেকেও চলে)
	const { Innertube } = await import("youtubei.js");
	return Innertube.create({ retrieve_player: false });
};

let session = null; // { promise, createdAt }

function getYt() {
	if (!session || Date.now() - session.createdAt > SESSION_MAX_AGE) {
		const promise = factory();
		session = { promise, createdAt: Date.now() };
		promise.catch(() => { if (session && session.promise === promise) session = null; });
	}
	return session.promise;
}

// শুধু পরীক্ষার জন্য
function _setFactory(fn) {
	factory = fn;
	session = null;
}

/* ══════════════════════════════════════════════════════════════
   🧰 সাহায্যকারী ফাংশন
   ══════════════════════════════════════════════════════════════ */
function cleanQuery(query) {
	const q = String(query || "").trim().slice(0, MAX_QUERY_LENGTH);
	if (!q) throw new Error("Search query is required");
	return q;
}

function clamp(value, def, max) {
	const n = parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return def;
	return Math.min(n, max);
}

// YouTube এর Text অবজেক্ট বা সাধারণ লেখা থেকে লেখা বের করা
function txt(x) {
	if (x == null) return "";
	if (typeof x === "string") return x;
	if (typeof x.text === "string") return x.text;
	if (Array.isArray(x.runs)) return x.runs.map(r => (r && r.text) || "").join("");
	if (typeof x.content === "string") return x.content;
	return "";
}

function pickId(node) {
	const candidates = [
		node.video_id, node.videoId, node.id,
		node.on_tap_endpoint && node.on_tap_endpoint.payload && node.on_tap_endpoint.payload.videoId,
		node.on_tap && node.on_tap.payload && node.on_tap.payload.videoId,
		node.endpoint && node.endpoint.payload && node.endpoint.payload.videoId,
		node.content_id
	];
	return candidates.find(c => typeof c === "string" && /^[\w-]{11}$/.test(c)) || "";
}

function parseViews(text) {
	const m = String(text || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
	if (!m) return 0;
	const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
	return Math.round(parseFloat(m[1]) * mult) || 0;
}

function nodeType(node) {
	return String(node.type || (node.constructor && node.constructor.name) || "");
}

function isShortNode(node) {
	return /Reel|Shorts/i.test(nodeType(node));
}

function formatVideo(video, shorts = false) {
	const videoId = video.videoId || "";
	const seconds = Number(video.seconds || 0);

	return {
		title: video.title || "",
		videoId,
		url: shorts
			? `https://www.youtube.com/shorts/${videoId}`
			: `https://www.youtube.com/watch?v=${videoId}`,
		duration: video.duration || null,
		timestamp: video.timestamp || null,
		seconds,
		thumbnail: video.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
		author: (video.author && video.author.name) || (typeof video.author === "string" ? video.author : ""),
		views: Number(video.views || 0),
		ago: video.ago || null,
		published: video.ago || null
	};
}

// YouTube এর একটা Shorts নোড থেকে আমাদের ফরম্যাটে
function shortFromNode(node) {
	const id = pickId(node);
	if (!id) return null;

	const title =
		txt(node.title) ||
		txt(node.overlay_metadata && node.overlay_metadata.primary_text) ||
		txt(node.accessibility_text).replace(/,\s*[\d.,]+\s*[KMB]?\s*views.*$/i, "").trim() ||
		"";

	const viewsText =
		txt(node.views) ||
		txt(node.short_view_count) ||
		txt(node.overlay_metadata && node.overlay_metadata.secondary_text);

	const thumb = (node.thumbnails && node.thumbnails[0] && node.thumbnails[0].url) ||
		(node.thumbnail && node.thumbnail[0] && node.thumbnail[0].url) || "";

	const seconds = Number(node.duration && node.duration.seconds) || 0;

	return formatVideo({
		title,
		videoId: id,
		seconds,
		duration: (node.duration && node.duration.text) || null,
		timestamp: (node.duration && node.duration.text) || null,
		thumbnail: thumb,
		author: { name: txt(node.author && node.author.name) || txt(node.author) },
		views: parseViews(viewsText),
		ago: txt(node.published) || null
	}, true);
}

// একটা সার্চ-পাতা থেকে সব নোড (সাধারণ তালিকা + শেলফের ভেতরের Shorts)
function nodesOf(page) {
	const nodes = [];
	try { for (const n of (page.videos || [])) nodes.push(n); } catch (_) { }
	try {
		for (const sh of (page.shelves || [])) {
			if (sh && Array.isArray(sh.items)) for (const it of sh.items) nodes.push(it);
		}
	} catch (_) { }
	try {
		for (const r of (page.results || [])) {
			if (r && Array.isArray(r.items)) for (const it of r.items) nodes.push(it);
		}
	} catch (_) { }
	return nodes.filter(Boolean);
}

/* ══════════════════════════════════════════════════════════════
   🎬 সাধারণ ভিডিও সার্চ (আগের মতোই yt-search দিয়ে)
   ══════════════════════════════════════════════════════════════ */
async function searchVideos(query, limit) {
	const q = cleanQuery(query);
	const max = clamp(limit, MAX_RESULTS, MAX_VIDEO_LIMIT);

	const result = await ytSearch(q);

	const videos = (result.videos || [])
		.filter(video => Boolean(video.videoId))
		.slice(0, max)
		.map(video => formatVideo(video));

	return {
		ok: true,
		query: q,
		type: "videos",
		total: videos.length,
		results: videos
	};
}

/* ══════════════════════════════════════════════════════════════
   📱 YouTube Shorts: YouTube এর নিজস্ব Shorts ফলাফল, পাতার পর পাতা
   ══════════════════════════════════════════════════════════════ */
async function officialShorts(q, limit) {
	const yt = await getYt();
	const first = await yt.search(q);

	// YouTube এর "Shorts" ফিল্টার চাপা (যেমন অ্যাপে Shorts ট্যাব)
	let refined = null;
	try {
		if (typeof first.applyRefinement === "function") refined = await first.applyRefinement("Shorts");
		else if (typeof first.selectRefinementCard === "function") refined = await first.selectRefinementCard("Shorts");
	} catch (_) { refined = null; }

	const collected = new Map();

	const harvest = async (startPage, acceptAll) => {
		let page = startPage;
		for (let i = 0; i < MAX_PAGES && page && collected.size < limit; i++) {
			for (const node of nodesOf(page)) {
				if (!acceptAll && !isShortNode(node)) continue;
				const item = shortFromNode(node);
				if (item && !collected.has(item.videoId)) collected.set(item.videoId, item);
				if (collected.size >= limit) break;
			}
			if (collected.size >= limit) break;

			let more = false;
			try { more = page.has_continuation !== false && typeof page.getContinuation === "function"; } catch (_) { }
			if (!more) break;
			try { page = await page.getContinuation(); } catch (_) { break; }
		}
	};

	if (refined) await harvest(refined, true);
	// ফিল্টারে কিছু না পেলে সাধারণ ফলাফলের Shorts শেলফ থেকে
	if (!collected.size) await harvest(first, false);

	return [...collected.values()].slice(0, limit);
}

// ফলব্যাক: yt-search দিয়ে ছোট (৩ মিনিটের মধ্যের) ভিডিও (আগের পদ্ধতি)
async function legacyShorts(q, limit) {
	const searchQueries = [`${q} #shorts`, `${q} shorts`, `${q} youtube shorts`, q];
	const collected = new Map();

	for (const searchQuery of searchQueries) {
		try {
			const result = await ytSearch(searchQuery);
			for (const video of result.videos || []) {
				const seconds = Number(video.seconds || 0);
				if (video.videoId && seconds > 0 && seconds <= MAX_SHORT_DURATION && !collected.has(video.videoId)) {
					collected.set(video.videoId, video);
				}
			}
		} catch (error) {
			console.error(`[Shorts Search] ${searchQuery}:`, error.message);
		}
		if (collected.size >= limit) break;
	}

	return [...collected.values()].slice(0, limit).map(video => formatVideo(video, true));
}

async function searchShorts(query, limit) {
	const q = cleanQuery(query);
	const max = clamp(limit, DEFAULT_SHORTS, MAX_SHORTS);

	let results = [];
	let source = "youtube-shorts";

	try {
		results = await officialShorts(q, max);
	} catch (error) {
		console.error("[Shorts Search] YouTube সংযোগে সমস্যা:", error && error.message);
		session = null; // পরেরবার সেশন নতুন করে
	}

	if (!results.length) {
		source = "fallback";
		results = await legacyShorts(q, max);
	}

	return {
		ok: true,
		query: q,
		type: "shorts",
		source,
		total: results.length,
		results
	};
}

module.exports = {
	searchVideos,
	searchShorts,
	_setFactory
};
  
