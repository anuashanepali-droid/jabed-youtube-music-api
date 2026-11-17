function safeEqual(a, b) {
  const crypto = require("crypto");
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    console.error("API_KEY environment variable is missing");
    return res.status(503).json({ ok: false, error: "API authentication is not configured" });
  }

  const supplied = req.get("x-api-key") || req.query.key || "";
  if (!safeEqual(supplied, expected)) {
    return res.status(401).json({ ok: false, error: "Unauthorized: invalid API key" });
  }
  next();
}

module.exports = { requireApiKey };
