// api/news.js - 帶快取和成本控制的新聞抓取 API (v12 穩定版 - 解決 Vercel 超時問題)

let newsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; 
const MAX_DAILY_REQUESTS = 50; 
let dailyRequestCount = 0;
let lastResetDate = new Date().toDateString();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    let BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
    if (BASE_URL.endsWith('/')) BASE_URL = BASE_URL.slice(0, -1);
    if (!BASE_URL.includes('/v1')) BASE_URL += '/v1';

    const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

    if (!NEWS_API_KEY) throw new Error('未設定 NEWS_API_KEY');

    // 1. 從 NewsAPI 抓取新聞（抓取 9 篇）
    const newsResponse = await fetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=9&apiKey=${NEWS_API_KEY}`);
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
      
      const processingPromises = articles.slice(0, 9).map((article, index) => 
        processSingleArticle(article, index, BASE_URL, OPENAI_API_KEY, MODEL)
      );

      // 使用 Promise.allSettled 確保即使部分失敗，其他成功的也能返回
      const results = await Promise.allSettled(processingPromises);
      
      processedNews = results.map((result, index) => {
        const originalArticle = articles[index];
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
          return createFallbackNews([originalArticle], `AI 處理失敗: ${result.reason.message || '未知錯誤'}`)[0];
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
      response_format: { type: "json_object" } // 確保返回 JSON 對象
    }),
    // 設置一個短的超時，例如 8 秒，以確保 Vercel 函數不會超時
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
  // 移除可能的 markdown 標記，並確保是 JSON 對象
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
    title: article.title, // 失敗時保留英文標題
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
