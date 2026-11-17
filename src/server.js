const express = require("express");
const ytSearch = require("yt-search");
const { requireApiKey } = require("../lib/auth");
const { ensureReady, streamAudio } = require("../lib/ytdlp");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 180;

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Render YouTube Music API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      search: "/api/search?q=believer",
      info: "/api/info?v=VIDEO_ID",
      stream: "/api/stream?v=VIDEO_ID"
    },
    authentication: "Send x-api-key header"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "online", service: "youtube-music-api" });
});

app.use("/api", requireApiKey);

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return res.status(400).json({ ok: false, error: "Missing search query. Use ?q=..." });

    const result = await ytSearch(q);
    const videos = (result.videos || []).slice(0, MAX_RESULTS).map(video => ({
      title: video.title || "",
      videoId: video.videoId || "",
      url: video.url || (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : ""),
      duration: video.duration || null,
      timestamp: video.timestamp || null,
      seconds: Number(video.seconds || 0),
      thumbnail: video.thumbnail || "",
      author: video.author?.name || "",
      views: Number(video.views || 0),
      ago: video.ago || ""
    }));

    res.json({ ok: true, query: q, total: videos.length, results: videos });
  } catch (error) {
    console.error("[search]", error.message);
    res.status(502).json({ ok: false, error: "YouTube search failed", detail: error.message });
  }
});

app.get("/api/info", async (req, res) => {
  try {
    const id = String(req.query.v || req.query.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return res.status(400).json({ ok: false, error: "Invalid video ID. Use ?v=VIDEO_ID" });
    }

    const result = await ytSearch({ videoId: id });
    const video = result && result.title ? result : (result.videos || [])[0];
    if (!video) return res.status(404).json({ ok: false, error: "Video not found" });

    res.json({
      ok: true,
      video: {
        title: video.title || "",
        videoId: video.videoId || id,
        url: video.url || `https://www.youtube.com/watch?v=${id}`,
        duration: video.duration || null,
        seconds: Number(video.seconds || 0),
        timestamp: video.timestamp || null,
        thumbnail: video.thumbnail || "",
        author: video.author?.name || "",
        views: Number(video.views || 0),
        ago: video.ago || ""
      }
    });
  } catch (error) {
    console.error("[info]", error.message);
    res.status(502).json({ ok: false, error: "Could not get video information", detail: error.message });
  }
});

app.get("/api/stream", async (req, res) => {
  const id = String(req.query.v || req.query.id || "").trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ ok: false, error: "Invalid video ID. Use ?v=VIDEO_ID" });
  }

  try {
    await ensureReady();
    streamAudio(id, req, res);
  } catch (error) {
    console.error("[stream setup]", error.stack || error.message);
    if (!res.headersSent) {
      res.status(503).json({
        ok: false,
        error: "Audio service is not ready",
        detail: error.message
      });
    }
  }
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err.stack || err.message);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YouTube Music API listening on port ${PORT}`);
});
