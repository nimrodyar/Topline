import feedparser
from pytrends.request import TrendReq
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging
import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import aiohttp
import asyncio
from urllib.parse import urlparse

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CLOUDFLARE_API_KEY = os.getenv("CLOUDFLARE_API_KEY")
CLOUDFLARE_ACCOUNT_ID = "v1.0-f2439216425b78b6e2a98565-6d6b54435dc9c2b5a87aeed7233856874336dbc3eba634056eaec24baebd4340b2b80359a87d5aa9ce8a7307c5c5ccfb7e35af0916f898d766afeea26afddedb5072af4c6d3fc916a6"
CLOUDFLARE_ENDPOINT = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0"

# Add translation function using LibreTranslate
TRANSLATE_ENDPOINT = "https://libretranslate.de/translate"
def translate_to_english(text: str) -> str:
    try:
        # Simple heuristic: if text contains Hebrew characters, translate
        if any('\u0590' <= c <= '\u05EA' for c in text):
            payload = {
                'q': text,
                'source': 'he',
                'target': 'en',
                'format': 'text'
            }
            response = requests.post(TRANSLATE_ENDPOINT, data=payload, timeout=10)
            response.raise_for_status()
            return response.json().get('translatedText', text)
        return text
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text

# In-memory cache for AI images
AI_IMAGE_CACHE = {}

# API Configuration
WORLD_NEWS_API_KEY = os.getenv('WORLD_NEWS_API_KEY')
WORLD_NEWS_BASE_URL = 'https://api.worldnewsapi.com/search-news'

# Default World News API parameters
WORLD_NEWS_PARAMS = {
    'country': 'il',
    'language': 'he,en',
    'sort': 'publish-time',
    'sort-direction': 'desc',
    'number': 20,  # Reduced from 100 to optimize performance
}

# Valid categories for filtering
VALID_CATEGORIES = {
    'politics', 'business', 'health', 'technology', 
    'sports', 'entertainment', 'world', 'israel'
}

# RSS Feed URLs
RSS_FEEDS = {
    'ynet': 'http://www.ynet.co.il/Integration/StoryRss2.xml',
    'mako': 'https://www.mako.co.il/RSS/RSSNewsFlash.xml',
    'walla': 'https://rss.walla.co.il/feed/1',
    'n12': 'https://www.n12.co.il/rss/news',
    'haaretz': 'https://www.haaretz.co.il/srv/rss',
}

class NewsAPIError(Exception):
    """Custom exception for News API related errors"""
    pass

async def extract_image_with_timeout(session: aiohttp.ClientSession, url: str, timeout: int = 3) -> Optional[str]:
    """
    Extract the main image from an article URL with timeout
    """
    try:
        logger.info(f"Attempting to extract image from: {url}")
        async with session.get(url, timeout=timeout) as response:
            if response.status != 200:
                logger.warning(f"Failed to fetch {url}: Status {response.status}")
                return None
                
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Try different methods to find the main image
            image = None
            
            # Method 1: Open Graph image
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                image = og_image['content']
                logger.info(f"Found OG image for {url}")
                
            # Method 2: Twitter image
            if not image:
                twitter_image = soup.find('meta', property='twitter:image')
                if twitter_image and twitter_image.get('content'):
                    image = twitter_image['content']
                    logger.info(f"Found Twitter image for {url}")
            
            # Method 3: First large image in article
            if not image:
                for img in soup.find_all('img'):
                    src = img.get('src', '')
                    if src and (
                        'article' in src.lower() or 
                        'news' in src.lower() or 
                        any(dim in src for dim in ['1200', '800', '700', '600'])
                    ):
                        image = src
                        logger.info(f"Found large content image for {url}")
                        break
            
            return image

    except asyncio.TimeoutError:
        logger.warning(f"Timeout while extracting image from {url}")
        return None
    except Exception as e:
        logger.error(f"Error extracting image from {url}: {str(e)}")
        return None

def format_world_news_item(item: Dict) -> Dict:
    """Format a World News API item into our standard structure"""
    return {
        'title': item.get('title', ''),
        'source': item.get('source', ''),
        'url': item.get('url', ''),
        'published_at': item.get('publish_date', ''),
        'summary': item.get('text', ''),
        'image_url': item.get('image', ''),
        'category': item.get('category', []),
    }

