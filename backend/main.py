from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from feed_aggregator import FeedAggregator
from typing import Optional, List, Dict
import logging
import asyncio
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Topline News Aggregator")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize feed aggregator
feed_aggregator = FeedAggregator()

@app.get("/")
async def root():
    return {"message": "Welcome to Topline News Aggregator API"}

@app.get("/api/news")
async def get_news(category: Optional[str] = None):
    """
    Get news items with optional category filtering
    """
    try:
        # Set a reasonable timeout for the entire operation
        data = await asyncio.wait_for(
            feed_aggregator.get_latest_data(),
            timeout=10.0  # 10 second timeout
        )
        
        news_items = data.get('news', [])
        
        if category and category != 'all':
            news_items = [item for item in news_items if item.get('category') == category]
        
        return {
            'status': 'success',
            'data': news_items,
            'timestamp': datetime.now().isoformat()
        }
        
    except asyncio.TimeoutError:
        logger.error("Timeout while fetching news")
        # Return cached data if available
        cached_data = feed_aggregator._cache.get('news', [])
        if cached_data:
            return {
                'status': 'success',
                'data': cached_data,
                'timestamp': feed_aggregator._cache.get('last_update', datetime.now()).isoformat(),
                'from_cache': True
            }
        raise HTTPException(status_code=504, detail="Request timed out")
        
    except Exception as e:
        logger.error(f"Error fetching news: {str(e)}")
        # Return cached data if available
        cached_data = feed_aggregator._cache.get('news', [])
        if cached_data:
            return {
                'status': 'success',
                'data': cached_data,
                'timestamp': feed_aggregator._cache.get('last_update', datetime.now()).isoformat(),
                'from_cache': True
            }
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/news/{news_id}")
async def get_news_detail(news_id: str):
    """
    Get detailed information about a specific news item
    """
    try:
        data = await feed_aggregator.get_latest_data()
        news_items = data['news']
        
        # Find the news item by URL (using URL as ID)
        news_item = next((item for item in news_items if item['url'] == news_id), None)
        
        if not news_item:
            raise HTTPException(status_code=404, detail="News item not found")
        
        return news_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/categories")
async def get_categories():
    """
    Get list of available news categories
    """
    return {
        "categories": [
            "all",
            "politics",
            "business",
            "technology",
            "sports",
            "entertainment",
            "health",
            "science"
        ]
    }

@app.get("/api/trending")
async def get_trending_news():
    """
    Get trending news items
    """
    try:
        # Set a reasonable timeout for the entire operation
        trending_items = await asyncio.wait_for(
            feed_aggregator.get_trending_news(),
            timeout=8.0  # 8 second timeout
        )
        
        return {
            'status': 'success',
            'data': trending_items,
            'timestamp': datetime.now().isoformat()
        }
        
    except asyncio.TimeoutError:
        logger.error("Timeout while fetching trending news")
        # Return cached trending data if available
        cached_trending = feed_aggregator._cache.get('trending_news', [])
        if cached_trending:
            return {
                'status': 'success',
                'data': cached_trending,
                'timestamp': feed_aggregator._cache.get('trending_last_update', datetime.now()).isoformat(),
                'from_cache': True
            }
        # Fall back to recent news
        return {
            'status': 'success',
            'data': feed_aggregator._cache.get('news', [])[:10],
            'timestamp': datetime.now().isoformat(),
            'from_cache': True
        }
        
    except Exception as e:
        logger.error(f"Error fetching trending news: {str(e)}")
        # Return cached trending data if available
        cached_trending = feed_aggregator._cache.get('trending_news', [])
        if cached_trending:
            return {
                'status': 'success',
                'data': cached_trending,
                'timestamp': feed_aggregator._cache.get('trending_last_update', datetime.now()).isoformat(),
                'from_cache': True
            }
        # Fall back to recent news
        return {
            'status': 'success',
            'data': feed_aggregator._cache.get('news', [])[:10],
            'timestamp': datetime.now().isoformat(),
            'from_cache': True
        }

@app.get("/api/aggregate")
async def aggregate_news():
    """
    Get all news and trends
    """
    try:
        return await feed_aggregator.get_latest_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 