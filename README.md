# Topline - Smart News Aggregator

A sophisticated news aggregation platform that combines content from multiple Israeli news sources, analyzes engagement metrics, and presents optimized content with a focus on user experience and monetization.

## Features

- Real-time news aggregation from multiple Israeli sources
- Engagement analytics and trend detection
- AI-powered content optimization
- Mobile-first responsive design
- Smart ad placement system
- Legal compliance with content usage

## Tech Stack

- Frontend: Next.js 14 with TypeScript
- Backend: Python FastAPI
- Database: PostgreSQL
- Analytics: Custom engagement tracking system
- AI: OpenAI GPT-4 for content optimization
- Scraping: Custom built with legal compliance

## Project Structure

```
topline/
├── frontend/           # Next.js frontend application
├── backend/           # Python FastAPI backend
├── scraper/          # News scraping system
├── analytics/        # Engagement tracking system
└── docs/            # Documentation
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd backend
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development servers:
   ```bash
   # Frontend
   cd frontend
   npm run dev

   # Backend
   cd backend
   uvicorn main:app --reload
   ```

## Legal Compliance

This project adheres to fair use principles and implements proper attribution and content usage policies. All scraped content is used in accordance with the respective news sources' terms of service and copyright laws.

## License

MIT License - See LICENSE file for details 