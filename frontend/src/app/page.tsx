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
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/news${selectedCategory !== 'all' ? `?category=${selectedCategory}` : ''}`)
      .then((res) => setNews(res.data))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text font-main flex flex-col" dir="rtl">
      {/* Header */}
      <header className="w-full bg-bg border-b border-accent py-4 px-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-accent">Topline</h1>
        <div className="flex items-center space-x-4">
          <span className="text-lg text-text/80">🕒 {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            className="bg-accent text-bg px-4 py-2 rounded-lg font-semibold text-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent"
            onClick={() => window.location.reload()}
            aria-label="רענן חדשות"
          >
            רענון
          </button>
        </div>
      </header>

      {/* Categories */}
      <nav className="w-full bg-bg border-b border-accent px-4 py-2 flex gap-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-4 py-2 rounded-full text-lg font-medium transition-colors duration-150
              ${selectedCategory === cat.key ? 'bg-accent text-bg' : 'bg-bg text-accent border border-accent'}`}
            aria-current={selectedCategory === cat.key ? 'page' : undefined}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      {/* News Feed */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-accent text-2xl mt-16 animate-pulse">טוען חדשות...</div>
        ) : news.length === 0 ? (
          <div className="text-center text-accent text-2xl mt-16">אין חדשות זמינות כרגע.</div>
        ) : (
          <ul className="space-y-8">
            {news.slice(0, 20).map((item, idx) => (
              <li key={item.url + idx} className="bg-bg border border-accent rounded-2xl p-6 shadow-lg">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block focus:outline-none focus:ring-2 focus:ring-accent">
                  <h2 className="text-2xl font-bold text-text mb-2 leading-snug">{item.title}</h2>
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
      <footer className="w-full bg-bg border-t border-accent py-4 text-center text-accent text-lg">
        Powered by Topline • מקורות: Ynet, Walla, Mako, N12
      </footer>
    </div>
  );
} 