import React, { useState, useEffect } from 'react';
import { TrendingUp, Calculator, Calendar, Newspaper, Menu, X, Sparkles, RefreshCw, ExternalLink, Briefcase, BookOpen, Plus, Trash2, Info } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('news');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newsData, setNewsData] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [economicCalendar, setEconomicCalendar] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  // 市場數據狀態 (功能2)
  const [marketData, setMarketData] = useState(null);
  
  // 投資組合狀態 (功能3)
  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem('ai_portfolio');
    return saved ? JSON.parse(saved) : [];
  });
  const [newAsset, setNewAsset] = useState({ name: '', price: '', amount: '' });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 術語百科狀態 (功能4)
  const [searchTerm, setSearchTerm] = useState('');
  const [termResult, setTermResult] = useState(null);
  const [termLoading, setTermLoading] = useState(false);

  const [compoundInterest, setCompoundInterest] = useState({
    principal: 100000,
    rate: 7,
    years: 10,
    frequency: 12
  });
  
  const [retirementCalc, setRetirementCalc] = useState({
    currentAge: 30,
    retireAge: 60,
    monthlyExpense: 30000,
    currentSavings: 500000,
    monthlyContribution: 10000,
    returnRate: 9
  });

  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/market');
      const data = await response.json();
      if (data.success) setMarketData(data.data);
    } catch (error) {
      console.error('市場數據抓取錯誤:', error);
    }
  };

  const fetchNews = async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const response = await fetch('/api/news');
      const data = await response.json();
      if (data.success) setNewsData(data.news);
      else throw new Error(data.error || '抓取新聞失敗');
    } catch (error) {
      setNewsError(error.message);
    } finally {
      setNewsLoading(false);
    }
  };

  const fetchCalendar = async () => {
    setCalendarLoading(true);
    try {
      const response = await fetch('/api/calendar');
      const data = await response.json();
      if (data.success) setEconomicCalendar(data.events);
    } catch (error) {
      console.error('經濟日曆抓取錯誤:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    fetchCalendar();
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // 每分鐘更新一次匯率
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  // 投資組合邏輯
  const addAsset = () => {
    if (!newAsset.name || !newAsset.price) return;
    setPortfolio([...portfolio, { ...newAsset, id: Date.now() }]);
    setNewAsset({ name: '', price: '', amount: '' });
  };

  const removeAsset = (id) => {
    setPortfolio(portfolio.filter(a => a.id !== id));
  };

  const analyzePortfolio = async () => {
    if (portfolio.length === 0) return;
    setAnalyzing(true);
    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'portfolio_analysis', portfolio })
      });
      const data = await response.json();
      if (data.success) setAiAnalysis(data.result);
      else throw new Error(data.error);
    } catch (error) {
      setAiAnalysis("AI 分析暫時不可用，請稍後再試。");
    } finally {
      setAnalyzing(false);
    }
  };

  const lookupTerm = async () => {
    if (!searchTerm) return;
    setTermLoading(true);
    try {
      const localTerms = {
        "縮表": "指中央銀行減少資產負債表規模，通常是通過停止到期債券再投資來實現，屬於緊縮性貨幣政策。",
        "非農": "指美國非農就業人數數據，是觀察美國經濟健康狀況最重要的指標之一。",
        "CPI": "消費者物價指數，衡量通貨膨脹的主要指標。"
      };
      
      if (localTerms[searchTerm]) {
        setTermResult(localTerms[searchTerm]);
      } else {
        const response = await fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'wiki_lookup', term: searchTerm })
        });
        const data = await response.json();
        if (data.success) setTermResult(data.result);
        else throw new Error(data.error);
      }
    } catch (error) {
      setTermResult("查詢失敗，請稍後再試。");
    } finally {
      setTermLoading(false);
    }
  };

  const tabs = [
    { id: 'news', label: 'AI 新聞', icon: Newspaper },
    { id: 'portfolio', label: '投資組合', icon: Briefcase },
    { id: 'calendar', label: '經濟日曆', icon: Calendar },
    { id: 'wiki', label: '術語百科', icon: BookOpen },
    { id: 'calculator', label: '計算器', icon: Calculator }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 匯率看板 (功能2) */}
      <div className="bg-blue-900 text-white py-2 overflow-hidden whitespace-nowrap">
        <div className="inline-block animate-marquee px-4">
          {marketData ? (
            <div className="flex space-x-8 text-sm font-medium">
              <span>💵 USD/TWD: {marketData.rates.TWD.toFixed(2)}</span>
              <span>💴 USD/JPY: {marketData.rates.JPY.toFixed(2)}</span>
              <span>🪙 BTC: ${marketData.crypto.BTC.toLocaleString()}</span>
              <span>💎 ETH: ${marketData.crypto.ETH.toLocaleString()}</span>
              <span>📈 EUR/USD: {(1/marketData.rates.EUR).toFixed(4)}</span>
            </div>
          ) : (
            <span>載入實時市場數據中...</span>
          )}
        </div>
      </div>

      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">AI 財經工具站</h1>
          </div>
          
          <div className="hidden md:flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'news' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-yellow-500"/> AI 財經解讀</h2>
              <button onClick={fetchNews} className="p-2 hover:bg-slate-200 rounded-full transition"><RefreshCw className={newsLoading ? 'animate-spin' : ''}/></button>
            </div>
            {newsData.map(news => (
              <div key={news.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
                <div className="flex gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-600 rounded">{news.category}</span>
                  <span className="text-xs text-slate-400">{news.source} · {news.time}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{news.title}</h3>
                <p className="text-slate-600 text-sm mb-4">{news.summary}</p>
                <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-blue-500">
                  <p className="text-sm text-slate-700 leading-relaxed">{news.aiInsight}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">模擬投資組合</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <input placeholder="資產名稱 (如: 台積電)" className="p-2 border rounded-lg" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})}/>
                <input placeholder="買入價格" type="number" className="p-2 border rounded-lg" value={newAsset.price} onChange={e => setNewAsset({...newAsset, price: e.target.value})}/>
                <input placeholder="持有數量" type="number" className="p-2 border rounded-lg" value={newAsset.amount} onChange={e => setNewAsset({...newAsset, amount: e.target.value})}/>
                <button onClick={addAsset} className="bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"><Plus size={18}/> 新增資產</button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-slate-400 text-sm">
                      <th className="pb-3">資產</th>
                      <th className="pb-3">成本價</th>
                      <th className="pb-3">數量</th>
                      <th className="pb-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map(asset => (
                      <tr key={asset.id} className="border-b last:border-0">
                        <td className="py-4 font-bold">{asset.name}</td>
                        <td className="py-4">${Number(asset.price).toLocaleString()}</td>
                        <td className="py-4">{asset.amount}</td>
                        <td className="py-4"><button onClick={() => removeAsset(asset.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={18}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2 text-blue-800"><Sparkles size={18}/> AI 組合診斷</h3>
                  <button onClick={analyzePortfolio} disabled={analyzing} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 disabled:opacity-50">
                    {analyzing ? '分析中...' : '開始診斷'}
                  </button>
                </div>
                {aiAnalysis ? (
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
                ) : (
                  <p className="text-slate-400 text-sm italic">添加資產後點擊診斷，AI 將為您的組合提供專業建議。</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">經濟日曆</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {economicCalendar.map((day, idx) => (
                <div key={idx} className="border-b last:border-0">
                  <div className="bg-slate-50 px-6 py-3 font-bold text-slate-700">{day.date}</div>
                  <div className="divide-y">
                    {day.events.map((event, eIdx) => (
                      <div key={eIdx} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-500">{event.time}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              event.impact === '高' ? 'bg-red-100 text-red-600' : 
                              event.impact === '中' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                            }`}>{event.impact}影響</span>
                          </div>
                          <div className="font-bold text-slate-800">{event.event}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">預測/前值</div>
                          <div className="text-sm font-medium text-slate-600">{event.forecast} / {event.previous}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'wiki' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">財經術語百科</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex gap-3 mb-8">
                <input 
                  placeholder="輸入術語 (如: 縮表, CPI, 降息...)" 
                  className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && lookupTerm()}
                />
                <button onClick={lookupTerm} disabled={termLoading} className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  {termLoading ? '查詢中...' : '查詢'}
                </button>
              </div>
              
              {termResult ? (
                <div className="bg-slate-50 p-6 rounded-2xl border-l-4 border-blue-500 animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="font-bold text-lg mb-3 text-blue-900">{searchTerm}</h3>
                  <p className="text-slate-700 leading-relaxed">{termResult}</p>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-20"/>
                  <p>輸入您想了解的財經術語，AI 為您深度解析。</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Calculator className="text-blue-600"/> 複利計算器</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">初始本金</label>
                  <input type="number" className="w-full p-2 border rounded-lg" value={compoundInterest.principal} onChange={e => setCompoundInterest({...compoundInterest, principal: Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">年化收益率 (%)</label>
                  <input type="number" className="w-full p-2 border rounded-lg" value={compoundInterest.rate} onChange={e => setCompoundInterest({...compoundInterest, rate: Number(e.target.value)})}/>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">投資年限</label>
                  <input type="number" className="w-full p-2 border rounded-lg" value={compoundInterest.years} onChange={e => setCompoundInterest({...compoundInterest, years: Number(e.target.value)})}/>
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                  <div className="text-sm text-blue-600 mb-1">預期總資產</div>
                  <div className="text-2xl font-bold text-blue-900">
                    ${Math.round(compoundInterest.principal * Math.pow(1 + (compoundInterest.rate/100), compoundInterest.years)).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Briefcase className="text-green-600"/> 退休金試算</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">目前年齡</label>
                    <input type="number" className="w-full p-2 border rounded-lg" value={retirementCalc.currentAge} onChange={e => setRetirementCalc({...retirementCalc, currentAge: Number(e.target.value)})}/>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">預計退休</label>
                    <input type="number" className="w-full p-2 border rounded-lg" value={retirementCalc.retireAge} onChange={e => setRetirementCalc({...retirementCalc, retireAge: Number(e.target.value)})}/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">退休後每月支出</label>
                  <input type="number" className="w-full p-2 border rounded-lg" value={retirementCalc.monthlyExpense} onChange={e => setRetirementCalc({...retirementCalc, monthlyExpense: Number(e.target.value)})}/>
                </div>
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <div className="text-sm text-green-600 mb-1">所需退休金總額</div>
                  <div className="text-2xl font-bold text-green-900">
                    ${(retirementCalc.monthlyExpense * 12 * 25).toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600 mt-1">* 基於 4% 提領率估算</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t mt-12 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2026 AI 財經工具站 · 數據僅供參考，不構成投資建議</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
