'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

// Update the constants at the top
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50; // Maximum number of cached responses
const API_TIMEOUT = 15000; // 15 seconds timeout for API requests
const INITIAL_LOAD_TIMEOUT = 30000; // 30 seconds timeout for initial load

interface CacheEntry {
  data: NewsItem[];
  timestamp: number;
  size: number;
}

interface Cache {
  [key: string]: CacheEntry;
}

// Add this utility function before the fetchNews function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const verifyEndpoint = async (url: string): Promise<boolean> => {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error('Endpoint verification failed:', error);
    return false;
  }
};

// Add these debug constants
const DEBUG = true;
const PERFORMANCE_MARKS: { [key: string]: number } = {};

// Add debug utility functions
const debugLog = (message: string, data?: any) => {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? data : '');
};

const markPerformance = (mark: string) => {
  if (!DEBUG) return;
  PERFORMANCE_MARKS[mark] = performance.now();
};

const measurePerformance = (start: string, end: string) => {
  if (!DEBUG || !PERFORMANCE_MARKS[start] || !PERFORMANCE_MARKS[end]) return 0;
  return PERFORMANCE_MARKS[end] - PERFORMANCE_MARKS[start];
};

// Update fetchWithRetry with detailed debugging
const fetchWithRetry = async (url: string, options: any, retryCount = 0): Promise<NewsItem[]> => {
  try {
    debugLog(`Fetching ${url}, attempt ${retryCount + 1}`);
    markPerformance(`fetch-start-${retryCount}`);
    
    const response = await axios.get(url, {
      ...options,
      timeout: 15000, // 15 second timeout
    });
    
    markPerformance(`fetch-end-${retryCount}`);
    measurePerformance(`fetch-start-${retryCount}`, `fetch-end-${retryCount}`);
    
    if (response.status === 200 && response.data) {
      // Handle both array and object responses
      const newsItems = Array.isArray(response.data) ? response.data : 
                       (response.data.data ? response.data.data : []);
      
      debugLog(`Fetched ${newsItems.length} items`);
      return newsItems;
    }
    
    throw new Error('Invalid response format');
  } catch (error: any) {
    debugLog(`Fetch error: ${error?.message || 'Unknown error'}`);
    
    if (retryCount < 2) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return fetchWithRetry(url, options, retryCount + 1);
    }
    
    throw error;
  }
};

