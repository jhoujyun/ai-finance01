// api/market.js - 獲取實時匯率與加密貨幣數據 (v13 穩定版 - 格式對齊)

let marketCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘快取

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now = Date.now();
    
    // 檢查快取
    if (marketCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
      return res.status(200).json({ success: true, data: marketCache });
    }

    const marketData = [];
    let hasError = false;

    // 1. 獲取匯率 (USD/TWD, USD/HKD, USD/JPY, USD/EUR)
    try {
      const rateRes = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        if (rateData.rates) {
          marketData.push(
            { name: 'USD/TWD', price: rateData.rates.TWD?.toFixed(2) || '31.50', change: 0.2 },
            { name: 'USD/HKD', price: rateData.rates.HKD?.toFixed(2) || '7.80', change: 0.1 },
            { name: 'USD/JPY', price: rateData.rates.JPY?.toFixed(2) || '150.20', change: -0.3 },
            { name: 'USD/EUR', price: (1 / (rateData.rates.EUR || 0.92)).toFixed(4) || '1.0870', change: 0.5 }
          );
        }
      }
    } catch (e) {
      console.error('匯率抓取失敗:', e.message);
      hasError = true;
      // 使用默認值
      marketData.push(
        { name: 'USD/TWD', price: '31.50', change: 0.2 },
        { name: 'USD/HKD', price: '7.80', change: 0.1 },
        { name: 'USD/JPY', price: '150.20', change: -0.3 },
        { name: 'USD/EUR', price: '1.0870', change: 0.5 }
      );
    }

    // 2. 獲取加密貨幣 (BTC, ETH)
    try {
      const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true', { signal: AbortSignal.timeout(5000) });
      if (cryptoRes.ok) {
        const cryptoData = await cryptoRes.json();
        if (cryptoData.bitcoin && cryptoData.ethereum) {
          marketData.push(
            { 
              name: 'BTC', 
              price: `$${cryptoData.bitcoin.usd?.toLocaleString() || '65000'}`, 
              change: cryptoData.bitcoin.usd_24h_change?.toFixed(2) || 2.5
            },
            { 
              name: 'ETH', 
              price: `$${cryptoData.ethereum.usd?.toLocaleString() || '3500'}`, 
              change: cryptoData.ethereum.usd_24h_change?.toFixed(2) || 1.8
            }
          );
        }
      }
    } catch (e) {
      console.error('加密貨幣抓取失敗:', e.message);
      hasError = true;
      // 使用默認值
      marketData.push(
        { name: 'BTC', price: '$65,000', change: 2.5 },
        { name: 'ETH', price: '$3,500', change: 1.8 }
      );
    }

    // 快取數據
    if (marketData.length > 0) {
      marketCache = marketData;
      cacheTimestamp = now;
    }

    res.status(200).json({ 
      success: true, 
      data: marketData.length > 0 ? marketData : getDefaultMarketData(),
      hasError: hasError
    });

  } catch (error) {
    console.error('市場數據 API 錯誤:', error);
    res.status(200).json({ 
      success: true, 
      data: getDefaultMarketData(),
      error: '使用默認數據'
    });
  }
}

function getDefaultMarketData() {
  return [
    { name: 'USD/TWD', price: '31.50', change: 0.2 },
    { name: 'USD/HKD', price: '7.80', change: 0.1 },
    { name: 'USD/JPY', price: '150.20', change: -0.3 },
    { name: 'USD/EUR', price: '1.0870', change: 0.5 },
    { name: 'BTC', price: '$65,000', change: 2.5 },
    { name: 'ETH', price: '$3,500', change: 1.8 }
  ];
}
