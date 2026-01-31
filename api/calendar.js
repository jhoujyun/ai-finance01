// api/calendar.js - 經濟日曆 API（v13 穩定版 - 強化容錯與數據結構）

let calendarCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 小時快取

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const now = Date.now();
    
    // 檢查快取
    if (calendarCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
      return res.status(200).json({ success: true, events: calendarCache, fromCache: true });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    let BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
    if (BASE_URL.endsWith('/')) BASE_URL = BASE_URL.slice(0, -1);
    if (!BASE_URL.includes('/v1')) BASE_URL += '/v1';

    const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
    const today = new Date();

    let events = [];

    if (OPENAI_API_KEY) {
      try {
        const apiUrl = `${BASE_URL}/chat/completions`;
        const aiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content: '你是一個專業的財經分析助手。請生成未來7天內可能發生的重要全球經濟事件，以 JSON 陣列格式回應。'
              },
              {
                role: 'user',
                content: `當前日期: ${today.toISOString().split('T')[0]}。請生成未來7天內的重要經濟事件。每個事件必須包含以下字段（使用繁體中文）：
- date: YYYY-MM-DD 格式
- event: 事件名稱
- time: HH:MM 格式（如 14:30）
- impact: high 或 medium
- previous: 前值
- forecast: 預測值
- aiAnalysis: 50字以內的分析

回應格式必須是有效的 JSON 陣列，例如：[{"date":"2026-02-01","event":"美國初領失業金","time":"20:30","impact":"high","previous":"21.2萬","forecast":"22萬","aiAnalysis":"數據高於預期將利好股市"}]`
              }
            ],
            temperature: 0.5,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices[0].message.content;
          const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          try {
            const parsed = JSON.parse(cleanedText);
            // 確保返回的是陣列
            events = Array.isArray(parsed) ? parsed : (parsed.events || parsed.data || []);
            
            // 驗證每個事件的必要字段
            events = events.map(e => ({
              date: e.date || new Date().toISOString().split('T')[0],
              event: e.event || '未知事件',
              time: e.time || '00:00',
              impact: e.impact === 'high' ? 'high' : 'medium',
              previous: e.previous || '--',
              forecast: e.forecast || '--',
              aiAnalysis: e.aiAnalysis || '暫無分析'
            }));

            if (events.length > 0) {
              calendarCache = events;
              cacheTimestamp = now;
              return res.status(200).json({ success: true, events: events, fromCache: false });
            }
          } catch (parseError) {
            console.error('Calendar JSON 解析失敗:', parseError);
          }
        }
      } catch (e) {
        console.error('AI Calendar 請求失敗:', e.message);
      }
    }

    // 備用靜態數據
    events = getStaticCalendar();
    calendarCache = events;
    cacheTimestamp = now;
    return res.status(200).json({ success: true, events: events, fromCache: true, fallback: true });

  } catch (error) {
    console.error('Calendar API 錯誤:', error);
    const fallbackEvents = getStaticCalendar();
    res.status(200).json({ success: true, events: fallbackEvents, fallback: true });
  }
}

function getStaticCalendar() {
  const today = new Date();
  const events = [];
  
  const staticEvents = [
    { offset: 0, event: "美國初領失業金人數", time: "20:30", impact: "high", previous: "21.2萬", forecast: "22萬", aiAnalysis: "若數據高於預期，利好股市。" },
    { offset: 1, event: "歐元區 CPI 年率終值", time: "10:00", impact: "medium", previous: "2.4%", forecast: "2.4%", aiAnalysis: "通膨穩定支持降息預期。" },
    { offset: 2, event: "英國 GDP 季率初值", time: "09:00", impact: "high", previous: "0.1%", forecast: "0.2%", aiAnalysis: "英國經濟緩慢復甦，利好英鎊。" },
    { offset: 3, event: "美國 GDP 季率初值", time: "13:30", impact: "high", previous: "3.1%", forecast: "2.8%", aiAnalysis: "GDP 放緩符合軟著陸預期。" },
    { offset: 4, event: "日本失業率", time: "08:30", impact: "medium", previous: "2.4%", forecast: "2.5%", aiAnalysis: "日本勞動市場保持穩定。" },
    { offset: 5, event: "加拿大零售銷售", time: "13:30", impact: "medium", previous: "-0.2%", forecast: "0.1%", aiAnalysis: "消費者支出溫和改善。" },
    { offset: 6, event: "澳大利亞 CPI 季率", time: "11:30", impact: "high", previous: "0.4%", forecast: "0.3%", aiAnalysis: "通膨下降支持澳儲行降息。" }
  ];

  staticEvents.forEach(e => {
    const d = new Date(today);
    d.setDate(today.getDate() + e.offset);
    events.push({
      date: d.toISOString().split('T')[0],
      event: e.event,
      time: e.time,
      impact: e.impact,
      previous: e.previous,
      forecast: e.forecast,
      aiAnalysis: e.aiAnalysis
    });
  });

  return events;
}
