/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['news.walla.co.il', 'www.mako.co.il', 'www.n12.co.il'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://topline-l89o.onrender.com/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig 