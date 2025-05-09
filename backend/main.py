from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
from database import SessionLocal, engine
from feed_aggregator import FeedAggregator
from analytics import EngagementAnalyzer
from content_optimizer import ContentOptimizer

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Topline News Aggregator")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "Welcome to Topline News Aggregator API"}

@app.get("/api/news", response_model=List[schemas.NewsItem])
async def get_news(
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Get news items with optional category filtering
    """
    try:
        news_items = models.NewsItem.get_news(db, category, limit, offset)
        return news_items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/{news_id}", response_model=schemas.NewsItemDetail)
async def get_news_detail(
    news_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific news item
    """
    try:
        news_item = models.NewsItem.get_by_id(db, news_id)
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
async def get_trending_news(
    db: Session = Depends(get_db)
):
    """
    Get trending news based on engagement metrics
    """
    try:
        analyzer = EngagementAnalyzer(db)
        trending_news = analyzer.get_trending_news()
        return trending_news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/aggregate")
async def aggregate_news(
    db: Session = Depends(get_db)
):
    """
    Aggregate news from all sources (RSS feeds, News API, Twitter trends, Google trends)
    """
    try:
        aggregator = FeedAggregator(db)
        aggregated_data = await aggregator.aggregate_all_sources()
        return aggregated_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/social-trends")
async def get_social_trends(
    db: Session = Depends(get_db)
):
    """
    Get trending topics from social media (Twitter and Google Trends)
    """
    try:
        aggregator = FeedAggregator(db)
        twitter_trends = await aggregator.fetch_twitter_trends()
        google_trends = await aggregator.fetch_google_trends()
        
        return {
            "twitter_trends": twitter_trends,
            "google_trends": google_trends
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 