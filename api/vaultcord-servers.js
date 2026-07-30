// api/vaultcord-servers.js (Vercel Serverless Function)
// Zwraca listę serwerów podłączonych do konta VaultCord (GET /servers),
// żeby w panelu admina można było wybrać serwer z listy, a nie wpisywać ID ręcznie.

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

  try {
    const apiRes = await fetch('https://api.vaultcord.com/servers', {
      headers: { 'Authorization': `Bearer ${VAULTCORD_API_KEY}` },
    });
    const text = await apiRes.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!apiRes.ok) {
      const upstreamMsg = (data && (data.message || data.error || data.raw)) || apiRes.statusText || 'brak szczegółów';
      const dotCount = (VAULTCORD_API_KEY.match(/\./g) || []).length;
      const keyPreview = VAULTCORD_API_KEY.length > 8
        ? `${VAULTCORD_API_KEY.slice(0, 6)}…${VAULTCORD_API_KEY.slice(-4)}`
        : '(bardzo krótki/pusty)';
      const keyDebug = `długość=${VAULTCORD_API_KEY.length}, podgląd="${keyPreview}", liczba kropek=${dotCount}`;
      let msg = `VaultCord ${apiRes.status}: ${upstreamMsg}`;
      if (apiRes.status === 401) {
        msg = `VaultCord zwrócił 401: "${upstreamMsg}". Klucz wysłany z funkcji: ${keyDebug}. Sprawdź zmienną VAULTCORD_API_KEY w Vercel i zrób redeploy po jej poprawieniu.`;
      }
      return res.status(apiRes.status).json({ error: msg, keyDebug });
    }

    function firstDefined(obj, keys) {
      if (!obj) return undefined;
      for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      return undefined;
    }

    const list = Array.isArray(data) ? data
      : Array.isArray(data && data.data) ? data.data
      : Array.isArray(data && data.servers) ? data.servers
      : [];

    const servers = list.map(s => ({
      id: firstDefined(s, ['id', 'serverId', '_id']),
      name: firstDefined(s, ['name', 'guildName', 'serverName']) || `Serwer ${firstDefined(s, ['id', 'serverId', '_id'])}`,
      guildId: firstDefined(s, ['guildid', 'guildId', 'guild_id']) || null,
    })).filter(s => s.id !== undefined);

    return res.status(200).json({ status: 'ok', servers });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
