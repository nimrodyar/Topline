'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useQuery } from 'react-query';
import axios from 'axios';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  engagement: {
    views: number;
    shares: number;
    comments: number;
  };
  publishedAt: string;
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const { data: newsItems, isLoading } = useQuery<NewsItem[]>(
    ['news', selectedCategory],
    async () => {
      const response = await axios.get(`/api/news?category=${selectedCategory}`);
      return response.data;
    }
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Topline</h1>
            <nav className="flex space-x-4">
              <button className="text-gray-600 hover:text-gray-900">Search</button>
              <button className="text-gray-600 hover:text-gray-900">Menu</button>
            </nav>
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 overflow-x-auto py-4">
            {['all', 'politics', 'business', 'technology', 'sports'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {newsItems?.map((item, index) => (
              <motion.article
                key={item.id}
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">{item.title}</h2>
                  <p className="text-gray-600 mb-4">{item.content}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{item.engagement.views} views</span>
                    <span>{item.engagement.shares} shares</span>
                    <span>{item.engagement.comments} comments</span>
                  </div>
                </div>
                {/* Ad Space */}
                <div className="bg-gray-100 p-4 text-center text-sm text-gray-500">
                  Advertisement
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 