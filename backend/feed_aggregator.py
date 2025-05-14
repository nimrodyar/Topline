import feedparser
from pytrends.request import TrendReq
from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging
import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import aiohttp
import asyncio

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

class FeedAggregator:
    def __init__(self):
        # Initialize Google Trends client
        self.trends_client = TrendReq(hl='he-IL', tz=120)  # Hebrew language, Israel timezone
        
        # News API configuration
        self.news_api_key = os.getenv("NEWS_API_KEY", "0ee8ffe339ff499d95e48ba8d2441b0d")  # Fallback to existing key
        self.news_api_base_url = "https://newsapi.org/v2"
        
        # Configure RSS feeds for Israeli news sources with content selectors
        self.rss_feeds = {
            'ynet': {
                'url': 'https://www.ynet.co.il/Integration/StoryRss2.xml',
                'category': 'general',
                'content_selector': '.text14, .article-body, .main-content',  # Ynet uses .text14 for main text
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'walla': {
                'url': 'https://rss.walla.co.il/feed/1',
                'category': 'general',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.article-main-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'mako': {
                'url': 'https://www.mako.co.il/rss/feed-news.xml',
                'category': 'general',
                'content_selector': '.article-body, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'n12': {
                'url': 'https://www.mako.co.il/rss/feed-news.xml',
                'category': 'general',
                'content_selector': '.article-body, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'kan': {
                'url': 'https://www.kan.org.il/feed/',
                'category': 'general',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'haaretz': {
                'url': 'https://www.haaretz.co.il/cmlink/1.161',
                'category': 'general',
                'content_selector': '.article-body, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'israelhayom': {
                'url': 'https://www.israelhayom.co.il/rss.xml',
                'category': 'general',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'globes': {
                'url': 'https://www.globes.co.il/webservice/rss/mainfeed.xml',
                'category': 'business',
                'content_selector': '.article-body, .main-content',
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'calcalist': {
                'url': 'https://www.calcalist.co.il/home/0,7340,L-8,00.xml',
                'category': 'business',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'maariv': {
                'url': 'https://www.maariv.co.il/rssfeed/1',
                'category': 'general',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'sport5': {
                'url': 'https://www.sport5.co.il/rss.aspx?FolderID=604',
                'category': 'sports',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.main-image img, .article-image img',
                'author_selector': '.author-name, .byline'
            },
            'timesofisrael': {
                'url': 'https://www.timesofisrael.com/feed/',
                'category': 'general',
                'content_selector': '.article-content, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
            'jpost': {
                'url': 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx',
                'category': 'general',
                'content_selector': '.article-text, .main-content',
                'image_selector': '.article-image img, .main-image img',
                'author_selector': '.author-name, .byline'
            },
        }

        # Cache for storing fetched data
        self._cache = {
            'news': [],
            'trends': [],
            'last_update': None
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
                entry_image_url = self._extract_image_from_entry(entry)
                content = getattr(entry, 'summary', '') or getattr(entry, 'description', '') or ''
                display_source = self.source_display_names.get(source, source)
                if idx < 3:
                    try:
                        full_content = await asyncio.wait_for(self.fetch_full_content(entry.link, source, session), timeout=6)
                        if full_content['content']:
                            content = full_content['content']
                        if full_content['image_url']:
                            entry_image_url = full_content['image_url']
                    except Exception:
                        pass
                image_url = entry_image_url or (full_content['image_url'] if 'full_content' in locals() else None)
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
        
        # Check if cache is expired (older than 3 minutes)
        if (not self._cache['last_update'] or 
            now - self._cache['last_update'] > timedelta(minutes=3)):
            
            # Fetch new data
            rss_news = await self.fetch_rss_feeds()
            news_api_news = await self.fetch_news_api()
            trends = await self.fetch_google_trends()
            
            # Update cache
            self._cache = {
                'news': rss_news + news_api_news,
                'trends': trends,
                'last_update': now
            }
        
        return self._cache 

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
                        # Try to fetch image from RSS entry
                        entry_image_url = self._extract_image_from_entry(entry)
                        # Try to fetch image from article page
                        try:
                            full_content = await asyncio.wait_for(self.fetch_full_content(entry.link, source, session), timeout=6)
                            if full_content.get('image_url'):
                                image_url = full_content.get('image_url')
                        except Exception:
                            pass
                        if not image_url:
                            image_url = entry_image_url
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