# Render YouTube Music API

## Project structure

```text
youtube_music_api/
├── src/
│   └── server.js
├── lib/
│   └── ytdlp.js
├── package.json
└── cookies.txt   # Add your own Netscape-format cookie file; not included
```

## Setup

1. Upload this project's files to your existing **private** GitHub repository.
2. Add your own `cookies.txt` at the repository root (same level as `package.json`).
3. Keep the repository private and limit collaborator access. Cookie files are sensitive login-session data; consider using Render Secret Files or a secret environment variable instead of committing them.
4. In Render, set the Start Command to `npm start`.
5. Ensure the service uses Node.js 18 or newer.

No actual cookie/session data is included in this ZIP.

## Endpoints

- `/health`
- `/api/search?q=believer`
- `/api/info?v=VIDEO_ID`
- `/api/stream?v=VIDEO_ID`

The API is public and has no authentication, as requested in the supplied server code. Protect it with access controls/rate limits before sharing widely.