// Update the Home component
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
  const cacheRef = useRef<Cache>({});

  // Create a memoized fetchNews function that has access to cacheRef
  const fetchNews = useCallback(async (category: string, pageNum: number): Promise<NewsItem[]> => {
    const fetchId = `${category}-${pageNum}-${Date.now()}`;
    markPerformance(`fetch-start-${fetchId}`);
    debugLog(`Starting news fetch ${fetchId}`, { category, page: pageNum });

    const cacheKey = `${category}-${pageNum}`;
    const cachedData = cacheRef.current[cacheKey];
    const currentTime = Date.now();

    if (cachedData && currentTime - cachedData.timestamp < CACHE_TTL) {
      debugLog(`Using cached data for ${fetchId}`, {
        age: `${((currentTime - cachedData.timestamp) / 1000).toFixed(2)}s`,
        size: cachedData.size
      });
      return cachedData.data;
    }

    try {
      const url = new URL(`${API_URL}/api/news`);
      if (category !== 'all') {
        url.searchParams.append('category', category);
      }
      url.searchParams.append('page', pageNum.toString());

      debugLog(`Fetching fresh data for ${fetchId}`, {
        url: url.toString(),
        timeout: API_TIMEOUT
      });

      const response = await fetchWithRetry(url.toString(), {
        timeout: API_TIMEOUT,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'X-Fetch-ID': fetchId
        }
      });

      markPerformance(`fetch-end-${fetchId}`);
      const duration = measurePerformance(`fetch-start-${fetchId}`, `fetch-end-${fetchId}`);

      // Clean up old cache entries if needed
      const cacheEntries = Object.entries(cacheRef.current) as [string, CacheEntry][];
      if (cacheEntries.length >= MAX_CACHE_SIZE) {
        const oldestEntry = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        delete cacheRef.current[oldestEntry[0]];
      }

      // Cache the response
      cacheRef.current[cacheKey] = {
        data: response,
        timestamp: currentTime,
        size: JSON.stringify(response).length
      };

      debugLog(`Fetch ${fetchId} successful`, {
        duration: `${duration.toFixed(2)}ms`,
        itemCount: response.length,
        cached: true
      });

      return response;
    } catch (error: any) {
      markPerformance(`fetch-error-${fetchId}`);
      const duration = measurePerformance(`fetch-start-${fetchId}`, `fetch-error-${fetchId}`);

      debugLog(`Fetch ${fetchId} failed`, {
        duration: `${duration.toFixed(2)}ms`,
        error: {
          code: error.code,
          message: error.message,
          status: error.response?.status
        }
      });

      if (cachedData) {
        debugLog(`Using stale cache for ${fetchId}`, {
          age: `${((currentTime - cachedData.timestamp) / 1000).toFixed(2)}s`
        });
        return cachedData.data;
      }

      throw error;
    }
  }, []);

  // Create QuickUpdates component with access to fetchNews
  const QuickUpdates = useCallback(() => {
    const [category, setCategory] = useState<'general' | 'sports'>('general');
    const [updates, setUpdates] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      const fetchUpdates = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetchNews(category, 1);
          setUpdates(response.slice(0, 5));
          setLoading(false);
        } catch (err: any) {
          console.error('Error fetching updates:', err);
          setError(err.response?.status === 404 
            ? 'השרת לא זמין כרגע. אנא נסה שוב מאוחר יותר.'
            : 'שגיאה בטעינת עדכונים');
          setLoading(false);
        }
      };

      fetchUpdates();
      const interval = setInterval(fetchUpdates, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }, [category]);

    return (
      <>
        {/* Backdrop when expanded */}
        {isExpanded && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
        
        {/* QuickUpdates Panel */}
        <div 
          className={`fixed left-0 top-0 h-full bg-[#232d3e] transition-transform duration-300 ease-in-out z-50 shadow-xl ${
            isExpanded ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: '300px' }}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute -right-10 top-4 bg-accent text-bg p-2 rounded-r-lg shadow-lg hover:bg-accent/90 transition-colors"
            aria-label={isExpanded ? 'הסתר עדכונים מהירים' : 'הצג עדכונים מהירים'}
          >
            {isExpanded ? '←' : '→'}
          </button>

          <div className="p-4 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-accent text-lg font-bold">עדכונים מהירים</h3>
              <div className="flex gap-2">
                <button
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${category === 'general' ? 'bg-accent text-bg' : 'bg-[#2a3447] text-accent'}`}
                  onClick={() => setCategory('general')}
                >כללי</button>
                <button
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${category === 'sports' ? 'bg-accent text-bg' : 'bg-[#2a3447] text-accent'}`}
                  onClick={() => setCategory('sports')}
                >ספורט</button>
              </div>
            </div>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-[#2a3447] rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-[#2a3447] rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-[#2a3447] rounded w-2/3"></div>
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm">{error}</div>
            ) : (
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
            )}
          </div>
        </div>
      </>
    );
  }, [fetchNews]);

  // Update the initial load effect
  useEffect(() => {
    const loadId = `initial-load-${Date.now()}`;
    markPerformance(`load-start-${loadId}`);
    debugLog(`Starting initial load ${loadId}`, { category: selectedCategory });

    setLoading(true);
    setNewsError(null);
    setPage(1);
    setHasMore(true);

    const timeoutId = setTimeout(() => {
      if (loading) {
        markPerformance(`load-timeout-${loadId}`);
        const duration = measurePerformance(`load-start-${loadId}`, `load-timeout-${loadId}`);
        debugLog(`Initial load ${loadId} timed out`, {
          duration: `${duration.toFixed(2)}ms`,
          timeout: INITIAL_LOAD_TIMEOUT
        });
        setLoading(false);
        setNewsError('הבקשה ארכה זמן רב מדי. אנא נסה שוב.');
      }
    }, INITIAL_LOAD_TIMEOUT);

    fetchNews(selectedCategory, 1)
      .then((data: NewsItem[]) => {
        clearTimeout(timeoutId);
        markPerformance(`load-end-${loadId}`);
        const duration = measurePerformance(`load-start-${loadId}`, `load-end-${loadId}`);
        debugLog(`Initial load ${loadId} successful`, {
          duration: `${duration.toFixed(2)}ms`,
          itemCount: data.length
        });
        setNews(data);
        setLoading(false);
        setHasMore(data.length === 21);
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId);
        markPerformance(`load-error-${loadId}`);
        const duration = measurePerformance(`load-start-${loadId}`, `load-error-${loadId}`);
        debugLog(`Initial load ${loadId} failed`, {
          duration: `${duration.toFixed(2)}ms`,
          error: err
        });
        setNewsError(err.message || 'שגיאה בטעינת חדשות');
        setLoading(false);
      });

    return () => clearTimeout(timeoutId);
  }, [selectedCategory, fetchNews]);

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
    <div className="min-h-screen bg-gradient-to-br from-bg via-[#202a3a] to-[#232d3e] text-text font-main flex flex-col items-center justify-start px-2 sm:px-0" dir="rtl">
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

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4">
        {/* Trending Section */}
        <section className="w-full mb-8">
          {trendingError ? (
            <div className="text-center text-red-400 text-lg">שגיאה בטעינת טרנדים: {trendingError}</div>
          ) : safeTrending.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {safeTrending.slice(0, 3).map((item, idx) => (
                <NewsCard key={item.url + idx} item={item} />
              ))}
            </div>
          )}
        </section>

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
              <div className="flex flex-wrap justify-center gap-4">
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

      {/* QuickUpdates as overlay */}
      <QuickUpdates />

      <BackToTopButton />
    </div>
  );
} 