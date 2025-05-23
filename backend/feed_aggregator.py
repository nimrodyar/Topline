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
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
NEWS_API_BASE_URL = 'https://newsapi.org/v2'

# Default News API parameters
NEWS_API_PARAMS = {
    'country': 'il',
    'language': 'he,en',
    'sortBy': 'publishedAt',
    'pageSize': 20,  # Reduced from 100 to optimize performance
}

# Valid categories for filtering
VALID_CATEGORIES = {
    'politics', 'business', 'health', 'technology', 
    'sports', 'entertainment', 'world', 'israel'
}

# RSS Feed URLs with updated endpoints
RSS_FEEDS = {
    'ynet': {
        'main': 'https://www.ynet.co.il/Integration/StoryRss2.xml',
        'trending': 'https://www.ynet.co.il/Integration/StoryRss1854.xml'
    },
    'mako': {
        'main': 'https://www.mako.co.il/RSS/RSSNewsFlash.xml',
        'trending': 'https://rcs.mako.co.il/rssPopular.xml'
    },
    'walla': {
        'main': 'https://rss.walla.co.il/feed/1',
        'trending': 'https://rss.walla.co.il/feed/22'
    },
    'n12': {
        'main': 'https://www.n12.co.il/rss/news',
        'trending': 'https://www.mako.co.il/rss/most-popular.xml'
    },
    'haaretz': {
        'main': 'https://www.haaretz.co.il/srv/rss',
        'trending': None
    }
}

# Add retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

