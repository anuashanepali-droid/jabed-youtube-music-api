
const ytSearch = require("yt-search");

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 180;
const MAX_SHORT_DURATION = 180;

function formatVideo(video, shorts = false) {
  const videoId = video.videoId || "";
  const seconds = Number(video.seconds || 0);
  const published = video.ago || null;

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
    ago: published,
    published
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

  // Search specifically for Shorts-related content
  const result = await ytSearch(`${q} #shorts`);

  const videos = (result.videos || [])
    .filter(video => {
      const seconds = Number(video.seconds || 0);

      return (
        seconds > 0 &&
        seconds <= MAX_SHORT_DURATION &&
        Boolean(video.videoId)
      );
    })
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
    
