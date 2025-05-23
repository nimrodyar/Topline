from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from feed_aggregator import FeedAggregator
from typing import Optional, List, Dict
import logging
import asyncio
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
    return {"message": "Welcome to Topline News Aggregator API", "status": "healthy"}

@app.get("/api/news")
async def get_news(category: Optional[str] = None, page: int = 1):
    """Get news items with optional category filtering"""
    try:
        # Try to get news from News API first
        news_items = await fetch_news_api(category)
        
        # If News API fails or returns no items, fall back to RSS feeds
        if not news_items:
            logger.warning("No news items from News API, falling back to RSS feeds")
            news_items = await fetch_rss_feeds()
            
            # Filter by category if specified
            if category and category != 'all':
                news_items = [item for item in news_items if item.get('category') == category]
        
        # Sort by published date
        news_items.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        
        # Paginate results
        start_idx = (page - 1) * 20
        end_idx = start_idx + 20
        paginated_items = news_items[start_idx:end_idx]
        
        if not paginated_items:
            logger.warning(f"No news items found for category: {category}")
            return {"data": [], "message": "No news items found"}
            
        return {"data": paginated_items}
        
    except Exception as e:
        logger.error(f"Error fetching news: {str(e)}")
        return {"error": "Failed to fetch news", "message": str(e)}

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
async def get_trending():
    """Get trending news items"""
    try:
        # Try to get trending news from News API first
        trending_items = await fetch_news_api()
        
        # If News API fails or returns no items, fall back to RSS feeds
        if not trending_items:
            logger.warning("No trending items from News API, falling back to RSS feeds")
            trending_items = await fetch_rss_feeds()
            
        # Sort by published date and take top 5
        trending_items.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        trending_items = trending_items[:5]
        
        if not trending_items:
            logger.warning("No trending items found")
            return {"data": [], "message": "No trending items found"}
            
        return {"data": trending_items}
        
    except Exception as e:
        logger.error(f"Error fetching trending news: {str(e)}")
        return {"error": "Failed to fetch trending news", "message": str(e)}

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
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port) 