'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Head from 'next/head';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  image_url: string | null;
  published_at: string;
  type: string;
  category: string;
}

// Use the public Render backend for all API calls
const API_URL = 'https://topline-l89o.onrender.com';

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

// Minimal NewsCard with image underneath text and brightness filter
function NewsCard({ item }: { item: NewsItem }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasImage = !!item.image_url;
  const imageLoadStartTime = useRef<number>(0);
  
  // Format the published date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };
  
  // Optimize image URL with size parameters and ensure trending images are loaded
  const optimizedImageUrl = hasImage ? `${item.image_url}?w=600&q=75` : '';
  
  useEffect(() => {
    if (hasImage) {
      imageLoadStartTime.current = performance.now();
      // Preload the image
      const img = new Image();
      img.src = optimizedImageUrl;
    }
  }, [hasImage, optimizedImageUrl]);

  const handleImageLoad = () => {
    const loadTime = performance.now() - imageLoadStartTime.current;
    console.log(`[Performance] Image load time for ${item.title}: ${loadTime.toFixed(2)}ms`);
    setImageLoaded(true);
  };

  const cardContent = (
    <div
      className={hasImage ? "news-card-hover" : "news-card-noimg"}
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        margin: '16px',
        minWidth: '260px',
        maxWidth: '320px',
        width: '300px',
        minHeight: '240px',
        height: '340px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        background: hasImage ? '#eee' : '#232d3e',
        cursor: item.url ? 'pointer' : 'default',
        textDecoration: 'none',
        padding: '0',
        transition: 'all 0.3s ease',
      }}
    >
      {hasImage && (
        <>
          <img
            src={optimizedImageUrl}
            alt={item.title || ''}
            className="news-card-img"
            loading="lazy"
            decoding="async"
            onLoad={handleImageLoad}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: imageLoaded ? 'blur(8px) brightness(0.65)' : 'blur(20px) brightness(0.5)',
              zIndex: 0,
              transition: 'filter 0.4s cubic-bezier(.4,0,.2,1)',
            }}
          />
          {!imageLoaded && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: '#232d3e',
              zIndex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <div className="animate-pulse" style={{ width: '40px', height: '40px', border: '4px solid #3ed6c1', borderTopColor: 'transparent', borderRadius: '50%' }} />
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1 }} />
        </>
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          color: '#fff',
          padding: '24px 18px 18px 18px',
          textShadow: '0 2px 8px #000',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '1.15em', marginBottom: '10px', lineHeight: 1.2 }}>
          {item.title || <span style={{ color: 'red' }}>No Title</span>}
        </div>
        <div style={{ color: '#ffd700', fontSize: '1em', marginBottom: '6px' }}>
          {item.source || <span style={{ color: 'red' }}>No Source</span>}
        </div>
        {item.published_at && (
          <div style={{ color: '#ccc', fontSize: '0.8em', marginBottom: '8px' }}>
            {formatDate(item.published_at)}
          </div>
        )}
        <div style={{ color: '#eee', fontSize: '0.85em', marginTop: '8px' }}>
          {item.url ? <span style={{ color: '#fff', textDecoration: 'underline' }}>Read more</span> : 'No URL'}
        </div>
      </div>
      <style jsx>{`
        .news-card-hover {
          transition: all 0.3s ease;
        }
        .news-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .news-card-hover:hover .news-card-img {
          filter: brightness(0.65) !important;
        }
      `}</style>
    </div>
  );
  return item.url ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      tabIndex={0}
      aria-label={item.title}
    >
      {cardContent}
    </a>
  ) : cardContent;
}

function AdCard() {
  return (
    <div
      className="news-card-hover"
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        margin: '12px',
        minWidth: '220px',
        maxWidth: '320px',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        background: '#eee',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #232d3e 60%, #3ed6c1 100%)', opacity: 0.7, zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, color: '#fff', padding: '18px 16px 16px 16px', textShadow: '0 2px 8px #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '8px' }}>Sponsored</div>
        <div style={{ width: '100%' }}>
          <ins className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: '90px', minWidth: '200px' }}
            data-ad-client="ca-pub-2254073111476495"
            data-ad-slot="1234567890"
            data-ad-format="auto"
            data-full-width-responsive="true"
          ></ins>
        </div>
      </div>
      <style jsx>{`
        .news-card-hover:hover .news-card-img {
          filter: brightness(0.5) blur(6px);
        }
      `}</style>
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

