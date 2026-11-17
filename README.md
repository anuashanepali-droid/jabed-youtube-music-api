# Render YouTube Music API v1.2.0

## Files
- `src/server.js`
- `lib/ytdlp.js`
- `package.json`
- `cookies.txt` (add your own; not included)

Place your own Netscape-format `cookies.txt` in the repository root, alongside `package.json`.
Keep session cookies private and restrict repository access. A private Git repository is still a sensitive place to store login-session cookies; a Render Secret File is safer.

## Render
- Start Command: `npm start`
- Node.js: 18+

## Endpoints
- `GET /health`
- `GET /api/search?q=believer`
- `GET /api/info?v=VIDEO_ID`
- `GET /api/stream?v=VIDEO_ID&type=audio`
- `GET /api/stream?v=VIDEO_ID&type=video`

Video selection is limited to formats reported at or below 30 MB, and the stream also enforces a 30 MiB output cap. If no compatible format is available under that limit, the API returns an error rather than sending a larger file. The video endpoint requests MP4 where available; YouTube's available formats vary by video.

Audio defaults to `m4a` when available, then other audio-only formats. This endpoint streams the selected media bytes; it does not transcode them to MP3.

The API has no authentication, matching the supplied original design. Add access control and rate limiting before public distribution.
