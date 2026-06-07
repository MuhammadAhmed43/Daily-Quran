// Lightweight per-IP rate limiter (underscore = Vercel doesn't treat it as a route).
//
// Best-effort flood speed-bump: the counters live in the warm lambda instance's memory, so this blunts
// a naive single-IP loop (the common abuse that would drain the free Groq/Cloudflare quotas) at ZERO
// latency and $0, with no DB/migration. It does NOT stop a distributed attack across many cold
// instances — a Supabase-backed counter is the robust upgrade if real abuse ever shows up. Limits are
// set far above any human usage, so a legitimate user (even a brisk voice conversation that fires
// several /api/speak calls per reply) never hits them.

const WINDOW_MS = 60_000;
const buckets = new Map(); // ip -> { count, resetAt }

function clientIp(req) {
  const xff = req && req.headers && req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

// Returns true if this request is OVER the limit (caller should reply 429). `max` = requests / 60s / IP.
function rateLimited(req, max) {
  const ip = clientIp(req);
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, b);
  }
  b.count += 1;
  // Opportunistic cleanup so the Map can't grow unbounded across many distinct IPs.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }
  return b.count > max;
}

module.exports = { rateLimited, clientIp };
