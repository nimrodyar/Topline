import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
CLOUDFLARE_API_KEY = os.getenv('CLOUDFLARE_API_KEY')

# API Endpoints
CLOUDFLARE_ENDPOINT = 'https://api.cloudflare.com/client/v4/ai/run/@cf/meta/llama-2-7b-chat-int8'

# RSS Feed Sources
RSS_FEEDS = {
    'ynet': {
        'main': 'http://www.ynet.co.il/Integration/StoryRss2.xml',
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

# Cache Settings
CACHE_TTL = {
    'news': 300,  # 5 minutes
    'trending': 300  # 5 minutes
}

MAX_ITEMS = {
    'news': 100,
    'trending': 20
}

# Timeouts
TIMEOUTS = {
    'feed_request': 10,  # seconds
    'api_request': 15,   # seconds
    'image_extraction': 5  # seconds
}

# Categories
CATEGORIES = [
    'general',
    'politics',
    'business',
    'technology',
    'sports',
    'entertainment',
    'health',
    'science'
]

# Error Messages
ERROR_MESSAGES = {
    'feed_fetch': 'Failed to fetch news feed',
    'image_extraction': 'Failed to extract image',
    'api_error': 'API request failed',
    'timeout': 'Request timed out'
}

# Content Extraction Patterns
CONTENT_PATTERNS = {
    'image_meta': [
        'og:image',
        'twitter:image',
        'image'
    ],
    'content_indicators': [
        'article-content',
        'story-content',
        'main-content'
    ]
}

# Translation Settings
TRANSLATION = {
    'source_lang': 'he',
    'target_lang': 'en'
}

# Logging Configuration
LOGGING = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
} 