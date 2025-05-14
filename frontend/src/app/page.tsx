'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  image_url: string | null;
  published_at: string;
  type: string;
  category: string;
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
function NewsCard({ item, categoryColor }: { item: NewsItem; categoryColor: string }) {
  const fallbackImg = '/fallback-news.gif';
  const [imgError, setImgError] = useState(false);
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl group transition-transform hover:scale-105 hover:shadow-2xl bg-gray-200 border border-accent/30 aspect-[4/3] flex flex-col justify-end max-w-xs mx-auto cursor-pointer">
      <img
        src={imgError || !item.image_url ? fallbackImg : item.image_url}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover object-center z-0 transition-transform duration-300 bg-gray-200 border-b-4 border-accent group-hover:scale-110"
        onError={() => setImgError(true)}
        style={{ minHeight: 0 }}
      />
      {/* Overlay for title and source, at the top */}
      <div className="absolute top-0 left-0 w-full flex flex-col items-center bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-2 px-4 min-h-[80px] z-10">
        <span className="w-full text-center text-xl font-bold text-white block mb-1 truncate" style={{ textShadow: '0 2px 8px #000' }}>
          {truncateHebrewTitle(item.title)}
        </span>
        <div className={`mt-1 text-accent text-md bg-bg/80 px-3 py-1 rounded-full shadow ${categoryColor}`}>
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

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-8 right-8 z-50 bg-accent text-bg p-3 rounded-full shadow-lg transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-label="Back to top"
    >
      ↑
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-8 mt-10">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="relative rounded-2xl overflow-hidden shadow-xl bg-gray-200 border border-accent/30 aspect-[4/3] max-w-xs w-full animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          <div className="absolute top-4 left-0 w-full flex flex-col items-center px-4">
            <div className="h-6 w-3/4 bg-gray-300 rounded mb-2" />
            <div className="h-4 w-1/2 bg-gray-300 rounded" />
          </div>
        </div>
      ))}
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
  const categoryBarRef = useRef<HTMLDivElement>(null);

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

  // Filter news by selected category
  const filteredNews = selectedCategory === 'all'
    ? news
    : news.filter((item) => item.category === selectedCategory);

  // Color map for categories
  const categoryColors: Record<string, string> = {
    all: 'bg-accent text-bg',
    politics: 'bg-red-500 text-white',
    business: 'bg-yellow-500 text-black',
    technology: 'bg-blue-500 text-white',
    sports: 'bg-green-500 text-white',
    entertainment: 'bg-pink-500 text-white',
    health: 'bg-teal-500 text-white',
    science: 'bg-indigo-500 text-white',
  };

  // Defensive fallback for news data
  const safeFilteredNews = Array.isArray(filteredNews) ? filteredNews.filter(Boolean) : [];
  const safeTrending = Array.isArray(trending) ? trending.filter(Boolean) : [];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-bg via-[#202a3a] to-[#232d3e] text-text font-main flex flex-col items-center justify-start px-2 sm:px-0"
      dir="rtl"
    >
      {/* Global smooth scroll */}
      <style jsx global>{`
        html { scroll-behavior: smooth; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      {/* Header */}
      <header className="w-full max-w-2xl mx-auto sticky top-0 z-50 bg-bg/80 backdrop-blur border-b border-accent py-3 px-2 flex flex-col items-center shadow-lg rounded-b-2xl">
        <img src="/logo.png" alt="Topline Logo" className="h-20 w-auto mb-1 drop-shadow-lg" />
        {/* Sticky Category Bar */}
        <nav ref={categoryBarRef} className="w-full flex flex-wrap justify-center gap-1 mt-2 sticky top-0 z-40 bg-bg/80 backdrop-blur border-b border-accent py-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1 rounded-full text-base font-semibold transition-colors duration-150 shadow border border-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent ${selectedCategory === cat.key ? categoryColors[cat.key] : 'bg-bg/70 text-accent'}`}
              aria-current={selectedCategory === cat.key ? 'page' : undefined}
              style={{ outline: selectedCategory === cat.key ? '2px solid #3ED6C1' : 'none', cursor: 'pointer' }}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Google AdSense slot - left */}
      <aside className="hidden lg:block fixed left-2 top-32 z-40">
        {/* Google AdSense code here. Replace 'ca-pub-XXXX' with your publisher ID. */}
        {/* <ins className="adsbygoogle"
          style={{ display: 'block', width: 160, height: 600 }}
          data-ad-client="ca-pub-XXXX"
          data-ad-slot="1234567890"></ins> */}
      </aside>
      {/* Google AdSense slot - right */}
      <aside className="hidden lg:block fixed right-2 top-32 z-40">
        {/* Google AdSense code here. Replace 'ca-pub-XXXX' with your publisher ID. */}
        {/* <ins className="adsbygoogle"
          style={{ display: 'block', width: 160, height: 600 }}
          data-ad-client="ca-pub-XXXX"
          data-ad-slot="1234567890"></ins> */}
      </aside>

      {/* Section Divider: Trending */}
      <div className="w-full flex items-center my-8">
        <div className="flex-grow border-t border-accent/40" />
        <span className="mx-4 text-accent text-lg font-bold">הכי חם עכשיו</span>
        <div className="flex-grow border-t border-accent/40" />
      </div>
      {/* Trending Section as Grid */}
      <section className="w-full max-w-6xl mx-auto mb-8">
        {trendingError ? (
          <div className="text-center text-red-400 text-lg">שגיאה בטעינת טרנדים: {trendingError}</div>
        ) : safeTrending.length > 0 && (
          <div>
            <div className="flex flex-wrap justify-center gap-8">
              {safeTrending.slice(0, 3).map((item, idx) => (
                <NewsCard key={item.url + idx} item={item} categoryColor={categoryColors[item.category] || categoryColors['all']} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section Divider: News Feed */}
      <div className="w-full flex items-center my-8">
        <div className="flex-grow border-t border-accent/40" />
        <span className="mx-4 text-accent text-lg font-bold">חדשות אחרונות</span>
        <div className="flex-grow border-t border-accent/40" />
      </div>
      {/* News Feed as Grid */}
      <main className="flex-1 w-full max-w-6xl mx-auto pb-8">
        {newsError ? (
          <div className="text-center text-red-400 text-lg mt-16">שגיאה בטעינת חדשות: {newsError}</div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : safeFilteredNews.length === 0 ? (
          <div className="text-center text-accent text-2xl mt-16">אין חדשות זמינות כרגע.</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {safeFilteredNews.slice(0, 21).map((item, idx) => (
              <NewsCard key={item.url + idx} item={item} categoryColor={categoryColors[item.category] || categoryColors['all']} />
            ))}
          </div>
        )}
      </main>
      <BackToTopButton />

      {/* Taboola widget slot - below news grid */}
      <section className="w-full max-w-4xl mx-auto my-8">
        {/* Taboola widget code here. Replace with your publisher ID. */}
        {/* <div id="taboola-below-article-thumbnails"></div>
        <script type="text/javascript">
          window._taboola = window._taboola || [];
          _taboola.push({
            mode: 'thumbnails-b',
            container: 'taboola-below-article-thumbnails',
            placement: 'Below Article Thumbnails',
            target_type: 'mix'
          });
        </script> */}
      </section>

      {/* NOTE: Ad revenue is managed via your AdSense/Taboola dashboards. Direct PayPal payout per click is not possible via code. */}
    </div>
  );
} 