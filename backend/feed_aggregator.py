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

class FeedAggregator:
    def __init__(self):
        # Initialize Google Trends client
        self.trends_client = TrendReq(hl='he-IL', tz=120)  # Hebrew language, Israel timezone
        
        # News API configuration
        self.news_api_key = os.getenv("NEWS_API_KEY", "0ee8ffe339ff499d95e48ba8d2441b0d")  # Fallback to existing key
        self.news_api_base_url = "https://newsapi.org/v2"
        
        # Configure RSS feeds for Israeli news sources with content selectors
        self.rss_feeds = {
            'n12': {
                'url': 'https://www.mako.co.il/rss/feed-news.xml',
                'category': 'general',
                'content_selector': '.article-body',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'walla': {
                'url': 'https://rss.walla.co.il/feed/1',
                'category': 'general',
                'content_selector': '.article-content',
                'image_selector': '.article-main-image img',
                'author_selector': '.author-name'
            },
            'mako': {
                'url': 'https://www.mako.co.il/rss/feed-news.xml',
                'category': 'general',
                'content_selector': '.article-body',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'ynet': {
                'url': 'https://www.ynet.co.il/Integration/StoryRss2.xml',
                'category': 'general',
                'content_selector': '.text14',
                'image_selector': '.main-image img',
                'author_selector': '.author-name'
            },
            'jpost': {
                'url': 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx',
                'category': 'general',
                'content_selector': '.article-text',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'haaretz': {
                'url': 'https://www.haaretz.co.il/cmlink/1.161',
                'category': 'general',
                'content_selector': '.article-body',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'timesofisrael': {
                'url': 'https://www.timesofisrael.com/feed/',
                'category': 'general',
                'content_selector': '.article-content',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'kan': {
                'url': 'https://www.kan.org.il/feed/',
                'category': 'general',
                'content_selector': '.article-content',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            },
            'glz': {
                'url': 'https://www.glz.co.il/feed/',
                'category': 'general',
                'content_selector': '.article-content',
                'image_selector': '.article-image img',
                'author_selector': '.author-name'
            }
        }

        # Cache for storing fetched data
        self._cache = {
            'news': [],
            'trends': [],
            'last_update': None
        }

    async def fetch_full_content(self, url: str, source: str) -> Dict[str, Any]:
        """
        Fetch full article content from the source URL
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        feed_info = self.rss_feeds[source]
                        
                        # Extract content
                        content_element = soup.select_one(feed_info['content_selector'])
                        content = content_element.get_text(strip=True) if content_element else ''
                        
                        # Extract image
                        image_element = soup.select_one(feed_info['image_selector'])
                        image_url = image_element.get('src') if image_element else None
                        
                        # Extract author
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
        """
        Fetch news from News API
        """
        try:
            # Fetch top headlines
            headlines_url = f"{self.news_api_base_url}/top-headlines"
            params = {
                'apiKey': self.news_api_key,
                'country': 'il',  # Israel
                'pageSize': 20
            }
            
            response = requests.get(headlines_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            news_items = []
            for article in data.get('articles', []):
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

    async def fetch_rss_feeds(self) -> List[Dict[str, Any]]:
        """
        Fetch news from configured RSS feeds
        """
        news_items = []
        
        for source, feed_info in self.rss_feeds.items():
            try:
                feed = feedparser.parse(feed_info['url'])
                
                for entry in feed.entries[:10]:  # Get latest 10 entries
                    # Fetch full content
                    full_content = await self.fetch_full_content(entry.link, source)
                    
                    news_item = {
                        'title': entry.title,
                        'content': full_content['content'] or entry.description,
                        'source': source,
                        'category': self._detect_category(entry.title, entry.description),
                        'url': entry.link,
                        'image_url': full_content['image_url'],
                        'published_at': entry.published,
                        'author': full_content['author']
                    }
                    news_items.append(news_item)
                    
            except Exception as e:
                logger.error(f"Error fetching RSS feed {source}: {str(e)}")
                continue
        
        return news_items

    async def fetch_google_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch trending topics from Google Trends for Israel
        """
        try:
            # Get real-time trending searches for Israel
            self.trends_client.build_payload(kw_list=[''], timeframe='now 1-d')
            trending_searches = self.trends_client.trending_searches(pn='israel')
            
            trends = []
            for topic in trending_searches:
                trend = {
                    'topic': topic,
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