def get_time_window_params() -> Dict:
    """Get the time window parameters for the last 24 hours"""
    now = datetime.utcnow()
    earliest = now - timedelta(days=1)
    return {
        'earliest-publish-date': earliest.strftime('%Y-%m-%d %H:%M:%S'),
        'latest-publish-date': now.strftime('%Y-%m-%d %H:%M:%S'),
    }

async def fetch_world_news(category: Optional[str] = None) -> List[Dict]:
    """Fetch news from World News API with optional category filtering"""
    try:
        if not WORLD_NEWS_API_KEY:
            logger.warning("World News API key not configured, skipping API fetch")
            return []
            
        # Build request parameters
        params = WORLD_NEWS_PARAMS.copy()
        params.update(get_time_window_params())
        params['api-key'] = WORLD_NEWS_API_KEY
        
        # Add category filter if provided and valid
        if category:
            category = category.lower()
            if category not in VALID_CATEGORIES:
                logger.warning(f"Invalid category provided: {category}")
                return []
            params['category'] = category
            
        timeout = aiohttp.ClientTimeout(total=30)  # Increase timeout to 30 seconds
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                WORLD_NEWS_BASE_URL,
                params=params,
                timeout=20  # Increase per-request timeout
            ) as response:
                if response.status == 429:
                    logger.error("World News API rate limit exceeded")
                    return []
                    
                response.raise_for_status()
                data = await response.json()
                
                news_items = [
                    format_world_news_item(item)
                    for item in data.get('news', [])
                ]
                
                logger.info(f"Fetched {len(news_items)} items from World News API")
                return news_items
                
    except asyncio.TimeoutError:
        logger.warning("Timeout while fetching from World News API")
        return []
    except Exception as e:
        logger.error(f"Error fetching from World News API: {str(e)}")
        return []

async def fetch_rss_feeds() -> List[Dict]:
    """Fetch news from RSS feeds"""
    all_entries = []
    timeout = aiohttp.ClientTimeout(total=30)  # Increase total timeout to 30 seconds
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for source, url in RSS_FEEDS.items():
            try:
                async with session.get(url, timeout=10) as response:  # Increase per-request timeout
                    if response.status != 200:
                        logger.warning(f"Failed to fetch RSS feed {source}: Status {response.status}")
                        continue
                        
                    feed_content = await response.text()
                    feed = feedparser.parse(feed_content)
                    
                    for entry in feed.entries[:10]:  # Reduce entries per source to improve speed
                        try:
                            # Extract image if not present in feed
                            image_url = None
                            if hasattr(entry, 'media_content'):
                                image_url = entry.media_content[0]['url']
                            elif hasattr(entry, 'media_thumbnail'):
                                image_url = entry.media_thumbnail[0]['url']
                            else:
                                # Skip image extraction if not readily available
                                image_url = None
                            
                            published_at = datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.now()
                            
                            news_item = {
                                'title': entry.title,
                                'url': entry.link,
                                'published_at': published_at.isoformat(),
                                'source': source,
                                'summary': entry.get('summary', ''),
                                'image_url': image_url,
                                'category': entry.get('tags', []),
                            }
                            all_entries.append(news_item)
                            
                        except Exception as e:
                            logger.error(f"Error processing entry from {source}: {str(e)}")
                            continue
                            
            except asyncio.TimeoutError:
                logger.warning(f"Timeout while fetching RSS feed {source}")
                continue
            except Exception as e:
                logger.error(f"Error fetching RSS feed {source}: {str(e)}")
                continue
                
    return all_entries

