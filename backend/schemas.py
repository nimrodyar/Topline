from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class EngagementMetrics(BaseModel):
    views: int = Field(default=0)
    shares: int = Field(default=0)
    comments: int = Field(default=0)
    score: float = Field(default=0.0)

class NewsItemBase(BaseModel):
    title: str
    content: str
    source: str
    category: str
    published_at: datetime

class NewsItemCreate(NewsItemBase):
    pass

class NewsItem(NewsItemBase):
    id: str
    created_at: datetime
    updated_at: datetime
    engagement: EngagementMetrics
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None

    class Config:
        from_attributes = True

class NewsItemDetail(NewsItem):
    engagement_history: List[Dict[str, Any]]
    comments: List[Dict[str, Any]]

class CommentBase(BaseModel):
    content: str
    author: Optional[str] = None

class CommentCreate(CommentBase):
    news_item_id: str

class Comment(CommentBase):
    id: str
    news_item_id: str
    created_at: datetime
    likes: int = 0

    class Config:
        from_attributes = True

class AdPlacementBase(BaseModel):
    news_item_id: str
    position: int
    ad_type: str
    status: str

class AdPlacementCreate(AdPlacementBase):
    pass

class AdPlacement(AdPlacementBase):
    id: str
    created_at: datetime
    updated_at: datetime
    impressions: int = 0
    clicks: int = 0
    revenue: float = 0.0

    class Config:
        from_attributes = True

class EngagementStats(BaseModel):
    total_views: int
    total_shares: int
    total_comments: int
    engagement_score: float
    engagement_over_time: List[Dict[str, Any]]

class OptimizedContent(BaseModel):
    content: str
    seo_metadata: Dict[str, str] 