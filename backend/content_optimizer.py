import openai
from typing import List, Dict, Any
import logging
from sqlalchemy.orm import Session
import models
import os
from dotenv import load_dotenv

load_dotenv()

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

logger = logging.getLogger(__name__)

class ContentOptimizer:
    def __init__(self, db: Session):
        self.db = db

    async def optimize_content(self, news_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Optimize content by combining and rewriting multiple news items
        """
        try:
            # Combine content from multiple sources
            combined_content = self._combine_content(news_items)
            
            # Generate optimized content using OpenAI
            optimized_content = await self._generate_optimized_content(combined_content)
            
            # Extract SEO metadata
            seo_metadata = self._extract_seo_metadata(optimized_content)
            
            return {
                'content': optimized_content,
                'seo_metadata': seo_metadata
            }
        except Exception as e:
            logger.error(f"Error optimizing content: {str(e)}")
            return None

    def _combine_content(self, news_items: List[Dict[str, Any]]) -> str:
        """
        Combine content from multiple news items
        """
        combined = []
        for item in news_items:
            combined.append(f"Source: {item['source']}\n")
            combined.append(f"Title: {item['title']}\n")
            combined.append(f"Content: {item['content']}\n")
            combined.append("---\n")
        
        return "\n".join(combined)

    async def _generate_optimized_content(self, combined_content: str) -> str:
        """
        Generate optimized content using OpenAI
        """
        try:
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert news editor. Your task is to:
                        1. Combine information from multiple sources
                        2. Create a coherent, well-structured article
                        3. Maintain factual accuracy
                        4. Use clear, engaging language
                        5. Include relevant quotes and statistics
                        6. Ensure proper attribution to sources"""
                    },
                    {
                        "role": "user",
                        "content": f"Please rewrite and optimize this news content:\n\n{combined_content}"
                    }
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating optimized content: {str(e)}")
            return combined_content

    def _extract_seo_metadata(self, content: str) -> Dict[str, str]:
        """
        Extract SEO metadata from content
        """
        try:
            # Generate SEO title
            title_response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "Generate an SEO-optimized title (max 60 characters) for this content:"
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                temperature=0.7,
                max_tokens=100
            )
            
            # Generate SEO description
            description_response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "Generate an SEO-optimized meta description (max 160 characters) for this content:"
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            # Generate keywords
            keywords_response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract the top 5 most relevant keywords for SEO from this content:"
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                temperature=0.7,
                max_tokens=100
            )
            
            return {
                'title': title_response.choices[0].message.content.strip(),
                'description': description_response.choices[0].message.content.strip(),
                'keywords': keywords_response.choices[0].message.content.strip()
            }
        except Exception as e:
            logger.error(f"Error extracting SEO metadata: {str(e)}")
            return {
                'title': '',
                'description': '',
                'keywords': ''
            }

    def update_news_item_seo(self, news_id: str, seo_metadata: Dict[str, str]):
        """
        Update SEO metadata for a news item
        """
        try:
            news_item = self.db.query(models.NewsItem).filter_by(id=news_id).first()
            if not news_item:
                return

            news_item.seo_title = seo_metadata['title']
            news_item.seo_description = seo_metadata['description']
            news_item.seo_keywords = seo_metadata['keywords']

            self.db.commit()
            logger.info(f"Updated SEO metadata for news item {news_id}")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating SEO metadata: {str(e)}") 