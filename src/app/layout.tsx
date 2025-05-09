'use client'

import { Inter } from "next/font/google"
import "./globals.css"
import { QueryClient, QueryClientProvider } from "react-query"

const inter = Inter({ subsets: ["latin"] })

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Topline News</title>
        <meta name="description" content="Your source for the latest news" />
      </head>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
} 