// api/check-payment.js (Vercel Serverless Function)
// Sprawdza potwierdzenia LTC przez NOWNodes Blockbook

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const LTC_ADDRESS = 'LVieH7KeRB6CG6ya7nEpGFqc5quq61VCtV';
  const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY;

  if (!NOWNODES_API_KEY) {
    return res.status(500).json({ error: 'Brak klucza NOWNODES_API_KEY' });
  }

  const { ltcAmount, toleranceLtc, since } = req.query;
  if (!ltcAmount || !since) {
    return res.status(400).json({ error: 'Brak parametrów' });
  }

  const expected = parseFloat(ltcAmount);
  const tolerance = parseFloat(toleranceLtc || '0.0008');
  const sinceMs = parseInt(since, 10) * 1000;

  try {
    const apiUrl = `https://ltcbook.nownodes.io/api/v2/address/${LTC_ADDRESS}?details=txs&pageSize=20`;
    const apiRes = await fetch(apiUrl, { headers: { 'api-key': NOWNODES_API_KEY } });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(502).json({ error: 'NOWNodes error: ' + errText });
    }

    const data = await apiRes.json();
    const txs = data.transactions || [];

    if (!txs.length) {
      return res.status(200).json({ status: 'waiting' });
    }

    let found = null;
    let pendingFound = false;

    for (const tx of txs) {
      let receivedLitoshi = 0;
      const vouts = tx.vout || [];
      for (const out of vouts) {
        if (out.addresses && out.addresses.includes(LTC_ADDRESS)) {
          receivedLitoshi += parseInt(out.value || '0', 10);
        }
      }
      const received = receivedLitoshi / 100000000;

      const txTimeMs = (tx.blockTime || 0) * 1000;
      const afterSince = txTimeMs >= sinceMs - 10 * 60 * 1000;

      const inRange = received >= (expected - tolerance) && received <= (expected + tolerance * 5);

      if (inRange && afterSince) {
        const confirmations = tx.confirmations || 0;
        if (confirmations >= 1) {
          found = { txid: tx.txid, received, confirmations };
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
