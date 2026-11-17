# Render YouTube Music API v1.2.1

## Files
- `src/server.js`
- `lib/ytdlp.js`
- `package.json`
- `cookies.txt` (add your own; not included)

Place your own Netscape-format `cookies.txt` in the repository root, alongside `package.json`. Keep session cookies private. A Render Secret File is safer than committing login-session cookies to GitHub, even in a private repository.

## Render
- Start Command: `npm start`
- Node.js: 18+

## Endpoints
- `GET /health`
- `GET /api/search?q=believer`
- `GET /api/info?v=VIDEO_ID`
- `GET /api/stream?v=VIDEO_ID&type=audio`
- `GET /api/stream?v=VIDEO_ID&type=video`

If `type` is omitted, the stream endpoint defaults to audio.

## Media behavior
- Audio keeps the original `bestaudio/best` selector and generic binary response (`.audio`) to avoid falsely labelling WebM audio as MP4/M4A.
- Video selects a progressive MP4 format with a reported size at or below 30 MB, applies yt-dlp's maximum-file-size check, and also enforces a hard 30 MiB output cap.
- If YouTube does not report a compatible MP4 format under the limit, the video request fails instead of knowingly selecting a larger or differently labelled file.
- Audio is not transcoded to MP3.

The API has no authentication, matching the original design. Add access control and rate limiting before public distribution.
