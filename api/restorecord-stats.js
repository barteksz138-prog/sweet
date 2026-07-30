// api/restorecord-stats.js
// Sprawdza status ostatniej (lub konkretnej) migracji RestoreCord.
// GET /api/v3/servers/{serverId}/migrations/status  — szczegółowy status z progress i counts
// Używane do pollingu co 30s po nadaniu pulla.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { rcKeyName, rcServerId, migrationId } = req.query;

  if (!rcKeyName || !rcServerId) {
    return res.status(400).json({ error: 'Brak rcKeyName lub rcServerId.' });
  }

  const RC_API_KEY = process.env[rcKeyName];
  if (!RC_API_KEY) {
    return res.status(500).json({ error: `Brak zmiennej środowiskowej "${rcKeyName}" w Vercel.` });
  }

  try {
    // Używamy szczegółowego endpointu statusu — zwraca isActive, progress, counts
    const url = `https://restorecord.com/api/v3/servers/${encodeURIComponent(String(rcServerId).trim())}/migrations/status`;
    const apiRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${RC_API_KEY.trim()}` },
    });

    const text = await apiRes.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!apiRes.ok) {
      const msg = (data && (data.message || data.error || data.raw)) || apiRes.statusText;
      return res.status(apiRes.status).json({ error: `RestoreCord ${apiRes.status}: ${msg}` });
    }

    const m = data?.migration;
    if (!m) {
      return res.status(200).json({ status: 'ok', found: false });
    }

    return res.status(200).json({
      status: 'ok',
      found: true,
      migrationStatus: m.status,           // WAITING, PENDING, PULLING, SUCCESS, FAILED, STOPPED, PAUSED
      isActive: m.isActive ?? false,
      total: m.progress?.total ?? null,
      attempted: m.progress?.attempted ?? null,
      percentage: m.progress?.percentage ?? null,
      success: m.counts?.success ?? null,
      failed: m.counts?.failed ?? null,
      banned: m.counts?.banned ?? null,
      maxGuilds: m.counts?.maxGuilds ?? null,
      invalid: m.counts?.invalid ?? null,
      alreadyHere: m.counts?.inServer ?? null,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
