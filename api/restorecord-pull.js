// api/restorecord-pull.js
// Startuje migrację członków przez RestoreCord API.
// POST /api/v3/servers/{serverId}/migrations
// Auth: Bearer <keyId>.<secret>  (przechowywany w zmiennej środowiskowej RC_KEY_*)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const { rcKeyName, rcServerId, targetGuildId, selectedRoles = [], customPullCount } = req.body || {};

  if (!rcKeyName || !rcServerId || !targetGuildId) {
    return res.status(400).json({ error: 'Brak wymaganych parametrów: rcKeyName, rcServerId, targetGuildId.' });
  }

  // Pobieramy klucz po stronie serwera — nigdy nie wychodzi na front-end
  const RC_API_KEY = process.env[rcKeyName];
  if (!RC_API_KEY) {
    return res.status(500).json({ error: `Brak zmiennej środowiskowej "${rcKeyName}" w Vercel. Dodaj ją w Settings → Environment Variables.` });
  }

  const body = {
    targetGuildId: String(targetGuildId).trim(),
    selectedRoles: Array.isArray(selectedRoles) ? selectedRoles.filter(Boolean) : [],
    customPullCount: customPullCount ? parseInt(customPullCount, 10) : 0,
    includeUnknownMembers: true,
  };

  try {
    const apiRes = await fetch(`https://restorecord.com/api/v3/servers/${encodeURIComponent(String(rcServerId).trim())}/migrations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RC_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await apiRes.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!apiRes.ok) {
      // Wyciągamy czytelny komunikat — data może być obiektem z wieloma polami
      let msgRaw = data?.message || data?.error || data?.errors || data?.raw || apiRes.statusText || 'brak szczegółów';
      // Jeśli msgRaw to obiekt/tablica, zamieniamy na string
      if (typeof msgRaw !== 'string') msgRaw = JSON.stringify(msgRaw);

      let friendly = `RestoreCord ${apiRes.status}: ${msgRaw}`;
      if (apiRes.status === 400) friendly = `RestoreCord zwrócił 400 (błędne dane): ${msgRaw}. Sprawdź czy ID serwera RestoreCord jest poprawne i czy targetGuildId to prawidłowe Discord Guild ID.`;
      else if (apiRes.status === 401) friendly = `RestoreCord zwrócił 401 — klucz "${rcKeyName}" jest nieprawidłowy lub wygasł. Sprawdź wartość zmiennej w Vercel.`;
      else if (apiRes.status === 403) friendly = `RestoreCord zwrócił 403 — klucz nie ma uprawnień pull_members lub konto nie ma wystarczającego planu.`;
      else if (apiRes.status === 404) friendly = `RestoreCord zwrócił 404 — serwer o ID "${rcServerId}" nie istnieje lub bot nie ma do niego dostępu.`;
      else if (apiRes.status === 429) friendly = `Limit zapytań RestoreCord przekroczony (pull cooldown 6h na darmowym planie). Spróbuj ponownie za chwilę.`;
      return res.status(apiRes.status).json({ error: friendly, rawResponse: data });
    }

    // Wyciągamy migrationId, jeśli API go zwróciło (do późniejszego śledzenia statusu)
    const migrationId = data?.migration?.id ?? null;
    const estimatedTime = data?.migration?.estimatedTime ?? null;

    return res.status(200).json({
      status: 'ok',
      migrationId,
      estimatedTime,
      queued: data?.migration?.queued ?? false,
      raw: data,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
