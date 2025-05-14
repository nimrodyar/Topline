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

// Smart Hebrew title truncator
function truncateHebrewTitle(title: string, maxLength: number = 60): string {
  if (title.length <= maxLength) return title;
  // Try to cut at a word boundary
  let truncated = title.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
  return truncated + '...';
}

// NewsCard component for both trending and news
function NewsCard({ item }: { item: NewsItem }) {
  const fallbackImg = '/fallback-news.gif';
  const [imgError, setImgError] = useState(false);
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl group transition-transform hover:scale-105 bg-gray-200 border border-accent/30 aspect-[4/3] flex flex-col justify-end max-w-xs mx-auto">
      <img
        src={imgError || !item.image_url ? fallbackImg : item.image_url}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover object-center z-0 transition-opacity duration-300 bg-gray-200 border-b-4 border-accent"
        onError={() => setImgError(true)}
        style={{ minHeight: 0 }}
      />
      {/* Overlay for title and source, at the bottom */}
      <div className="relative z-10 w-full flex flex-col items-center justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-4 px-4 min-h-[80px]">
        <span className="w-full text-center text-xl font-bold text-white block mb-1 truncate" style={{ textShadow: '0 2px 8px #000' }}>
          {truncateHebrewTitle(item.title)}
        </span>
        <div className="mt-1 text-accent text-md bg-bg/80 px-3 py-1 rounded-full shadow">
          {item.source}
        </div>
      </div>
      {/* Debug overlay for image URL (visible on hover) */}
      <div className="absolute left-2 bottom-2 z-30 text-xs text-white bg-black/70 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-all">
        {item.image_url}
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-40" aria-label={item.title}></a>
    </div>
  );
}

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
        <img src="/logo.png" alt="Topline Logo" className="h-32 w-auto mb-2 drop-shadow-lg" />
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
              style={{ outline: selectedCategory === cat.key ? '2px solid #3ED6C1' : 'none', cursor: 'pointer' }}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Trending Section as Grid (identical to news grid) */}
      <section className="w-full max-w-6xl mx-auto mt-8 mb-4">
        {trendingError ? (
          <div className="text-center text-red-400 text-lg">שגיאה בטעינת טרנדים: {trendingError}</div>
        ) : trending.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-accent mb-4 text-center">הכי חם עכשיו</h2>
            <div className="flex flex-wrap justify-center gap-8">
              {trending.slice(0, 3).map((item, idx) => (
                <NewsCard key={item.url + idx} item={item} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* News Feed as Grid */}
      <main className="flex-1 w-full max-w-6xl mx-auto pb-8">
        {newsError ? (
          <div className="text-center text-red-400 text-lg mt-16">שגיאה בטעינת חדשות: {newsError}</div>
        ) : loading ? (
          <div className="text-center text-accent text-2xl mt-16 animate-pulse">טוען חדשות...</div>
        ) : news.length === 0 ? (
          <div className="text-center text-accent text-2xl mt-16">אין חדשות זמינות כרגע.</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {news.slice(0, 21).map((item, idx) => (
              <NewsCard key={item.url + idx} item={item} />
            ))}
          </div>
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