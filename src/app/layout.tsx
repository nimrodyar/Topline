'use client'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryClient, QueryClientProvider } from "react-query"

const inter = Inter({ subsets: ['latin'] })

const queryClient = new QueryClient()

export const metadata: Metadata = {
  title: 'Topline - Smart News Aggregator',
  description: 'Your personalized news aggregator with smart content optimization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
} 