
const ytSearch = require("yt-search");

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 180;
const MAX_SHORT_DURATION = 180;

// Format YouTube video data
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
    thumbnail: video.thumbnail || "",
    author: video.author?.name || "",
    views: Number(video.views || 0),
    ago: video.ago || null,
    published: video.ago || null
  };
}

// Normal YouTube Video Search
async function searchVideos(query) {
  const q = String(query || "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);

  if (!q) {
    throw new Error("Search query is required");
  }

  const result = await ytSearch(q);

  const videos = (result.videos || [])
    .filter(video => Boolean(video.videoId))
    .slice(0, MAX_RESULTS)
    .map(video => formatVideo(video));

  return {
    ok: true,
    query: q,
    type: "videos",
    total: videos.length,
    results: videos
  };
}

// YouTube Shorts Search
async function searchShorts(query) {
  const q = String(query || "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);

  if (!q) {
    throw new Error("Search query is required");
  }

  const searchQueries = [
    `${q} #shorts`,
    `${q} shorts`,
    `${q} youtube shorts`,
    q
  ];

  const collected = new Map();

  for (const searchQuery of searchQueries) {
    try {
      const result = await ytSearch(searchQuery);

      for (const video of result.videos || []) {
        const videoId = video.videoId;
        const seconds = Number(video.seconds || 0);

        if (
          videoId &&
          seconds > 0 &&
          seconds <= MAX_SHORT_DURATION &&
          !collected.has(videoId)
        ) {
          collected.set(videoId, video);
        }
      }
    } catch (error) {
      console.error(
        `[Shorts Search] ${searchQuery}:`,
        error.message
      );
    }

    if (collected.size >= MAX_RESULTS) {
      break;
    }
  }

  const videos = [...collected.values()]
    .slice(0, MAX_RESULTS)
    .map(video => formatVideo(video, true));

  return {
    ok: true,
    query: q,
    type: "shorts",
    total: videos.length,
    results: videos
  };
}

module.exports = {
  searchVideos,
  searchShorts
};
