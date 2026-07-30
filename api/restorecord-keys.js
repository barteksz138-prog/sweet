// api/restorecord-keys.js
// Zwraca listę NAZW zmiennych środowiskowych zaczynających się od RC_KEY_
// (np. RC_KEY_SWEETPULL, RC_KEY_PIRATEK) — wartości kluczy nigdy nie wychodzą na front-end.
// Admin widzi tylko listę nazw/kont, wybiera w dropdownie, a nazwa przekazywana jest
// do restorecord-pull.js, który pobiera wartość klucza po stronie serwera.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Zbieramy wszystkie zmienne środowiskowe zaczynające się od RC_KEY_
  const keys = Object.keys(process.env)
    .filter(k => k.startsWith('RC_KEY_') && process.env[k])
    .sort();

  return res.status(200).json({ status: 'ok', keys });
}
