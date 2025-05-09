from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from feed_aggregator import FeedAggregator

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
        data = await feed_aggregator.get_latest_data()
        news_items = data['news']
        
        if category and category != 'all':
            news_items = [item for item in news_items if item['category'] == category]
        
        return news_items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    Get trending news based on Google Trends
    """
    try:
        data = await feed_aggregator.get_latest_data()
        return data['trends']
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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