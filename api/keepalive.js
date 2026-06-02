// Vercel Cron target — keeps the free Supabase project from auto-pausing.
//
// Supabase pauses a free project after ~7 days of no activity; once paused,
// Postgres is off and can't wake itself. This endpoint runs a tiny real query
// against the DB so the project stays awake. It's scheduled daily in vercel.json
// (7x margin under the pause window). Vercel runs on its own infrastructure, so
// it's a valid "external" pinger even when Supabase is the thing being kept up.
//
// Reuses the SUPABASE_* env already set on the project — no new secrets. The
// service-role key never leaves the server. Returns only a status + timestamp
// (no verse data), so the endpoint being public leaks nothing.

module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: 'SUPABASE env not configured' });
    }
    const r = await fetch(`${url}/rest/v1/verses?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok,
      status: r.status,
      pingedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
