// api/market.js - 獲取實時匯率與加密貨幣數據 (不消耗 AI Token)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. 獲取匯率 (USD/TWD, USD/HKD, USD/JPY)
    const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
    const rateData = await rateRes.json();
    
    // 2. 獲取加密貨幣 (BTC, ETH)
    const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const cryptoData = await cryptoRes.json();

    const marketData = {
      rates: {
        TWD: rateData.rates.TWD,
        HKD: rateData.rates.HKD,
        JPY: rateData.rates.JPY,
        EUR: rateData.rates.EUR
      },
      crypto: {
        BTC: cryptoData.bitcoin.usd,
        ETH: cryptoData.ethereum.usd
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json({ success: true, data: marketData });
  } catch (error) {
    console.error('市場數據抓取失敗:', error);
    res.status(200).json({ 
      success: false, 
      error: '數據更新中',
      data: {
        rates: { TWD: 31.5, HKD: 7.8, JPY: 150.2, EUR: 0.92 },
        crypto: { BTC: 65000, ETH: 3500 }
      }
    });
  }
}
