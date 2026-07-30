// api/ltc-rate.js (Vercel Serverless Function)
// Pobiera aktualny kurs LTC/PLN i zwraca ile LTC trzeba zapłacić za daną kwotę PLN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const rateRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=pln'
    );
    const rateData = await rateRes.json();
    const ltcPln = rateData.litecoin.pln;

    const pln = parseFloat(req.query.pln || '0');
    if (!pln || pln <= 0) {
      return res.status(400).json({ error: 'Brak kwoty PLN' });
    }

    const ltcAmount = pln / ltcPln;
    const ltcRounded = Math.ceil(ltcAmount * 1000000) / 1000000;

    return res.status(200).json({
      pln,
      ltcPln,
      ltcAmount: ltcRounded,
      toleranceLtc: parseFloat((0.30 / ltcPln).toFixed(8)),
      address: 'LVieH7KeRB6CG6ya7nEpGFqc5quq61VCtV',
    });
  } catch (e) {
    return res.status(500).json({ error: 'Błąd pobierania kursu: ' + e.message });
  }
}
