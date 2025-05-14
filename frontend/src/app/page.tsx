'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  image_url: string | null;
  published_at: string;
  type: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://toplinebackend1.vercel.app';

const CATEGORIES = [
  { key: 'all', label: 'הכל' },
  { key: 'politics', label: 'פוליטיקה' },
  { key: 'business', label: 'עסקים' },
  { key: 'technology', label: 'טכנולוגיה' },
  { key: 'sports', label: 'ספורט' },
  { key: 'entertainment', label: 'בידור' },
  { key: 'health', label: 'בריאות' },
  { key: 'science', label: 'מדע' },
];

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [trending, setTrending] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [now, setNow] = useState(new Date());
  const [newsError, setNewsError] = useState<string | null>(null);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setNewsError(null);
    axios
      .get(`${API_URL}/api/news${selectedCategory !== 'all' ? `?category=${selectedCategory}` : ''}`)
      .then((res) => setNews(res.data))
      .catch((err) => {
        setNews([]);
        setNewsError(err?.message || 'News fetch error');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    setTrendingError(null);
    axios
      .get(`${API_URL}/api/trending`)
      .then((res) => setTrending(res.data))
      .catch((err) => {
        setTrending([]);
        setTrendingError(err?.message || 'Trending fetch error');
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-bg via-[#202a3a] to-[#232d3e] text-text font-main flex flex-col items-center justify-start px-2 sm:px-0"
      dir="rtl"
    >
      {/* Header */}
      <header className="w-full max-w-2xl mx-auto sticky top-0 z-50 bg-bg/80 backdrop-blur border-b border-accent py-6 px-4 flex flex-col items-center shadow-lg rounded-b-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-accent drop-shadow-lg mb-2 animate-pulse">Topline</h1>
        <div className="flex items-center gap-4 text-lg text-text/80">
          <span>🕒 {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            className="bg-accent text-bg px-5 py-2 rounded-xl font-bold text-lg shadow hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent transition"
            onClick={() => window.location.reload()}
            aria-label="רענן חדשות"
          >
            רענון
          </button>
        </div>
        {/* Categories */}
        <nav className="w-full flex flex-wrap justify-center gap-2 mt-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-5 py-2 rounded-full text-lg font-semibold transition-colors duration-150 shadow
                ${selectedCategory === cat.key ? 'bg-accent text-bg' : 'bg-bg/70 text-accent border border-accent hover:bg-accent/20'}`}
              aria-current={selectedCategory === cat.key ? 'page' : undefined}
              style={{ outline: selectedCategory === cat.key ? '2px solid #3ED6C1' : 'none' }}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Trending Section */}
      <section className="w-full max-w-2xl mx-auto mt-8 mb-4">
        {trendingError ? (
          <div className="text-center text-red-400 text-lg">שגיאה בטעינת טרנדים: {trendingError}</div>
        ) : trending.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-accent mb-4 text-center">הכי חם עכשיו</h2>
            <ul className="flex flex-col gap-4">
              {trending.slice(0, 5).map((item, idx) => (
                <li
                  key={item.url + idx}
                  className="bg-white/10 backdrop-blur-lg border border-accent/30 rounded-2xl p-5 shadow-xl transition hover:scale-[1.02] hover:border-accent/60 focus-within:ring-2 focus-within:ring-accent"
                  style={{ animation: `fadeIn 0.6s ${idx * 0.08}s both` }}
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                    <h3 className="text-xl sm:text-2xl font-bold text-text mb-1 leading-snug">{item.title}</h3>
                    <div className="flex items-center gap-2 text-accent text-lg mb-1">
                      <span>{item.source}</span>
                      {item.published_at && <span>• {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* News Feed */}
      <main className="flex-1 w-full max-w-2xl mx-auto pb-8">
        {newsError ? (
          <div className="text-center text-red-400 text-lg mt-16">שגיאה בטעינת חדשות: {newsError}</div>
        ) : loading ? (
          <div className="text-center text-accent text-2xl mt-16 animate-pulse">טוען חדשות...</div>
        ) : news.length === 0 ? (
          <div className="text-center text-accent text-2xl mt-16">אין חדשות זמינות כרגע.</div>
        ) : (
          <ul className="space-y-8">
            {news.slice(0, 20).map((item, idx) => (
              <li
                key={item.url + idx}
                className="bg-white/10 backdrop-blur-lg border border-accent/30 rounded-2xl p-6 shadow-xl transition hover:scale-[1.01] hover:border-accent/60 focus-within:ring-2 focus-within:ring-accent"
                style={{ animation: `fadeIn 0.7s ${idx * 0.05 + 0.4}s both` }}
              >
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                  <h2 className="text-2xl sm:text-3xl font-bold text-text mb-2 leading-snug">{item.title}</h2>
                  <div className="flex items-center gap-2 text-accent text-lg mb-1">
                    <span>{item.source}</span>
                    {item.published_at && <span>• {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl mx-auto bg-bg/80 backdrop-blur border-t border-accent py-6 text-center text-accent text-lg rounded-t-2xl shadow-lg mt-8">
        Powered by Topline • מקורות: Ynet, Walla, Mako, N12
      </footer>

      {/* Fade-in animation keyframes */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
} 