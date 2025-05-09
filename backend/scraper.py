import aiohttp
import asyncio
from bs4 import BeautifulSoup
from datetime import datetime
import logging
from typing import List, Dict, Any
import re
from urllib.parse import urlparse
import models
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NewsScraper:
    def __init__(self, db: Session):
        self.db = db
        self.sources = {
            'walla': {
                'url': 'https://news.walla.co.il',
                'article_selector': 'article',
                'title_selector': 'h1',
                'content_selector': '.article-content',
            },
            'n12': {
                'url': 'https://www.mako.co.il',
                'article_selector': '.article',
                'title_selector': '.headline',
                'content_selector': '.article-body',
            },
            'mako': {
                'url': 'https://www.mako.co.il',
                'article_selector': '.article',
                'title_selector': '.headline',
                'content_selector': '.article-body',
            }
        }

    async def fetch_page(self, url: str) -> str:
        """
        Fetch webpage content asynchronously
        """
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        return await response.text()
                    else:
                        logger.error(f"Failed to fetch {url}: Status {response.status}")
                        return ""
            except Exception as e:
                logger.error(f"Error fetching {url}: {str(e)}")
                return ""

    def parse_article(self, html: str, source_config: Dict[str, str]) -> Dict[str, Any]:
        """
        Parse article content from HTML
        """
        soup = BeautifulSoup(html, 'html.parser')
        article = soup.select_one(source_config['article_selector'])
        
        if not article:
            return None

        title = article.select_one(source_config['title_selector'])
        content = article.select_one(source_config['content_selector'])

        if not title or not content:
            return None

        # Clean content
        content_text = ' '.join([p.get_text().strip() for p in content.find_all('p')])
        content_text = re.sub(r'\s+', ' ', content_text).strip()

        return {
            'title': title.get_text().strip(),
            'content': content_text,
            'source': source_config['url'],
            'published_at': datetime.utcnow(),
            'category': self.detect_category(title.get_text(), content_text)
        }

    def detect_category(self, title: str, content: str) -> str:
        """
        Detect article category based on content
        """
        # Simple keyword-based category detection
        categories = {
            'politics': ['פוליטי', 'ממשלה', 'כנסת', 'בחירות'],
            'business': ['כלכלה', 'בורסה', 'שוק', 'חברה'],
            'technology': ['טכנולוגיה', 'הייטק', 'חדשנות', 'דיגיטל'],
            'sports': ['ספורט', 'כדורגל', 'כדורסל', 'אולימפיאדה'],
            'entertainment': ['בידור', 'תרבות', 'סרט', 'מוזיקה'],
            'health': ['בריאות', 'רפואה', 'מחלה', 'טיפול'],
            'science': ['מדע', 'מחקר', 'חלל', 'פיזיקה']
        }

        text = (title + ' ' + content).lower()
        max_matches = 0
        detected_category = 'general'

        for category, keywords in categories.items():
            matches = sum(1 for keyword in keywords if keyword in text)
            if matches > max_matches:
                max_matches = matches
                detected_category = category

        return detected_category

    async def scrape_source(self, source_name: str, source_config: Dict[str, str]):
        """
        Scrape articles from a specific source
        """
        html = await self.fetch_page(source_config['url'])
        if not html:
            return

        article = self.parse_article(html, source_config)
        if article:
            # Check if article already exists
            existing = self.db.query(models.NewsItem).filter_by(
                title=article['title'],
                source=article['source']
            ).first()

            if not existing:
                news_item = models.NewsItem(**article)
                self.db.add(news_item)
                self.db.commit()
                logger.info(f"Added new article: {article['title']}")

    async def scrape_all_sources(self):
        """
        Scrape articles from all configured sources
        """
        tasks = []
        for source_name, source_config in self.sources.items():
            tasks.append(self.scrape_source(source_name, source_config))
        
        await asyncio.gather(*tasks)

    def run_scraper(self):
        """
        Run the scraper synchronously
        """
        asyncio.run(self.scrape_all_sources()) 