import React, { useState, useEffect } from 'react';
import { 
  Newspaper, Calendar, TrendingUp, BookOpen, RefreshCw, 
  ChevronRight, AlertCircle, Globe, DollarSign, PieChart, Search, Plus, Trash2
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('news');
  const [news, setNews] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portfolio, setPortfolio] = useState(() => JSON.parse(localStorage.getItem('portfolio') || '[]'));
  const [searchTerm, setSearchTerm] = useState('');
  const [termResult, setTermResult] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchNews(), fetchCalendar(), fetchMarketData()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async () => {
    const res = await fetch('/api/news');
    const data = await res.json();
    if (data.success) setNews(data.news);
  };

  const fetchCalendar = async () => {
    const res = await fetch('/api/calendar');
    const data = await res.json();
    if (data.success) setCalendar(data.events);
  };

  const fetchMarketData = async () => {
    try {
      const res = await fetch('/api/market');
      const data = await res.json();
      if (data.success) setMarketData(data.data);
    } catch (e) { console.error(e); }
  };

  const handleSearchTerm = async () => {
    if (!searchTerm) return;
    setTermResult({ loading: true });
    try {
      const res = await fetch(`/api/news?term=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      setTermResult(data);
    } catch (e) { setTermResult({ error: '查詢失敗' }); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Market Ticker */}
      <div className="bg-slate-900 text-white py-2 overflow-hidden whitespace-nowrap border-b border-slate-700">
        <div className="inline-block animate-marquee">
          {marketData.map((item, i) => (
            <span key={i} className="mx-6 text-sm font-medium">
              <span className="text-slate-400">{item.name}:</span> 
              <span className={item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {item.price} ({item.change >= 0 ? '+' : ''}{item.change}%)
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">AI 全球財經終端</h1>
          </div>
          <nav className="flex space-x-1">
            {[
              { id: 'news', icon: Newspaper, label: '即時新聞' },
              { id: 'calendar', icon: Calendar, label: '經濟日曆' },
              { id: 'portfolio', icon: PieChart, label: '投資組合' },
              { id: 'wiki', icon: BookOpen, label: '術語百科' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
          <button onClick={fetchData} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'news' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
                <div className="p-5 flex-grow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-md uppercase tracking-wider">
                      {item.category || '財經新聞'}
                    </span>
                    <span className="text-xs text-slate-400">{item.time}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-3 leading-snug group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-4">{item.description}</p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center text-indigo-600 mb-2">
                      <TrendingUp className="w-4 h-4 mr-1.5" />
                      <span className="text-xs font-bold uppercase tracking-widest">AI 深度解讀</span>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{item.aiAnalysis}</p>
                  </div>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <a href={item.url} target="_blank" className="text-xs font-bold text-indigo-600 hover:underline flex items-center">
                    閱讀原文 <ChevronRight className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {calendar.map((day, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                  <h3 className="font-bold text-slate-700 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-indigo-600" />
                    {day.date}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {day.events ? day.events.map((ev, j) => (
                    <div key={j} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-sm font-mono text-slate-400 mr-3">{ev.time}</span>
                          <span className="font-bold text-slate-800">{ev.event}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ev.impact === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {ev.impact === 'high' ? '高影響' : '中影響'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">預測值</div>
                          <div className="text-sm font-bold text-slate-700">{ev.forecast || '--'}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">前值</div>
                          <div className="text-sm font-bold text-slate-700">{ev.previous || '--'}</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-slate-800">{day.event}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          day.importance === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {day.importance === 'high' ? '高影響' : '中影響'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100 italic">
                        {day.aiAnalysis}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <PieChart className="w-6 h-6 mr-2 text-indigo-600" />
                我的模擬投資組合
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <input id="p-name" placeholder="資產名稱 (如 BTC, TSLA)" className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input id="p-price" type="number" placeholder="買入價格" className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <button 
                  onClick={() => {
                    const n = document.getElementById('p-name').value;
                    const p = document.getElementById('p-price').value;
                    if(n && p) setPortfolio([...portfolio, { name: n, price: p }]);
                  }}
                  className="bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-1" /> 添加資產
                </button>
              </div>
              <div className="space-y-3">
                {portfolio.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="ml-4 text-sm text-slate-500">買入價: ${item.price}</span>
                    </div>
                    <button onClick={() => setPortfolio(portfolio.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wiki' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
                財經術語百科
              </h2>
              <div className="flex space-x-2 mb-8">
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="輸入術語 (如: 縮表, 非農, 降息)" 
                  className="flex-grow px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
                <button onClick={handleSearchTerm} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                  查詢
                </button>
              </div>
              {termResult && (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                  {termResult.loading ? (
                    <div className="flex items-center justify-center py-8"><RefreshCw className="animate-spin text-indigo-600" /></div>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-indigo-600 mb-3">{searchTerm}</h3>
                      <p className="text-slate-700 leading-relaxed">{termResult.explanation}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p>© 2026 AI 全球財經終端. Powered by Advanced AI Models.</p>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
