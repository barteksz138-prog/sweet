// api/data.js
// Odczytuje i zapisuje dane (pullki, upselle) w Vercel KV (Redis).
// Wymaga zmiennej środowiskowej KV_REST_API_URL i KV_REST_API_TOKEN
// (dodawane automatycznie po podłączeniu Vercel KV w dashboardzie).
//
// GET  /api/data?key=items   → zwraca dane
// POST /api/data             → { key, value } → zapisuje dane

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Brak zmiennych KV_REST_API_URL / KV_REST_API_TOKEN. Podłącz Vercel KV w zakładce Storage w dashboardzie Vercel.' });
  }

  const kvFetch = (path, options = {}) =>
    fetch(`${KV_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });

  if (req.method === 'GET') {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'Brak parametru key' });
    try {
      const r = await kvFetch(`/get/${encodeURIComponent(key)}`);
      const json = await r.json();
      // KV zwraca { result: "wartość" } lub { result: null }
      return res.status(200).json({ value: json.result ?? null });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!key || value === undefined) return res.status(400).json({ error: 'Brak key lub value' });
    try {
      // SET key value — bez TTL (dane trwałe)
      const r = await kvFetch(`/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        body: JSON.stringify(typeof value === 'string' ? value : JSON.stringify(value)),
      });
      const json = await r.json();
      return res.status(200).json({ ok: json.result === 'OK' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