async def get_news(category: Optional[str] = None) -> List[Dict]:
    """
    Get news from all sources (World News API and RSS feeds)
    """
    # Fetch from both sources concurrently
    world_news_task = asyncio.create_task(fetch_world_news(category))
    rss_news_task = asyncio.create_task(fetch_rss_feeds())
    
    # Wait for both tasks to complete
    world_news, rss_news = await asyncio.gather(
        world_news_task,
        rss_news_task,
        return_exceptions=True
    )
    
    # Handle any exceptions
    if isinstance(world_news, Exception):
        logger.error(f"Error fetching World News: {str(world_news)}")
        world_news = []
    if isinstance(rss_news, Exception):
        logger.error(f"Error fetching RSS news: {str(rss_news)}")
        rss_news = []
    
    # Combine and sort all news items
    all_news = world_news + rss_news
    all_news.sort(key=lambda x: x['published_at'], reverse=True)
    
    # Remove duplicates based on URL
    seen_urls = set()
    unique_news = []
    for item in all_news:
        if item['url'] not in seen_urls:
            seen_urls.add(item['url'])
            unique_news.append(item)
    
    logger.info(f"Total news items fetched: {len(unique_news)}")
    return unique_news

class FeedAggregator:
    def __init__(self):
        # Initialize Google Trends client
        self.trends_client = TrendReq(hl='he-IL', tz=120)  # Hebrew language, Israel timezone
        
        # News API configuration
        self.news_api_key = os.getenv("NEWS_API_KEY")
        self.news_api_base_url = "https://newsapi.org/v2"
        
        # Cache for storing fetched data with shorter expiry
        self._cache = {
            'news': [],
            'trends': [],
            'last_update': None,
            'trending_news': [],
            'trending_last_update': None
        }

        # Human-readable source names
        self.source_display_names = {
            'ynet': 'Ynet',
            'walla': 'Walla',
            'mako': 'Mako',
            'n12': 'N12',
            'kan': 'Kan',
            'haaretz': 'Haaretz',
            'israelhayom': 'Israel Hayom',
            'globes': 'Globes',
            'calcalist': 'Calcalist',
            'maariv': 'Maariv',
            'sport5': 'Sport5',
            'timesofisrael': 'Times of Israel',
            'jpost': 'Jerusalem Post',
        }

    def _extract_image_from_entry(self, entry):
        # Try media:content
        media_content = entry.get('media_content')
        if media_content and isinstance(media_content, list) and 'url' in media_content[0]:
            return media_content[0]['url']
        # Try enclosure
        enclosure = entry.get('enclosures')
        if enclosure and isinstance(enclosure, list) and 'href' in enclosure[0]:
            return enclosure[0]['href']
        # Try image
        if 'image' in entry:
            return entry['image']
        # Try og:image in summary/detail
        if 'summary_detail' in entry and 'og:image' in entry['summary_detail'].get('value', ''):
            soup = BeautifulSoup(entry['summary_detail']['value'], 'html.parser')
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                return og_image['content']
        return None

    async def fetch_full_content(self, url: str, source: str, session) -> Dict[str, Any]:
        try:
            async with session.get(url, timeout=6) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    feed_info = self.rss_feeds[source]
                    content_element = soup.select_one(feed_info['content_selector'])
                    content = content_element.get_text(strip=True) if content_element else ''
                    image_element = soup.select_one(feed_info['image_selector'])
                    image_url = image_element.get('src') if image_element else None
                    if not image_url:
                        og_image = soup.find('meta', property='og:image')
                        if og_image and og_image.get('content'):
                            image_url = og_image['content']
                    if not image_url:
                        first_img = soup.find('img')
                        if first_img and first_img.get('src'):
                            image_url = first_img['src']
                    author_element = soup.select_one(feed_info['author_selector'])
                    author = author_element.get_text(strip=True) if author_element else None
                    return {
                        'content': content,
                        'image_url': image_url,
                        'author': author
                    }
        except Exception as e:
            logger.error(f"Error fetching full content from {url}: {str(e)}")
        return {
            'content': '',
            'image_url': None,
            'author': None
        }

    async def fetch_news_api(self) -> List[Dict[str, Any]]:
        try:
            news_items = []
            from_date = (datetime.utcnow() - timedelta(days=3)).strftime('%Y-%m-%dT%H:%M:%SZ')
            page = 1
            max_pages = 3  # up to 300 items
            while page <= max_pages:
                headlines_url = f"{self.news_api_base_url}/top-headlines"
                params = {
                    'apiKey': self.news_api_key,
                    'country': 'il',
                    'pageSize': 100,
                    'page': page,
                    'from': from_date
                }
                response = requests.get(headlines_url, params=params)
                response.raise_for_status()
                data = response.json()
                articles = data.get('articles', [])
                if not articles:
                    break
                for article in articles:
                    news_item = {
                        'title': article['title'],
                        'content': article['description'] or article['content'],
                        'source': article['source']['name'],
                        'category': self._detect_category(article['title'], article['description'] or ''),
                        'url': article['url'],
                        'image_url': article['urlToImage'],
                        'published_at': article['publishedAt'],
                        'author': article['author']
                    }
                    news_items.append(news_item)
                if len(articles) < 100:
                    break
                page += 1
            return news_items
        except Exception as e:
            logger.error(f"Error fetching from News API: {str(e)}")
            return []

    def _detect_category(self, title: str, content: str) -> str:
        """
        Detect article category based on content in Hebrew and English
        """
        # Hebrew and English keywords for category detection
        categories = {
            'politics': {
                'he': ['פוליטי', 'ממשלה', 'כנסת', 'בחירות', 'מפלגה'],
                'en': ['politics', 'government', 'election', 'party', 'minister']
            },
            'business': {
                'he': ['כלכלה', 'בורסה', 'שוק', 'השקעות', 'חברה'],
                'en': ['business', 'economy', 'market', 'stock', 'company']
            },
            'technology': {
                'he': ['טכנולוגיה', 'הייטק', 'חדשנות', 'דיגיטל', 'תוכנה'],
                'en': ['technology', 'tech', 'innovation', 'digital', 'software']
            },
            'sports': {
                'he': ['ספורט', 'כדורגל', 'כדורסל', 'תחרות', 'שחקן'],
                'en': ['sports', 'football', 'basketball', 'game', 'player']
            },
            'entertainment': {
                'he': ['בידור', 'תרבות', 'סרט', 'מוזיקה', 'טלוויזיה'],
                'en': ['entertainment', 'culture', 'movie', 'music', 'tv']
            },
            'health': {
                'he': ['בריאות', 'רפואה', 'מחלה', 'טיפול', 'חולה'],
                'en': ['health', 'medical', 'disease', 'treatment', 'patient']
            },
            'science': {
                'he': ['מדע', 'מחקר', 'חלל', 'פיזיקה', 'כימיה'],
                'en': ['science', 'research', 'space', 'physics', 'chemistry']
            }
        }

        text = (title + ' ' + content).lower()
        
        for category, keywords in categories.items():
            if any(keyword in text for keyword in keywords['he']) or \
               any(keyword in text for keyword in keywords['en']):
                return category
        
        return 'general'

    async def fetch_rss_feed(self, source: str, feed_info: Dict[str, Any], session) -> List[Dict[str, Any]]:
        news_items = []
        try:
            feed = feedparser.parse(feed_info['url'])
            entries = feed.entries[:30]
            three_days_ago = datetime.utcnow() - timedelta(days=3)
            for idx, entry in enumerate(entries):
                published = getattr(entry, 'published_parsed', None)
                if published:
                    published_dt = datetime(*published[:6])
                    if published_dt < three_days_ago:
                        continue
                image_url = None
                # First, try to fetch image from article page
                try:
                    full_content = await asyncio.wait_for(self.fetch_full_content(entry.link, source, session), timeout=2)
                    if full_content.get('image_url'):
                        image_url = full_content.get('image_url')
                except Exception:
                    pass
                # If not found, use image from RSS entry
                if not image_url:
                    entry_image_url = self._extract_image_from_entry(entry)
                    image_url = entry_image_url
                content = getattr(entry, 'summary', '') or getattr(entry, 'description', '') or ''
                display_source = self.source_display_names.get(source, source)
                news_item = {
                    'title': getattr(entry, 'title', ''),
                    'content': content,
                    'source': display_source,
                    'category': self._detect_category(getattr(entry, 'title', ''), content),
                    'url': getattr(entry, 'link', ''),
                    'image_url': image_url,
                    'published_at': getattr(entry, 'published', None),
                    'author': None
                }
                news_items.append(news_item)
        except Exception as e:
            logger.error(f"Error fetching RSS feed {source}: {str(e)}")
        return news_items

    async def fetch_rss_feeds(self) -> List[Dict[str, Any]]:
        async with aiohttp.ClientSession() as session:
            tasks = [self.fetch_rss_feed(source, feed_info, session) for source, feed_info in self.rss_feeds.items()]
            results = await asyncio.gather(*tasks)
            return [item for sublist in results for item in sublist]

    async def fetch_google_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch trending topics from Google Trends for Israel (try both 'israel' and 'IL')
        """
        try:
            # Try 'israel' first
            try:
                self.trends_client.build_payload(kw_list=[''], timeframe='now 1-d')
                trending_searches = self.trends_client.trending_searches(pn='israel')
                logger.info(f"Google Trends (israel): {trending_searches}")
            except Exception as e:
                logger.warning(f"Failed with 'israel', trying 'IL': {e}")
                trending_searches = None

            # If 'israel' fails or returns empty, try 'IL'
            if trending_searches is None or len(trending_searches) == 0:
                try:
                    self.trends_client.build_payload(kw_list=[''], timeframe='now 1-d')
                    trending_searches = self.trends_client.trending_searches(pn='IL')
                    logger.info(f"Google Trends (IL): {trending_searches}")
                except Exception as e:
                    logger.error(f"Google Trends failed for both 'israel' and 'IL': {e}")
                    return []

            trends = []
            for topic in trending_searches:
                trend = {
                    'topic': str(topic),
                    'source': 'google_trends',
                    'timestamp': datetime.now().isoformat()
                }
                trends.append(trend)
            return trends
        except Exception as e:
            logger.error(f"Error fetching Google Trends: {str(e)}")
            return []

    async def get_latest_data(self) -> Dict[str, Any]:
        """
        Get latest data from cache or fetch new data if cache is expired
        """
        now = datetime.now()
        
        try:
            # Check if cache is expired (older than 2 minutes)
            if (not self._cache['last_update'] or 
                now - self._cache['last_update'] > timedelta(minutes=2)):
                
                # Fetch RSS feeds first as they're more reliable
                rss_news = await self.fetch_rss_feeds()
                
                # Only try News API if RSS feeds didn't provide enough items
                news_api_news = []
                if len(rss_news) < 20:
                    try:
                        news_api_news = await self.fetch_news_api()
                    except Exception as e:
                        logger.warning(f"News API fetch failed, continuing with RSS only: {e}")
                
                # Update cache
                self._cache.update({
                    'news': rss_news + news_api_news,
                    'last_update': now
                })
            
            return self._cache
            
        except Exception as e:
            logger.error(f"Error in get_latest_data: {e}")
            # Return last cached data if available, empty lists if not
            return {
                'news': self._cache.get('news', []),
                'trends': self._cache.get('trends', []),
                'last_update': self._cache.get('last_update')
            }

    async def get_trending_news(self) -> List[Dict[str, Any]]:
        """
        Get trending news with caching and fallback
        """
        now = datetime.now()
        
        try:
            # Check if trending cache is expired (older than 5 minutes)
            if (not self._cache['trending_last_update'] or 
                now - self._cache['trending_last_update'] > timedelta(minutes=5)):
                
                # Start with most read RSS feeds as they're more reliable
                most_read_feeds = {
                    'ynet': 'https://www.ynet.co.il/Integration/StoryRss1854.xml',
                    'mako': 'https://rcs.mako.co.il/rssPopular.xml',
                    'walla': 'https://rss.walla.co.il/feed/22',
                    'n12': 'https://www.mako.co.il/rss/most-popular.xml'
                }
                
                trending_news = []
                async with aiohttp.ClientSession() as session:
                    for source, url in most_read_feeds.items():
                        try:
                            async with session.get(url, timeout=5) as response:
                                if response.status == 200:
                                    feed_content = await response.text()
                                    feed = feedparser.parse(feed_content)
                                    
                                    for entry in feed.entries[:5]:
                                        # Use simple image extraction to avoid timeouts
                                        image_url = None
                                        if hasattr(entry, 'media_content'):
                                            image_url = entry.media_content[0]['url']
                                        elif hasattr(entry, 'media_thumbnail'):
                                            image_url = entry.media_thumbnail[0]['url']
                                        
                                        trending_news.append({
                                            'title': entry.title,
                                            'url': entry.link,
                                            'source': source,
                                            'image_url': image_url,
                                            'published_at': entry.published if hasattr(entry, 'published') else None,
                                            'type': 'rss-most-read'
                                        })
                        except Exception as e:
                            logger.warning(f"Error fetching trending feed {source}: {e}")
                            continue
                
                # Only update cache if we got some results
                if trending_news:
                    self._cache.update({
                        'trending_news': trending_news,
                        'trending_last_update': now
                    })
                    return trending_news
                
                # If no new results, return cached data if available
                if self._cache['trending_news']:
                    return self._cache['trending_news']
                
                # Last resort: return recent news items as trending
                return self._cache.get('news', [])[:10]
                
        except Exception as e:
            logger.error(f"Error in get_trending_news: {e}")
            # Return cached trending news or recent news as fallback
            return self._cache.get('trending_news', []) or self._cache.get('news', [])[:10]

    async def fetch_trending_news(self) -> List[Dict[str, Any]]:
        """
        Fetch trending news from News API (top headlines) and 'most read' RSS feeds from Israeli news sites.
        """
        trending_news = []

        # 1. News API Top Headlines for Israel
        try:
            headlines_url = f"{self.news_api_base_url}/top-headlines"
            params = {
                'apiKey': self.news_api_key,
                'country': 'il',
                'pageSize': 10
            }
            response = requests.get(headlines_url, params=params)
            response.raise_for_status()
            data = response.json()
            for article in data.get('articles', []):
                image_url = article.get('urlToImage')
                trending_news.append({
                    'title': article['title'],
                    'url': article['url'],
                    'source': article['source']['name'],
                    'image_url': image_url,
                    'published_at': article['publishedAt'],
                    'type': 'newsapi'
                })
        except Exception as e:
            logger.error(f"Error fetching News API top headlines: {str(e)}")

        # 2. 'Most Read' RSS feeds from Israeli news sites
        most_read_feeds = {
            'ynet': 'https://www.ynet.co.il/Integration/StoryRss1854.xml',  # Ynet Most Read
            'mako': 'https://rcs.mako.co.il/rssPopular.xml',                # Mako Most Popular
            'walla': 'https://rss.walla.co.il/feed/22',                     # Walla Most Read
            'n12': 'https://www.mako.co.il/rss/most-popular.xml'            # N12 Most Popular
        }
        async with aiohttp.ClientSession() as session:
            for source, url in most_read_feeds.items():
                try:
                    feed = feedparser.parse(url)
                    for entry in feed.entries[:5]:
                        image_url = None
                        # First, try to fetch image from article page (3s timeout for debug)
                        try:
                            full_content = await asyncio.wait_for(self.fetch_full_content(entry.link, source, session), timeout=3)
                            if full_content.get('image_url'):
                                image_url = full_content.get('image_url')
                                logger.info(f"[TRENDING] Article page image found for {entry.link} ({source}): {image_url}")
                        except Exception as e:
                            logger.warning(f"[TRENDING] Failed to fetch article image for {entry.link} ({source}): {e}")
                        # If not found, use image from RSS entry
                        if not image_url:
                            entry_image_url = self._extract_image_from_entry(entry)
                            image_url = entry_image_url
                            if image_url:
                                logger.info(f"[TRENDING] RSS entry image used for {entry.link} ({source}): {image_url}")
                        if not image_url:
                            logger.warning(f"[TRENDING] No image found for {entry.link} ({source})")
                        trending_news.append({
                            'title': entry.title,
                            'url': entry.link,
                            'source': source,
                            'image_url': image_url,
                            'published_at': entry.published if hasattr(entry, 'published') else None,
                            'type': 'rss-most-read'
                        })
                except Exception as e:
                    logger.error(f"Error fetching most read feed for {source}: {str(e)}")

        return trending_news 