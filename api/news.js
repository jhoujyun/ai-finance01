// api/news.js - 帶快取和成本控制的新聞抓取 API (v14 專業版 - 修復 429 限流)

let newsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; 
const MAX_DAILY_REQUESTS = 50; 
let dailyRequestCount = 0;
let lastResetDate = new Date().toDateString();

// 術語百科快取
let terminologyCache = {};
const TERMINOLOGY_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 小時

// 熱門術語預定義（避免 API 調用）
const POPULAR_TERMS = {
  '縮表': '央行減少資產負債表規模，通常通過不再購買新的資產或讓現有資產到期而不再購買來實現。這是一種緊縮貨幣政策工具。',
  '非農': '美國非農就業人數，是衡量美國就業市場健康狀況的重要經濟指標。每月首週五發布，對美元和股市影響重大。',
  '降息': '央行降低基準利率，使借貸成本下降，促進經濟增長。通常在經濟衰退或通脹下降時進行。',
  '升息': '央行提高基準利率，使借貸成本上升，抑制通脹。通常在經濟過熱或通脹上升時進行。',
  'QE': '量化寬鬆政策，央行通過購買長期資產來增加貨幣供應量，降低長期利率。',
  'CPI': '消費者物價指數，衡量消費者購買商品和服務的平均價格變化，是衡量通脹的重要指標。',
  'GDP': '國內生產總值，衡量一個國家在特定時期內生產的所有商品和服務的總價值。',
  '熊市': '股票市場持續下跌的時期，投資者信心低落，通常下跌 20% 以上。',
  '牛市': '股票市場持續上升的時期，投資者信心高漲，通常上升 20% 以上。',
  '回購': '公司用現金買回自己的股票，減少流通股數，通常用於提高每股收益或穩定股價。'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    let BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
    if (BASE_URL.endsWith('/')) BASE_URL = BASE_URL.slice(0, -1);
    if (!BASE_URL.includes('/v1')) BASE_URL += '/v1';
    const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

    // --- 術語百科查詢邏輯 (v14 - 增加快取和熱門術語) ---
    if (req.query.term) {
      const term = req.query.term.trim();
      
      // 1. 檢查熱門術語庫
      if (POPULAR_TERMS[term]) {
        return res.status(200).json({ success: true, explanation: POPULAR_TERMS[term] });
      }

      // 2. 檢查快取
      if (terminologyCache[term] && terminologyCache[term].timestamp && (Date.now() - terminologyCache[term].timestamp < TERMINOLOGY_CACHE_DURATION)) {
        return res.status(200).json({ success: true, explanation: terminologyCache[term].explanation });
      }

      // 3. 調用 AI API（帶重試機制）
      if (!OPENAI_API_KEY) {
        return res.status(200).json({ success: false, error: '缺少 OPENAI_API_KEY' });
      }

      return await handleTerminologySearchWithRetry(term, BASE_URL, OPENAI_API_KEY, MODEL, res, 3);
    }
    // --- 術語百科查詢邏輯結束 ---

    const currentDate = new Date().toDateString();
    if (currentDate !== lastResetDate) {
      dailyRequestCount = 0;
      lastResetDate = currentDate;
    }

    const now = Date.now();
    if (newsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
      return res.status(200).json({ success: true, news: newsCache, timestamp: new Date(cacheTimestamp).toISOString(), fromCache: true });
    }

    if (dailyRequestCount >= MAX_DAILY_REQUESTS) {
      return res.status(200).json({ success: true, news: newsCache || getDefaultNews(), timestamp: new Date().toISOString(), fromCache: true, message: '已達每日更新上限' });
    }

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!NEWS_API_KEY) throw new Error('未設定 NEWS_API_KEY');

    // 1. 從 NewsAPI 抓取新聞（抓取更多，以備不時之需）
    const newsResponse = await fetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=12&apiKey=${NEWS_API_KEY}`);
    if (!newsResponse.ok) throw new Error(`NewsAPI 錯誤: ${newsResponse.status}`);
    const newsData = await newsResponse.json();
    const articles = newsData.articles || [];
    if (articles.length === 0) throw new Error('未獲取到新聞內容');

    if (newsCache && articlesAreSame(articles, newsCache)) {
      cacheTimestamp = now;
      return res.status(200).json({ success: true, news: newsCache, timestamp: new Date().toISOString(), fromCache: true });
    }

    // 2. AI 處理 (改為 Promise.all 並行處理，避免 Vercel 超時)
    let processedNews;
    if (OPENAI_API_KEY) {
      dailyRequestCount++; // 每次更新只算一次總請求
      
      // 確保至少有 9 篇文章用於處理，不足則用空對象填充
      const articlesToProcess = Array(9).fill(null).map((_, i) => articles[i] || { title: `Placeholder ${i+1}`, description: `No content for placeholder ${i+1}`, source: { name: 'System' }, publishedAt: new Date().toISOString(), url: '#' });

      const processingPromises = articlesToProcess.map((article, index) => 
        processSingleArticle(article, index, BASE_URL, OPENAI_API_KEY, MODEL)
      );

      // 使用 Promise.allSettled 確保即使部分失敗，其他成功的也能返回
      const results = await Promise.allSettled(processingPromises);
      
      processedNews = results.map((result, index) => {
        const originalArticle = articlesToProcess[index]; // 使用 articlesToProcess 來獲取原始文章
        if (result.status === 'fulfilled') {
          return {
            id: index + 1,
            title: result.value.title,
            source: originalArticle.source.name,
            time: getRelativeTime(originalArticle.publishedAt),
            summary: result.value.summary,
            aiInsight: result.value.aiInsight,
            category: result.value.category,
            url: originalArticle.url,
            image: originalArticle.urlToImage,
            originalTitle: originalArticle.title
          };
        } else {
          // 處理失敗，使用原始數據作為回退
          console.error(`處理新聞 ${index + 1} 失敗:`, result.reason);
          return createFallbackNews([originalArticle], `AI 處理失敗: ${result.reason?.message || '未知錯誤'}`)[0];
        }
      });

    } else {
      processedNews = createFallbackNews(articles, '缺少 OPENAI_API_KEY');
    }

    newsCache = processedNews;
    cacheTimestamp = now;
    res.status(200).json({ success: true, news: processedNews, timestamp: new Date().toISOString(), fromCache: false });

  } catch (error) {
    res.status(200).json({ success: false, error: error.message, news: newsCache || getDefaultNews(), timestamp: new Date().toISOString(), fromCache: true });
  }
}

// 帶重試機制的術語查詢
async function handleTerminologySearchWithRetry(term, BASE_URL, OPENAI_API_KEY, MODEL, res, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const apiUrl = `${BASE_URL}/chat/completions`;
      const aiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: '你是一個專業的財經術語百科助手。請用繁體中文解釋用戶提供的財經術語。' },
            { role: 'user', content: `請用繁體中文，以專業、簡潔的方式解釋財經術語：${term}。回應格式：{"explanation":"[繁體中文解釋]"}。` }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
        signal: AbortSignal.timeout(8000)
      });

      // 如果遇到 429，等待後重試
      if (aiResponse.status === 429) {
        if (attempt < retries - 1) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指數退避：1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          return res.status(200).json({ success: false, error: '服務暫時繁忙，請稍後重試' });
        }
      }

      if (!aiResponse.ok) {
        throw new Error(`AI API 錯誤 (${aiResponse.status})`);
      }

      const aiData = await aiResponse.json();
      const responseText = aiData.choices[0].message.content;
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedText);
        // 快取結果
        terminologyCache[term] = {
          explanation: parsed.explanation,
          timestamp: Date.now()
        };
        return res.status(200).json({ success: true, explanation: parsed.explanation });
      } catch (e) {
        return res.status(200).json({ success: false, error: 'AI 返回格式錯誤' });
      }

    } catch (error) {
      console.error(`術語查詢嘗試 ${attempt + 1} 失敗:`, error.message);
      if (attempt === retries - 1) {
        return res.status(200).json({ success: false, error: `術語查詢失敗: ${error.message}` });
      }
    }
  }
}

async function processSingleArticle(article, index, BASE_URL, OPENAI_API_KEY, MODEL) {
  const apiUrl = `${BASE_URL}/chat/completions`;
  const articleContent = article.description || article.content?.substring(0, 200) || '';

  const aiResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一個專業的財經翻譯和分析助手。請將新聞翻譯成繁體中文，並提供投資解讀。請以 JSON 格式回應，不要包含 markdown 標記。' },
        { role: 'user', content: `請將以下新聞翻譯成繁體中文，並提供 AI 投資解讀。回應格式：{"title":"[繁體中文標題]","summary":"[繁體中文摘要]","aiInsight":"[繁體中文投資解讀]","category":"[繁體中文類別]"}。新聞內容:\n標題: ${article.title}\n摘要: ${articleContent}\n來源: ${article.source.name}` }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(8000) 
  });

  if (!aiResponse.ok) {
    const errorDetail = await aiResponse.text();
    if (errorDetail.includes('<!DOCTYPE html>')) {
      throw new Error(`被 Cloudflare 攔截。請檢查中轉站地址。`);
    }
    throw new Error(`AI API 錯誤 (${aiResponse.status}): ${errorDetail.substring(0, 50)}`);
  }

  const aiData = await aiResponse.json();
  const responseText = aiData.choices[0].message.content;
  const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    throw new Error(`JSON 解析失敗: ${e.message}. 原始響應: ${cleanedText.substring(0, 100)}`);
  }
}

function articlesAreSame(newArticles, cachedNews) {
  if (!cachedNews || newArticles.length !== cachedNews.length) return false;
  return newArticles.every((article, i) => cachedNews[i] && article.title === cachedNews[i].originalTitle);
}

function createFallbackNews(articles, errorMessage = '') {
  return articles.slice(0, 9).map((article, index) => ({
    id: index + 1,
    title: article.title,
    source: article.source.name,
    time: getRelativeTime(article.publishedAt),
    summary: article.description || '請點擊閱讀原文查看詳情',
    aiInsight: `💡 AI 處理失敗: ${errorMessage}`,
    category: '系統提示',
    url: article.url,
    image: article.urlToImage,
    originalTitle: article.title
  }));
}

function getDefaultNews() {
  return [{ id: 1, title: "系統訊息", source: "系統", time: "現在", summary: "請檢查環境變量設定。", aiInsight: "💡 提示：請確保 API_BASE_URL 正確。", category: "系統", url: "#" }];
}

function getRelativeTime(publishedAt) {
  const now = new Date();
  const published = new Date(publishedAt);
  const diffMs = now - published;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return '剛剛';
  if (diffHours < 24) return `${diffHours}小時前`;
  return published.toLocaleDateString('zh-TW');
}