async def fetch_with_retry(session: aiohttp.ClientSession, url: str, timeout: int = 10) -> Optional[str]:
    """Fetch URL content with retries"""
    for attempt in range(MAX_RETRIES):
        try:
            async with session.get(url, timeout=timeout) as response:
                if response.status == 200:
                    return await response.text()
                logger.warning(f"Failed to fetch {url}: Status {response.status} (attempt {attempt + 1}/{MAX_RETRIES})")
        except asyncio.TimeoutError:
            logger.warning(f"Timeout while fetching {url} (attempt {attempt + 1}/{MAX_RETRIES})")
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)} (attempt {attempt + 1}/{MAX_RETRIES})")
        
        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(RETRY_DELAY * (attempt + 1))
    
    return None

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
        if not NEWS_API_KEY:
            logger.warning("World News API key not configured, skipping API fetch")
            return []
            
        # Build request parameters
        params = NEWS_API_PARAMS.copy()
        if category:
            params['category'] = category
            
        headers = {
            'X-Api-Key': NEWS_API_KEY
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{NEWS_API_BASE_URL}/top-headlines", params=params, headers=headers) as response:
                if response.status != 200:
                    logger.error(f"News API request failed with status {response.status}")
                    return []
                    
                data = await response.json()
                if not data.get('articles'):
                    logger.warning("No articles found in News API response")
                    return []
                    
                return [{
                    'title': article.get('title', ''),
                    'source': article.get('source', {}).get('name', ''),
                    'url': article.get('url', ''),
                    'published_at': article.get('publishedAt', ''),
                    'summary': article.get('description', ''),
                    'image_url': article.get('urlToImage', ''),
                    'category': category or 'general'
                } for article in data['articles']]
                
    except Exception as e:
        logger.error(f"Error fetching from News API: {str(e)}")
        return []

async def fetch_rss_feeds() -> List[Dict]:
    """Fetch news from RSS feeds"""
    all_entries = []
    timeout = aiohttp.ClientTimeout(total=30)  # Increase total timeout to 30 seconds
    
    async with aiohttp.ClientSession(timeout=timeout) as session:
        tasks = []
        for source, feed_info in RSS_FEEDS.items():
            if not feed_info or not feed_info.get('main'):
                logger.warning(f"Skipping {source} - no valid feed URL")
                continue
                
            tasks.append(fetch_rss_feed(source, feed_info, session))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for source, result in zip(RSS_FEEDS.keys(), results):
            if isinstance(result, Exception):
                logger.error(f"Error fetching {source}: {str(result)}")
                continue
                
            if not result:
                logger.warning(f"No entries found for {source}")
                continue
                
            all_entries.extend(result)
            
    return all_entries

async def fetch_rss_feed(source: str, feed_info: Dict[str, Any], session) -> List[Dict[str, Any]]:
    """Fetch and parse a single RSS feed"""
    try:
        feed_url = feed_info['main']
        logger.info(f"Fetching RSS feed from {source}: {feed_url}")
        
        async with session.get(feed_url, timeout=10) as response:
            if response.status != 200:
                logger.warning(f"Failed to fetch {source}: Status {response.status}")
                return []
                
            content = await response.text()
            if not content:
                logger.warning(f"Empty response from {source}")
                return []
                
            feed = feedparser.parse(content)
            if not feed.entries:
                logger.warning(f"No entries found in feed for {source}")
                return []
                
            items = []
            for entry in feed.entries[:10]:  # Limit to 10 entries per source
                try:
                    title = entry.get('title', '')
                    link = entry.get('link', '')
                    published = entry.get('published', '')
                    summary = entry.get('summary', '')
                    
                    # Extract image
                    image_url = None
                    if hasattr(entry, 'media_content'):
                        image_url = entry.media_content[0]['url']
                    elif hasattr(entry, 'media_thumbnail'):
                        image_url = entry.media_thumbnail[0]['url']
                    elif hasattr(entry, 'links'):
                        for link in entry.links:
                            if link.get('type', '').startswith('image/'):
                                image_url = link.get('href')
                                break
                    
                    item = {
                        'title': title,
                        'url': link,
                        'published_at': published,
                        'summary': summary,
                        'source': source,
                        'image_url': image_url,
                        'category': detect_category(title, summary)
                    }
                    
                    items.append(item)
                except Exception as e:
                    logger.error(f"Error processing entry from {source}: {str(e)}")
                    continue
                    
            return items
            
    except asyncio.TimeoutError:
        logger.error(f"Timeout while fetching {source}")
        return []
    except Exception as e:
        logger.error(f"Error fetching RSS feed {source}: {str(e)}")
        return []

def detect_category(title: str, content: str) -> str:
    """Detect the category of a news item based on its title and content"""
    text = (title + ' ' + content).lower()
    
    # Define category keywords
    categories = {
        'politics': ['פוליטי', 'פוליטיקה', 'כנסת', 'ממשלה', 'בנט', 'לפיד', 'נתניהו', 'חוק', 'חוקים'],
        'business': ['כלכלי', 'כלכלה', 'בורסה', 'שוק', 'מניות', 'עסקים', 'חברה', 'חברות'],
        'technology': ['טכנולוגיה', 'הייטק', 'סטארט-אפ', 'חדשנות', 'דיגיטלי', 'מחשבים', 'תוכנה'],
        'sports': ['ספורט', 'כדורגל', 'כדורסל', 'שחקן', 'קבוצה', 'משחק', 'תחרות'],
        'entertainment': ['בידור', 'תרבות', 'סרט', 'סדרה', 'שחקן', 'שחקנית', 'מוזיקה'],
        'health': ['בריאות', 'רפואה', 'מחלה', 'טיפול', 'חולה', 'רופא', 'בית חולים'],
        'science': ['מדע', 'מחקר', 'חלל', 'מדענים', 'תגלית', 'ניסוי']
    }
    
    # Count keyword matches for each category
    scores = {cat: sum(1 for kw in keywords if kw in text) for cat, keywords in categories.items()}
    
    # Return the category with the highest score, or 'general' if no matches
    max_score = max(scores.values())
    if max_score > 0:
        return max(scores.items(), key=lambda x: x[1])[0]
    return 'general'

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
        self.news_api_key = NEWS_API_KEY
        self.news_api_base_url = NEWS_API_BASE_URL
        
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
                    feed_info = RSS_FEEDS[source]
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

    async def fetch_news_api(self, category: Optional[str] = None) -> List[Dict]:
        """Fetch news from News API with optional category filtering"""
        try:
            if not self.news_api_key:
                logger.warning("News API key not configured, skipping API fetch")
                return []
            
            # Build request parameters
            params = self.NEWS_API_PARAMS.copy()
            if category:
                params['category'] = category
            
            headers = {
                'X-Api-Key': self.news_api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.news_api_base_url}/top-headlines", params=params, headers=headers) as response:
                    if response.status != 200:
                        logger.error(f"News API request failed with status {response.status}")
                        return []
                        
                    data = await response.json()
                    if not data.get('articles'):
                        logger.warning("No articles found in News API response")
                        return []
                        
                    return [{
                        'title': article.get('title', ''),
                        'source': article.get('source', {}).get('name', ''),
                        'url': article.get('url', ''),
                        'published_at': article.get('publishedAt', ''),
                        'summary': article.get('description', ''),
                        'image_url': article.get('urlToImage', ''),
                        'category': category or 'general'
                    } for article in data['articles']]
                    
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