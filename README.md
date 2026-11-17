# Render YouTube Music API

Express-based YouTube search, metadata and audio-stream API for a Render **Web Service**.

## Endpoints

All `/api/*` routes require the API key.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Public health check |
| GET | `/api/search?q=believer` | Search up to 10 YouTube videos |
| GET | `/api/info?v=VIDEO_ID` | Get video information |
| GET | `/api/stream?v=VIDEO_ID` | Stream the selected video's audio |

Authentication: send `x-api-key: YOUR_API_KEY`. For quick browser testing only, `?key=YOUR_API_KEY` is also accepted. Prefer the header in your bot.

## Deploy to Render

1. Extract this ZIP.
2. Create a new **private GitHub repository** and upload the contents of this folder (not the ZIP itself).
3. In Render, choose **New + → Web Service**, connect that repository.
4. Set:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add Environment Variables:
   - `API_KEY` = a long, random secret of your own
   - `YT_COOKIES` = optional Netscape-format YouTube cookies, only if you are authorized to use them
6. Deploy. Render will provide a URL such as `https://your-service.onrender.com`.

The included `render.yaml` can also be used as a Blueprint. If you deploy manually, set the environment variables in the Render dashboard.

## Test

Replace the host and key with your own:

```bash
curl https://YOUR-SERVICE.onrender.com/health

curl -H "x-api-key: YOUR_API_KEY" \
  "https://YOUR-SERVICE.onrender.com/api/search?q=believer"

curl -H "x-api-key: YOUR_API_KEY" \
  "https://YOUR-SERVICE.onrender.com/api/info?v=VIDEO_ID"

curl -L -H "x-api-key: YOUR_API_KEY" \
  "https://YOUR-SERVICE.onrender.com/api/stream?v=VIDEO_ID" \
  --output audio.bin
```

For `/api/stream`, the response is a binary audio stream, not JSON. The selected container can vary, so the response uses `application/octet-stream`.

## Important notes

- Render free instances may spin down after inactivity. The first request after sleep can be slow.
- The service downloads yt-dlp and the PO Token provider/plugin into `/tmp` on first stream request. Render's filesystem is ephemeral; assets may need to be downloaded again after restart/redeploy.
- The Rust PO Token provider binary used here is the Linux x86_64 release. Use an x86_64 Render instance.
- YouTube extraction behavior can change. A successful deployment does not guarantee every video can be streamed.
- Do not commit `YT_COOKIES`, `cookies.txt`, or API keys to GitHub. Set secrets in Render Environment Variables. If a cookie file or key was publicly exposed, revoke/rotate it.
- Use this API only for content you are allowed to access and in compliance with YouTube's terms and applicable copyright rules. Do not redistribute copyrighted audio without permission.
- This project is syntax-checked locally; it has not been deployed or live-tested on your Render account.
