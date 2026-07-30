// api/admin-login.js (Vercel Serverless Function)
// Weryfikuje hasło admina po stronie serwera — hasło nigdy nie trafia do przeglądarki.
// Ustaw zmienną środowiskową ADMIN_PASSWORD w Vercel (Settings → Environment Variables).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Brak zmiennej ADMIN_PASSWORD na serwerze' });
  }

  const { pass } = req.body || {};
  if (!pass || typeof pass !== 'string') {
    return res.status(400).json({ ok: false });
  }

  // Stałoczasowe porównanie — zapobiega timing attacks
  const a = Buffer.from(pass.padEnd(128));
  const b = Buffer.from(ADMIN_PASSWORD.padEnd(128));
  const match = a.length === b.length && require('crypto').timingSafeEqual(a, b) && pass === ADMIN_PASSWORD;

  if (match) {
    return res.status(200).json({ ok: true });
  } else {
    // Celowe opóźnienie — utrudnia brute-force
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ ok: false });
  }
}
