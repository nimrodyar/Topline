from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import models
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class EngagementAnalyzer:
    def __init__(self, db: Session):
        self.db = db

    def calculate_engagement_score(self, views: int, shares: int, comments: int) -> float:
        """
        Calculate engagement score based on various metrics
        """
        # Weight factors for different engagement types
        VIEW_WEIGHT = 1.0
        SHARE_WEIGHT = 2.0
        COMMENT_WEIGHT = 3.0

        # Calculate weighted score
        score = (
            views * VIEW_WEIGHT +
            shares * SHARE_WEIGHT +
            comments * COMMENT_WEIGHT
        )

        # Normalize score (optional)
        # score = score / (VIEW_WEIGHT + SHARE_WEIGHT + COMMENT_WEIGHT)

        return score

    def update_engagement_metrics(self, news_id: str, view: bool = False, share: bool = False, comment: bool = False):
        """
        Update engagement metrics for a news item
        """
        try:
            news_item = self.db.query(models.NewsItem).filter_by(id=news_id).first()
            if not news_item:
                return

            if view:
                news_item.views += 1
            if share:
                news_item.shares += 1
            if comment:
                news_item.comments += 1

            # Update engagement score
            news_item.engagement_score = self.calculate_engagement_score(
                news_item.views,
                news_item.shares,
                news_item.comments
            )

            # Record in engagement history
            history = models.EngagementHistory(
                news_item_id=news_id,
                views=1 if view else 0,
                shares=1 if share else 0,
                comments=1 if comment else 0
            )
            self.db.add(history)

            self.db.commit()
            logger.info(f"Updated engagement metrics for news item {news_id}")

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating engagement metrics: {str(e)}")

    def get_trending_news(self, limit: int = 10, time_window: int = 24) -> List[Dict[str, Any]]:
        """
        Get trending news based on engagement metrics
        """
        try:
            # Calculate time threshold
            time_threshold = datetime.utcnow() - timedelta(hours=time_window)

            # Query news items with engagement metrics
            trending_news = (
                self.db.query(models.NewsItem)
                .filter(models.NewsItem.published_at >= time_threshold)
                .order_by(desc(models.NewsItem.engagement_score))
                .limit(limit)
                .all()
            )

            return [
                {
                    'id': news.id,
                    'title': news.title,
                    'content': news.content,
                    'source': news.source,
                    'published_at': news.published_at,
                    'engagement': {
                        'views': news.views,
                        'shares': news.shares,
                        'comments': news.comments,
                        'score': news.engagement_score
                    }
                }
                for news in trending_news
            ]

        except Exception as e:
            logger.error(f"Error getting trending news: {str(e)}")
            return []

    def get_engagement_stats(self, news_id: str) -> Dict[str, Any]:
        """
        Get detailed engagement statistics for a news item
        """
        try:
            news_item = self.db.query(models.NewsItem).filter_by(id=news_id).first()
            if not news_item:
                return {}

            # Get engagement history
            history = (
                self.db.query(models.EngagementHistory)
                .filter_by(news_item_id=news_id)
                .order_by(models.EngagementHistory.timestamp)
                .all()
            )

            # Calculate engagement over time
            engagement_over_time = [
                {
                    'timestamp': h.timestamp,
                    'views': h.views,
                    'shares': h.shares,
                    'comments': h.comments
                }
                for h in history
            ]

            return {
                'total_views': news_item.views,
                'total_shares': news_item.shares,
                'total_comments': news_item.comments,
                'engagement_score': news_item.engagement_score,
                'engagement_over_time': engagement_over_time
            }

        except Exception as e:
            logger.error(f"Error getting engagement stats: {str(e)}")
            return {} 