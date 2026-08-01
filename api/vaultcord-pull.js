// api/vaultcord-pull.js (Vercel Serverless Function)
// Wywołuje VaultCord API, żeby uruchomić "pull" (backup członków) na serwer klienta.
// Dokumentacja: https://api.vaultcord.com  (PUT /members/pull/{serverId})
// Klucz API trzymamy po stronie serwera (zmienna środowiskowa w Vercel), nigdy w kodzie front-endu.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  let VAULTCORD_API_KEY = process.env.VAULTCORD_API_KEY;
  if (!VAULTCORD_API_KEY) {
    return res.status(500).json({ error: 'Brak klucza VAULTCORD_API_KEY na serwerze' });
  }
  VAULTCORD_API_KEY = VAULTCORD_API_KEY.trim().replace(/^["']|["']$/g, '');
  if (/^Bearer\s+/i.test(VAULTCORD_API_KEY)) {
    VAULTCORD_API_KEY = VAULTCORD_API_KEY.replace(/^Bearer\s+/i, '').trim();
  }

  const payload = req.body || {};
  const { vaultcordServerId, guildId, limit, roleId } = payload;

  if (!vaultcordServerId) {
    return res.status(400).json({ error: 'Brak vaultcordServerId — ta pullka nie ma skonfigurowanego backupu w panelu admina.' });
  }
  if (!guildId || !/^\d{5,25}$/.test(String(guildId).trim())) {
    return res.status(400).json({ error: 'Nieprawidłowe ID serwera Discord.' });
  }

  try {
    const apiRes = await fetch(`https://api.vaultcord.com/members/pull/${encodeURIComponent(String(vaultcordServerId).trim())}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${VAULTCORD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guildid: String(guildId).trim(),
        limit: limit ? parseInt(limit, 10) : undefined,
        roleId: roleId || undefined,
        skipDuplicate: true,
      }),
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
      const keyDebug = `długość=${VAULTCORD_API_KEY.length}, podgląd="${keyPreview}", liczba kropek=${dotCount}${dotCount !== 2 ? ' (JWT powinien mieć 2 kropki: header.payload.signature)' : ''}`;

      let msg = `VaultCord ${apiRes.status}: ${upstreamMsg}`;
      if (apiRes.status === 401) {
        msg = `VaultCord zwrócił 401: "${upstreamMsg}". Klucz faktycznie wysłany z funkcji: ${keyDebug}. Sprawdź zmienną VAULTCORD_API_KEY w Vercel (Settings → Environment Variables) i zrób redeploy po jej poprawieniu.`;
      } else if (apiRes.status === 402) msg = 'Niewystarczające środki na koncie VaultCord (doładuj w dashboardzie).';
      else if (apiRes.status === 404) msg = `VaultCord nie znalazł serwera o ID "${vaultcordServerId}" — sprawdź, czy to prawidłowe ID serwera z panelu VaultCord (nie ID serwera Discord).`;
      else if (apiRes.status === 429) msg = 'Limit zapytań do VaultCord przekroczony, spróbuj za chwilę.';
      return res.status(apiRes.status).json({ error: msg, debug: upstreamMsg, keyDebug });
    }

    return res.status(200).json({ status: 'ok', startedAt: Date.now(), data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
