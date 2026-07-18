import type { NextConfig } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/intake-api/:path*',
        destination: `${API_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
