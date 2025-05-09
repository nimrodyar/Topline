from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class NewsItem(Base):
    __tablename__ = "news_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    original_url = Column(String, nullable=False)
    source = Column(String, nullable=False)
    category = Column(String, nullable=False)
    published_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Content display fields
    image_url = Column(String)
    author = Column(String)
    source_attribution = Column(JSON)  # Stores source name, URL, and logo

    # Engagement metrics
    views = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    engagement_score = Column(Float, default=0.0)

    # SEO metrics
    seo_title = Column(String)
    seo_description = Column(Text)
    seo_keywords = Column(String)

    # Relationships
    engagement_history = relationship("EngagementHistory", back_populates="news_item")
    comments_list = relationship("Comment", back_populates="news_item")

    @classmethod
    def get_news(cls, db, category=None, limit=20, offset=0):
        query = db.query(cls)
        if category and category != "all":
            query = query.filter(cls.category == category)
        return query.order_by(cls.published_at.desc()).offset(offset).limit(limit).all()

    @classmethod
    def get_by_id(cls, db, news_id):
        return db.query(cls).filter(cls.id == news_id).first()

    def to_dict(self):
        """
        Convert news item to dictionary with all necessary fields for UI display
        """
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'source': self.source,
            'category': self.category,
            'published_at': self.published_at.isoformat(),
            'image_url': self.image_url,
            'author': self.author,
            'source_attribution': self.source_attribution,
            'engagement': {
                'views': self.views,
                'shares': self.shares,
                'comments': self.comments,
                'score': self.engagement_score
            },
            'original_url': self.original_url
        }

class EngagementHistory(Base):
    __tablename__ = "engagement_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_item_id = Column(String, ForeignKey("news_items.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    views = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)

    # Relationship
    news_item = relationship("NewsItem", back_populates="engagement_history")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_item_id = Column(String, ForeignKey("news_items.id"))
    content = Column(Text, nullable=False)
    author = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    likes = Column(Integer, default=0)

    # Relationship
    news_item = relationship("NewsItem", back_populates="comments_list")

class AdPlacement(Base):
    __tablename__ = "ad_placements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    news_item_id = Column(String, ForeignKey("news_items.id"))
    position = Column(Integer)  # Position in the article (paragraph number)
    ad_type = Column(String)  # banner, native, etc.
    status = Column(String)  # active, inactive
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Metrics
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    revenue = Column(Float, default=0.0) 