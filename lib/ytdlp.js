const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { promisify } = require("util");
const AdmZip = require("adm-zip");

const execFileAsync = promisify(execFile);
const TMP = process.env.TMP_DIR || "/tmp/jabed-youtube-api";
const BIN = path.join(TMP, "yt-dlp");
const POT = path.join(TMP, "bgutil-pot");
const PLUGINS = path.join(TMP, "plugins");
const POT_PORT = Number(process.env.POT_PORT || 4416);

let setupPromise = null;
let potProcess = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchToFile(url, destination, mode) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: { "user-agent": "Render-YouTube-Music-API/1.0" }
  });

  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status}): ${url}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
  if (mode) fs.chmodSync(destination, mode);
}

function findPluginRoot(directory, depth = 0) {
  if (fs.existsSync(path.join(directory, "yt_dlp_plugins"))) return directory;
  if (depth >= 4) return null;

  for (const name of fs.readdirSync(directory)) {
    const candidate = path.join(directory, name);
    if (fs.statSync(candidate).isDirectory()) {
      const found = findPluginRoot(candidate, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

async function ensureBinary() {
  fs.mkdirSync(TMP, { recursive: true });

  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const ytAsset = arch === "aarch64"
    ? "yt-dlp_linux_aarch64"
    : "yt-dlp_linux";

  if (!fs.existsSync(BIN) || fs.statSync(BIN).size < 1024 * 1024) {
    await fetchToFile(
      `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytAsset}`,
      BIN,
      0o755
    );
  }

  // The Rust PO-token provider release currently publishes an x86_64 Linux binary.
  if (arch !== "x86_64") {
    throw new Error("PO Token provider binary in this setup supports x86_64 Linux only");
  }

  if (!fs.existsSync(POT) || fs.statSync(POT).size < 1024 * 1024) {
    await fetchToFile(
      "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest/download/bgutil-pot-linux-x86_64",
      POT,
      0o755
    );
  }

  const pluginDir = path.join(PLUGINS, "bgutil-ytdlp-pot-provider");
  if (!fs.existsSync(path.join(pluginDir, "yt_dlp_plugins"))) {
    const zipFile = path.join(TMP, "bgutil-plugin.zip");
    const extractDir = path.join(TMP, "plugin-extract");

    await fetchToFile(
      "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest/download/bgutil-ytdlp-pot-provider-rs.zip",
      zipFile
    );

    fs.rmSync(extractDir, { recursive: true, force: true });
    new AdmZip(zipFile).extractAllTo(extractDir, true);

    const pluginRoot = findPluginRoot(extractDir);
    if (!pluginRoot) {
      throw new Error("Could not locate yt-dlp PO Token plugin in downloaded archive");
    }

    fs.mkdirSync(PLUGINS, { recursive: true });
    fs.rmSync(pluginDir, { recursive: true, force: true });
    fs.cpSync(pluginRoot, pluginDir, { recursive: true });
  }
}

async function startPotServer() {
  if (potProcess && potProcess.exitCode === null && !potProcess.killed) return;

  potProcess = spawn(
    POT,
    ["server", "--host", "127.0.0.1", "--port", String(POT_PORT)],
    {
      env: {
        ...process.env,
        HOME: TMP,
        CACHE_DIR: path.join(TMP, "pot-cache")
      },
      stdio: ["ignore", "ignore", "pipe"]
    }
  );

  let potError = "";
  potProcess.stderr.on("data", chunk => {
    potError = (potError + chunk.toString()).slice(-2000);
  });

  potProcess.on("error", error => {
    console.error("[PO token process]", error.message);
  });

  potProcess.on("exit", (code, signal) => {
    console.error(`[PO token process] exited code=${code} signal=${signal} ${potError}`);
  });

  let ready = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${POT_PORT}/ping`, {
        signal: AbortSignal.timeout(1200)
      });

      if (response.ok) {
        ready = true;
        break;
      }
    } catch (_) {
      // Retry until the local PO-token service is ready.
    }

    await sleep(400);
  }

  if (!ready) {
    throw new Error(`PO Token server did not become ready. ${potError}`);
  }
}

async function setup() {
  await ensureBinary();
  await startPotServer();
  console.log("[yt-dlp] binary and PO Token provider are ready");
}

function ensureReady() {
  if (!setupPromise) {
    setupPromise = setup().catch(error => {
      setupPromise = null;
      throw error;
    });
  }

  return setupPromise;
}

function getCookieArgs() {
  const cookies = process.env.YT_COOKIES;
  if (!cookies || !cookies.trim()) return [];

  const cookiePath = path.join(TMP, "cookies.txt");
  fs.writeFileSync(cookiePath, cookies.replace(/\\n/g, "\n"), {
    mode: 0o600
  });

  return ["--cookies", cookiePath];
}

function getCommonYtDlpArgs() {
  return [
    "--ignore-config",
    "--no-warnings",
    "--no-playlist",
    "--js-runtimes", `node:${process.execPath}`,
    "--remote-components", "ejs:github",
    "--extractor-args",
    `youtubepot-bgutilhttp:base_url=http://127.0.0.1:${POT_PORT}`,
    "--extractor-args",
    "youtube:player_client=mweb;fetch_pot=always",
    ...getCookieArgs()
  ];
}

async function getVideoInfo(videoId) {
  await ensureReady();

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    ...getCommonYtDlpArgs(),
    "--skip-download",
    "--dump-single-json",
    videoUrl
  ];

  try {
    const { stdout } = await execFileAsync(BIN, args, {
      env: { ...process.env, HOME: TMP },
      timeout: 90000,
      maxBuffer: 16 * 1024 * 1024
    });

    return JSON.parse(stdout);
  } catch (error) {
    const detail = String(error.stderr || error.message || error).trim();
    throw new Error(detail.slice(-1800));
  }
}

function streamAudio(videoId, req, res) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const args = [
    ...getCommonYtDlpArgs(),
    "--no-progress",
    "-f", "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio",
    "-o", "-",
    "--retries", "1",
    "--fragment-retries", "1",
    "--socket-timeout", "20",
    videoUrl
  ];

  const child = spawn(BIN, args, {
    env: { ...process.env, HOME: TMP },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  let gotData = false;
  let finished = false;

  const stopChild = () => {
    if (!child.killed && !finished) child.kill("SIGTERM");
  };

  child.stderr.on("data", chunk => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  child.stdout.once("data", firstChunk => {
    if (finished || res.destroyed) return;

    gotData = true;
    res.status(200);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${videoId}.audio"`);
    res.setHeader("Cache-Control", "no-store");
    res.write(firstChunk);
    child.stdout.pipe(res);
  });

  child.on("error", error => {
    console.error("[yt-dlp spawn]", error.message);
    finished = true;

    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "Could not start audio extractor",
        detail: error.message
      });
    } else {
      res.destroy(error);
    }
  });

  child.on("close", code => {
    finished = true;

    if (code !== 0) {
      console.error("[yt-dlp exit]", code, stderr.slice(-1800));

      if (!gotData && !res.headersSent) {
        res.status(502).json({
          ok: false,
          error: "Audio extraction failed",
          detail: stderr.slice(-1200)
        });
      } else if (!res.writableEnded && !res.destroyed) {
        res.destroy(new Error("Audio stream ended unexpectedly"));
      }
    } else if (gotData && !res.writableEnded && !res.destroyed) {
      res.end();
    } else if (!gotData && !res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "No audio data received"
      });
    }
  });

  req.on("aborted", stopChild);
  res.on("close", stopChild);
}

module.exports = {
  ensureReady,
  getVideoInfo,
  streamAudio
};
