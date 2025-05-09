import feedparser
import tweepy
from pytrends.request import TrendReq
from typing import List, Dict, Any
from datetime import datetime
import logging
from sqlalchemy.orm import Session
import models
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
    def __init__(self, db: Session):
        self.db = db
        
        # Initialize Twitter client
        self.twitter_client = tweepy.Client(
            bearer_token=os.getenv("TWITTER_BEARER_TOKEN"),
            consumer_key=os.getenv("TWITTER_API_KEY"),
            consumer_secret=os.getenv("TWITTER_API_SECRET"),
            access_token=os.getenv("TWITTER_ACCESS_TOKEN"),
            access_token_secret=os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
        )
        
        # Initialize Google Trends client
        self.trends_client = TrendReq(hl='he-IL', tz=120)  # Hebrew language, Israel timezone
        
        # News API configuration
        self.news_api_key = "0ee8ffe339ff499d95e48ba8d2441b0d"
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
                'country': 'us',
                'pageSize': 20
            }
            
            response = requests.get(headlines_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            news_items = []
            for article in data.get('articles', []):
                # Check if article already exists
                existing = self.db.query(models.NewsItem).filter_by(
                    title=article['title'],
                    source=article['source']['name']
                ).first()
                
                if not existing:
                    news_item = {
                        'title': article['title'],
                        'content': article['description'] or article['content'],
                        'source': article['source']['name'],
                        'category': self._detect_category(article['title'], article['description'] or ''),
                        'original_url': article['url'],
                        'published_at': datetime.fromisoformat(article['publishedAt'].replace('Z', '+00:00'))
                    }
                    
                    db_item = models.NewsItem(**news_item)
                    self.db.add(db_item)
                    news_items.append(news_item)
            
            self.db.commit()
            return news_items
            
        except Exception as e:
            logger.error(f"Error fetching from News API: {str(e)}")
            self.db.rollback()
            return []

    def _detect_category(self, title: str, content: str) -> str:
        """
        Detect article category based on content in Hebrew and English
        """
        # Hebrew and English keywords for category detection
        categories = {
            'politics': {
                'he': ['פוליטי', 'ממשלה', 'כנסת', 'בחירות', 'קואליציה', 'אופוזיציה'],
                'en': ['politics', 'government', 'election', 'parliament', 'coalition']
            },
            'business': {
                'he': ['כלכלה', 'בורסה', 'שוק', 'חברה', 'מניות', 'השקעות'],
                'en': ['business', 'economy', 'market', 'stock', 'finance', 'investment']
            },
            'technology': {
                'he': ['טכנולוגיה', 'הייטק', 'חדשנות', 'דיגיטל', 'סטארט-אפ'],
                'en': ['technology', 'tech', 'innovation', 'digital', 'startup']
            },
            'sports': {
                'he': ['ספורט', 'כדורגל', 'כדורסל', 'אולימפיאדה', 'ליגה'],
                'en': ['sports', 'football', 'basketball', 'olympics', 'league']
            },
            'entertainment': {
                'he': ['בידור', 'תרבות', 'סרט', 'מוזיקה', 'טלוויזיה'],
                'en': ['entertainment', 'culture', 'movie', 'music', 'television']
            },
            'health': {
                'he': ['בריאות', 'רפואה', 'מחלה', 'טיפול', 'קורונה'],
                'en': ['health', 'medical', 'disease', 'treatment', 'covid']
            },
            'science': {
                'he': ['מדע', 'מחקר', 'חלל', 'פיזיקה', 'כימיה'],
                'en': ['science', 'research', 'space', 'physics', 'chemistry']
            }
        }

        text = (title + ' ' + content).lower()
        max_matches = 0
        detected_category = 'general'

        for category, keywords in categories.items():
            # Check both Hebrew and English keywords
            matches = sum(1 for keyword in keywords['he'] if keyword in text)
            matches += sum(1 for keyword in keywords['en'] if keyword in text)
            
            if matches > max_matches:
                max_matches = matches
                detected_category = category

        return detected_category

    async def fetch_rss_feeds(self) -> List[Dict[str, Any]]:
        """
        Fetch and parse RSS feeds from configured sources
        """
        news_items = []
        
        for source, feed_info in self.rss_feeds.items():
            try:
                feed = feedparser.parse(feed_info['url'])
                
                for entry in feed.entries[:10]:  # Get latest 10 entries from each feed
                    # Check if article already exists
                    existing = self.db.query(models.NewsItem).filter_by(
                        title=entry.title,
                        source=source
                    ).first()
                    
                    if not existing:
                        # Fetch full content
                        full_content = await self.fetch_full_content(entry.link, source)
                        
                        news_item = {
                            'title': entry.title,
                            'content': full_content['content'] or entry.summary,
                            'source': source,
                            'category': self._detect_category(entry.title, full_content['content'] or entry.summary),
                            'original_url': entry.link,
                            'published_at': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.utcnow(),
                            'image_url': full_content['image_url'],
                            'author': full_content['author'],
                            'source_attribution': {
                                'name': source.upper(),
                                'url': entry.link,
                                'logo_url': f"/images/sources/{source.lower()}.png"
                            }
                        }
                        
                        db_item = models.NewsItem(**news_item)
                        self.db.add(db_item)
                        news_items.append(news_item)
                
                self.db.commit()
                
            except Exception as e:
                logger.error(f"Error fetching RSS feed from {source}: {str(e)}")
                self.db.rollback()
        
        return news_items

    async def fetch_twitter_trends(self, woeid: int = 23424852) -> List[Dict[str, Any]]:
        """
        Fetch trending topics from Twitter for Israel
        woeid 23424852 is for Israel
        """
        try:
            trends = self.twitter_client.get_place_trends(id=woeid)
            return [
                {
                    'name': trend['name'],
                    'tweet_volume': trend['tweet_volume'],
                    'url': trend['url']
                }
                for trend in trends[0]
            ]
        except Exception as e:
            logger.error(f"Error fetching Twitter trends: {str(e)}")
            return []

    async def fetch_google_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch trending searches from Google Trends for Israel
        """
        try:
            # Get real-time trending searches for Israel
            trending_searches_df = self.trends_client.trending_searches(pn='IL')
            
            # Get more details about top trends
            trends = []
            for search_term in trending_searches_df[:10]:  # Get top 10 trends
                self.trends_client.build_payload([search_term], geo='IL')
                interest_over_time_df = self.trends_client.interest_over_time()
                
                if not interest_over_time_df.empty:
                    trend_data = {
                        'term': search_term,
                        'interest_score': int(interest_over_time_df[search_term].mean()),
                        'related_topics': self.trends_client.related_topics()[search_term]['top']
                    }
                    trends.append(trend_data)
            
            return trends
            
        except Exception as e:
            logger.error(f"Error fetching Google trends: {str(e)}")
            return []

    async def aggregate_all_sources(self):
        """
        Aggregate news and trends from all sources
        """
        news_items = await self.fetch_rss_feeds()
        news_api_items = await self.fetch_news_api()
        twitter_trends = await self.fetch_twitter_trends()
        google_trends = await self.fetch_google_trends()
        
        return {
            'news_items': news_items + news_api_items,
            'twitter_trends': twitter_trends,
            'google_trends': google_trends
        } 