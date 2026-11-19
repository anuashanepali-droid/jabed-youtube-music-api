JABED YOUTUBE API UPDATE

Files in this ZIP:
- src/search.js
- src/server.js

Upload/replace these two files in your GitHub repository.
Do not replace lib/ytdlp.js or package.json.

Endpoints:
- /api/search?q=believer
- /api/shorts?q=funny
- /api/info?v=VIDEO_ID
- /api/stream?v=VIDEO_ID&type=audio
- /api/stream?v=VIDEO_ID&type=video

Notes:
- Search results include duration, seconds, timestamp, ago, and published fields.
- The yt-search library may not provide publication age for every result; missing values remain null.
- Shorts search is a Shorts-oriented search with a <=60-second filter; YouTube's exact Shorts classification is not guaranteed.