// Add QuickUpdates component
function QuickUpdates() {
  const [updates, setUpdates] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/news?category=sports&limit=5`);
        setUpdates(response.data);
        setLoading(false);
      } catch (err) {
        setError('שגיאה בטעינת עדכונים');
        setLoading(false);
      }
    };

    fetchUpdates();
    // Refresh updates every 5 minutes
    const interval = setInterval(fetchUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-[#232d3e] rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#2a3447] rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-[#2a3447] rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-[#2a3447] rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm">{error}</div>;
  }

  return (
    <div className="w-full bg-[#232d3e] rounded-lg p-4">
      <h3 className="text-accent text-lg font-bold mb-4">עדכונים מהירים</h3>
      <div className="space-y-3">
        {updates.map((item, idx) => (
          <a
            key={item.url + idx}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:bg-[#2a3447] p-2 rounded transition-colors"
          >
            <div className="text-sm text-text mb-1">{item.title}</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-accent">{item.source}</span>
              {item.published_at && (
                <span className="text-xs text-gray-400">
                  {new Date(item.published_at).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Enhanced cache with TTL and size limit
  const cache = useRef<{
    [key: string]: {
      data: NewsItem[];
      timestamp: number;
      size: number;
    };
  }>({});

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const MAX_CACHE_SIZE = 50; // Maximum number of cached responses

  const fetchNews = async (category: string, pageNum: number) => {
    const cacheKey = `${category}-${pageNum}`;
    const cachedData = cache.current[cacheKey];
    const now = Date.now();
    
    // Use cached data if it's fresh
    if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
      console.log(`[Performance] Using cached data for ${category} page ${pageNum}`);
      return cachedData.data;
    }

    console.log(`[Performance] Fetching ${category} page ${pageNum}...`);
    const startTime = performance.now();

    try {
      // Add timeout to prevent hanging requests
      const response = await axios.get(
        `${API_URL}/api/news${category !== 'all' ? `?category=${category}` : ''}&page=${pageNum}`,
        { 
          timeout: 5000, // 5 second timeout
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );
      
      const endTime = performance.now();
      console.log(`[Performance] API Response time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`[Performance] Response size: ${JSON.stringify(response.data).length} bytes`);
      
      // Clean up old cache entries if needed
      const cacheEntries = Object.entries(cache.current);
      if (cacheEntries.length >= MAX_CACHE_SIZE) {
        const oldestEntry = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        delete cache.current[oldestEntry[0]];
      }
      
      // Cache the response
      cache.current[cacheKey] = {
        data: response.data,
        timestamp: now,
        size: JSON.stringify(response.data).length
      };
      
      return response.data;
    } catch (error) {
      const endTime = performance.now();
      console.error(`[Performance] API Error after ${(endTime - startTime).toFixed(2)}ms:`, error);
      throw error;
    }
  };

  // Add performance monitoring for initial load
  useEffect(() => {
    const pageLoadStartTime = performance.now();
    console.log('[Performance] Page load started');

    setLoading(true);
    setNewsError(null);
    setPage(1);
    setHasMore(true);
    
    // Load initial data with timeout
    const timeoutId = setTimeout(() => {
      if (loading) {
        const timeoutTime = performance.now() - pageLoadStartTime;
        console.error(`[Performance] Initial load timeout after ${timeoutTime.toFixed(2)}ms`);
        setLoading(false);
        setNewsError('Request timed out. Please try again.');
      }
    }, 10000); // 10 second timeout for initial load
    
    fetchNews(selectedCategory, 1)
      .then((data) => {
        clearTimeout(timeoutId);
        const totalLoadTime = performance.now() - pageLoadStartTime;
        console.log(`[Performance] Total initial load time: ${totalLoadTime.toFixed(2)}ms`);
        setNews(data);
        setLoading(false);
        setHasMore(data.length === 21);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const errorTime = performance.now() - pageLoadStartTime;
        console.error(`[Performance] Error after ${errorTime.toFixed(2)}ms:`, err);
        setNewsError(err.message || 'שגיאה בטעינת חדשות');
        setLoading(false);
      });
      
    return () => clearTimeout(timeoutId);
  }, [selectedCategory]);

  // Infinite scroll setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore]);

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const newData = await fetchNews(selectedCategory, nextPage);
      
      if (newData.length > 0) {
        setNews(prev => [...prev, ...newData]);
        setPage(nextPage);
        setHasMore(newData.length === 21);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more news:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

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
  const safeFilteredNews = Array.isArray(filteredNews) ? filteredNews.filter(item => item && item.title && item.url) : [];
  const safeTrending = Array.isArray(trending) ? trending.filter(item => item && item.title && item.url) : [];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-bg via-[#202a3a] to-[#232d3e] text-text font-main flex flex-col items-center justify-start px-2 sm:px-0"
      dir="rtl"
    >
      <Head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2254073111476495" crossOrigin="anonymous"></script>
      </Head>
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

      {/* Main Content with Side Feed */}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 px-4">
        {/* Main Content */}
        <div className="flex-1">
          {/* Trending Section */}
          <section className="w-full mb-8">
            {trendingError ? (
              <div className="text-center text-red-400 text-lg">שגיאה בטעינת טרנדים: {trendingError}</div>
            ) : safeTrending.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'stretch',
                gap: '16px',
                padding: '0 8px',
                width: '100%',
                boxSizing: 'border-box',
              }}>
                {safeTrending.slice(0, 3).map((item, idx) => (
                  <NewsCard key={item.url + idx} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* Category Bar */}
          <div
            ref={categoryBarRef}
            className="sticky top-0 z-50 bg-[#232d3e] shadow-lg mb-8 py-4 px-4"
          >
            {/* ... existing category bar content ... */}
          </div>

          {/* News Feed */}
          <main className="flex-1 w-full pb-8">
            {newsError ? (
              <div className="text-center text-red-400 text-lg mt-16">שגיאה בטעינת חדשות: {newsError}</div>
            ) : loading ? (
              <LoadingSkeleton />
            ) : safeFilteredNews.length === 0 ? (
              <div className="text-center text-accent text-2xl mt-16">אין חדשות זמינות כרגע.</div>
            ) : (
              <>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  gap: '16px',
                  padding: '0 8px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}>
                  {safeFilteredNews.flatMap((item, idx) => {
                    const elements = [];
                    if (idx > 0 && idx % 8 === 0) elements.push(<AdCard key={`ad-${idx}`} />);
                    elements.push(<NewsCard key={item.url + idx} item={item} />);
                    return elements;
                  })}
                </div>
                {hasMore && (
                  <div ref={loadMoreRef} className="w-full flex justify-center mt-8">
                    {isLoadingMore ? (
                      <div className="animate-pulse" style={{ width: '40px', height: '40px', border: '4px solid #3ed6c1', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    ) : null}
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Side Feed */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-24">
            <QuickUpdates />
          </div>
        </div>
      </div>

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