from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from feed_aggregator import FeedAggregator, get_news
from typing import Optional, List, Dict
import logging

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
async def get_news_endpoint(
    category: Optional[str] = Query(None, description="Category to filter news by"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page")
) -> Dict:
    """
    Get news from all sources with optional category filtering and pagination
    """
    try:
        # Fetch news with optional category filter
        news_items = await get_news(category)
        
        # Calculate pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_items = news_items[start_idx:end_idx]
        
        return {
            "status": "success",
            "data": {
                "items": paginated_items,
                "total": len(news_items),
                "page": page,
                "per_page": per_page,
                "total_pages": (len(news_items) + per_page - 1) // per_page
            }
        }
        
    except Exception as e:
        logger.error(f"Error in news endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error fetching news"
        )

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
async def get_categories() -> Dict:
    """Get available news categories"""
    from feed_aggregator import VALID_CATEGORIES
    return {
        "status": "success",
        "data": sorted(list(VALID_CATEGORIES))
    }

@app.get("/api/trending")
async def get_trending_news() -> Dict:
    """Get trending news items"""
    try:
        trending_items = await feed_aggregator.get_trending_news()
        return {
            "status": "success",
            "data": trending_items
        }
    except Exception as e:
        logger.error(f"Error in trending endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error fetching trending news"
        )

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