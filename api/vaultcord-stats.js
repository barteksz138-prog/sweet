// api/vaultcord-stats.js (Vercel Serverless Function)
// Endpointy wg oficjalnej dokumentacji: https://docs.vaultcord.com
//
// GET /stats/members/{serverId} → { success, data: { pullable: "2385", total: "3094" } }
// GET /stats/pulls              → { success, data: [ { serverId, startTime, totalTime,
//                                   successCount, failedCount, totalCount, bannedCount,
//                                   tooManyGuildsCount, invalidTokenCount, alreadyHereCount, ... } ] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  let VAULTCORD_API_KEY = process.env.VAULTCORD_API_KEY;
  if (!VAULTCORD_API_KEY) {
    return res.status(500).json({ error: 'Brak klucza VAULTCORD_API_KEY na serwerze' });
  }
  VAULTCORD_API_KEY = VAULTCORD_API_KEY.trim().replace(/^["']|["']$/g, '');
  if (/^Bearer\s+/i.test(VAULTCORD_API_KEY)) {
    VAULTCORD_API_KEY = VAULTCORD_API_KEY.replace(/^Bearer\s+/i, '').trim();
  }

  const { vaultcordServerId } = req.query;
  if (!vaultcordServerId) {
    return res.status(400).json({ error: 'Brak vaultcordServerId' });
  }

  const authHeaders = { 'Authorization': `Bearer ${VAULTCORD_API_KEY}` };

  async function safeGet(url) {
    try {
      const r = await fetch(url, { headers: authHeaders });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: e.message } };
    }
  }

  const [memberStatsRes, pullsRes] = await Promise.all([
    safeGet(`https://api.vaultcord.com/stats/members/${encodeURIComponent(vaultcordServerId)}`),
    safeGet('https://api.vaultcord.com/stats/pulls'),
  ]);

  if (memberStatsRes.status === 401 || pullsRes.status === 401) {
    return res.status(401).json({ error: 'VaultCord: nieautoryzowany (401) — sprawdź klucz API.' });
  }

  // /stats/members/{serverId} → data: { pullable: "2385", total: "3094" }
  const msData = memberStatsRes.data?.data || {};
  const memberStats = {
    pullable: msData.pullable != null ? parseInt(msData.pullable, 10) : null,
    total:    msData.total    != null ? parseInt(msData.total,    10) : null,
  };

  // /stats/pulls → data: [ { serverId, startTime, successCount, failedCount, totalCount, ... } ]
  // Filtrujemy tylko pulle dla tego serwera
  const allPulls = Array.isArray(pullsRes.data?.data) ? pullsRes.data.data : [];
  const serverPulls = allPulls.filter(p => String(p.serverId) === String(vaultcordServerId));

  const pulls = serverPulls.map(p => ({
    date:             p.startTime          ?? null,  // "2025-09-26 11:16:24"
    totalTime:        p.totalTime          ?? null,  // "00:00:01"
    successCount:     p.successCount       ?? 0,
    failedCount:      p.failedCount        ?? 0,
    bannedCount:      p.bannedCount        ?? 0,
    tooManyGuilds:    p.tooManyGuildsCount ?? 0,
    invalidToken:     p.invalidTokenCount  ?? 0,
    alreadyHere:      p.alreadyHereCount   ?? 0,
    totalCount:       p.totalCount         ?? 0,
    serverName:       p.serverName         ?? null,
  }));

  const totals = pulls.reduce((acc, p) => {
    acc.total   += p.totalCount;
    acc.success += p.successCount;
    acc.failed  += p.failedCount;
    acc.banned  += p.bannedCount;
    return acc;
  }, { total: 0, success: 0, failed: 0, banned: 0 });

  return res.status(200).json({
    status: 'ok',
    memberStats,  // pullable, total
    pulls,        // historia pulli dla tego serwera
    totals,       // sumy
  });
}
