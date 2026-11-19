const express = require("express");
const { searchVideos, searchShorts } = require("./search");
const { ensureReady, getVideoInfo, streamMedia } = require("../lib/ytdlp");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const MAX_QUERY_LENGTH = 180;

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Jabed YouTube Music API",
    version: "1.3.0",
    endpoints: {
      health: "/health",
      search: "/api/search?q=believer",
      shorts: "/api/shorts?q=funny",
      info: "/api/info?v=VIDEO_ID",
      audio: "/api/stream?v=VIDEO_ID&type=audio",
      video: "/api/stream?v=VIDEO_ID&type=video"
    },
    videoMaxSize: "30 MB",
    authentication: "None (public access)"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "online", service: "youtube-music-api" });
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) {
      return res.status(400).json({
        ok: false,
        error: "Missing search query. Use ?q=..."
      });
    }

    return res.json(await searchVideos(q));
  } catch (error) {
    console.error("[search]", error.stack || error.message || error);
    return res.status(502).json({
      ok: false,
      error: "YouTube search failed",
      detail: error.message || String(error)
    });
  }
});

app.get("/api/shorts", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) {
      return res.status(400).json({
        ok: false,
        error: "Missing search query. Use ?q=..."
      });
    }

    return res.json(await searchShorts(q));
  } catch (error) {
    console.error("[shorts]", error.stack || error.message || error);
    return res.status(502).json({
      ok: false,
      error: "YouTube Shorts search failed",
      detail: error.message || String(error)
    });
  }
});

app.get("/api/info", async (req, res) => {
  try {
    const id = String(req.query.v || req.query.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid video ID. Use ?v=VIDEO_ID"
      });
    }

    const video = await getVideoInfo(id);
    if (!video || !video.id) {
      return res.status(404).json({ ok: false, error: "Video not found" });
    }

    const seconds = Number(video.duration || 0);
    const thumbnails = Array.isArray(video.thumbnails) ? video.thumbnails : [];
    const uploadDate = video.release_date || video.upload_date || null;

    return res.json({
      ok: true,
      video: {
        title: video.title || "",
        videoId: video.id || id,
        url: video.webpage_url || `https://www.youtube.com/watch?v=${id}`,
        duration: video.duration_string || null,
        timestamp: video.duration_string || null,
        seconds,
        thumbnail: video.thumbnail || thumbnails.at(-1)?.url || "",
        author: video.uploader || video.channel || "",
        views: Number(video.view_count || 0),
        ago: uploadDate,
        published: uploadDate
      }
    });
  } catch (error) {
    console.error("[info]", error.stack || error.message || error);
    return res.status(502).json({
      ok: false,
      error: "Could not get video information",
      detail: error.message || String(error)
    });
  }
});

app.get("/api/stream", async (req, res) => {
  const id = String(req.query.v || req.query.id || "").trim();
  const type = String(req.query.type || "audio").toLowerCase();

  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid video ID. Use ?v=VIDEO_ID"
    });
  }

  if (!["audio", "video"].includes(type)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid type. Use type=audio or type=video"
    });
  }

  try {
    await ensureReady();
    streamMedia(id, type, req, res);
  } catch (error) {
    console.error("[stream setup]", error.stack || error.message || error);
    if (!res.headersSent) {
      return res.status(503).json({
        ok: false,
        error: "Media service is not ready",
        detail: error.message || String(error)
      });
    }
  }
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err.stack || err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YouTube Music API listening on port ${PORT}`);
});
