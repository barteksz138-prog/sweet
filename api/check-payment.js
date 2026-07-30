// api/check-payment.js (Vercel Serverless Function)
// Sprawdza potwierdzenia LTC przez Blockchair — publiczne API, BEZ klucza API.
// Dokumentacja: https://blockchair.com/api/docs
// Limit: ~30 zapytań/minutę na darmowym (wystarczy do weryfikacji płatności co 60s)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const LTC_ADDRESS = 'LVieH7KeRB6CG6ya7nEpGFqc5quq61VCtV';

  const { ltcAmount, toleranceLtc, since } = req.query;
  if (!ltcAmount || !since) {
    return res.status(400).json({ error: 'Brak parametrów' });
  }

  const expected = parseFloat(ltcAmount);
  const tolerance = parseFloat(toleranceLtc || '0.0008');
  const sinceMs = parseInt(since, 10) * 1000;

  try {
    // Blockchair — publiczne API bez klucza
    const url = `https://api.blockchair.com/litecoin/dashboards/address/${LTC_ADDRESS}?transaction_details=true&limit=10`;
    const apiRes = await fetch(url, {
      headers: { 'User-Agent': 'SweetPull/1.0' }
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(502).json({ error: 'Blockchair error: ' + errText.slice(0, 200) });
    }

    const json = await apiRes.json();
    const addrData = json?.data?.[LTC_ADDRESS];

    if (!addrData) {
      return res.status(200).json({ status: 'waiting' });
    }

    const txs = addrData.transactions || [];

    if (!txs.length) {
      return res.status(200).json({ status: 'waiting' });
    }

    let found = null;
    let pendingFound = false;

    for (const tx of txs) {
      // Blockchair zwraca wartość w satoshi (litoshi)
      // Szukamy outputów na nasz adres
      const received = (tx.balance_change > 0 ? tx.balance_change : 0) / 100000000;

      if (received <= 0) continue;

      const txTimeMs = tx.time ? new Date(tx.time).getTime() : 0;
      const afterSince = txTimeMs >= sinceMs - 10 * 60 * 1000; // 10 min margines

      const inRange = received >= (expected - tolerance) && received <= (expected + tolerance * 5);

      if (inRange && afterSince) {
        const confirmations = tx.confirmations || 0;
        if (confirmations >= 1) {
          found = { txid: tx.transaction_hash, received, confirmations };
          break;
        } else {
          pendingFound = true;
        }
      }
    }

    if (found) {
      return res.status(200).json({ status: 'confirmed', tx: found });
    } else if (pendingFound) {
      return res.status(200).json({ status: 'pending' });
    } else {
      return res.status(200).json({ status: 'waiting' });
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
