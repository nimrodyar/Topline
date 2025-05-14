import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: 'Topline News',
  description: 'Your source for the latest news',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`bg-bg text-text font-main ${inter.className}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
} 