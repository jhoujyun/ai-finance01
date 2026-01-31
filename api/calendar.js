// api/calendar.js - 經濟日曆 API（動態生成未來7天的重要事件 - v11 完美版）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    let BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
    if (BASE_URL.endsWith('/')) BASE_URL = BASE_URL.slice(0, -1);
    if (!BASE_URL.includes('/v1')) BASE_URL += '/v1';

    const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
    const today = new Date();

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
                content: '你是一個專業的財經分析助手。請根據日期生成未來7天內可能發生的重要全球經濟事件。'
              },
              {
                role: 'user',
                content: `請根據當前日期 ${today.toISOString().split('T')[0]} 生成未來7天內可能發生的重要全球經濟事件。請以 JSON 陣列格式回應，每個事件包含：date (YYYY-MM-DD), event (繁體中文), importance (high/medium), previous, forecast, aiAnalysis (50字分析)。`
              }
            ],
            temperature: 0.7
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices[0].message.content;
          const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const calendarEvents = JSON.parse(cleanedText);

          return res.status(200).json({
            success: true,
            events: calendarEvents
          });
        }
      } catch (e) {
        console.error('AI Calendar Error:', e);
      }
    }

    // 備用靜態數據
    return res.status(200).json({
      success: true,
      events: getStaticCalendar()
    });

  } catch (error) {
    res.status(200).json({ success: false, events: getStaticCalendar() });
  }
}

function getStaticCalendar() {
  const today = new Date();
  const events = [];
  const staticEvents = [
    { offset: 0, event: "美國初領失業金人數", importance: "high", previous: "21.2萬", forecast: "22萬", aiAnalysis: "若數據高於預期，利好股市。" },
    { offset: 1, event: "歐元區 CPI 年率終值", importance: "medium", previous: "2.4%", forecast: "2.4%", aiAnalysis: "通膨穩定支持降息預期。" },
    { offset: 3, event: "美國 GDP 季率初值", importance: "high", previous: "3.1%", forecast: "2.8%", aiAnalysis: "GDP 放緩符合軟著陸預期。" }
  ];
  staticEvents.forEach(e => {
    const d = new Date(today);
    d.setDate(today.getDate() + e.offset);
    events.push({ date: d.toISOString().split('T')[0], ...e });
  });
  return events;
}
