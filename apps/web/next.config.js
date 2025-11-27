/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output for Docker deployment
  transpilePackages: ['@okr-nexus/types', '@okr-nexus/utils'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_OKR_TREE_VIEW: process.env.NEXT_PUBLIC_OKR_TREE_VIEW,
  },
  eslint: {
    // Ignore ESLint warnings during build (console.log statements are intentional for debugging)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build if needed
    ignoreBuildErrors: false,
  },
  // Ensure version.json is accessible and proxy API requests to backend
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const isUsingApiGateway = backendUrl && 
      !backendUrl.includes('localhost:3001') && 
      !backendUrl.includes('localhost:3000')
    
    // Only use rewrites in development (direct to core-api)
    // In production with API Gateway, axios makes direct requests (no rewrite needed)
    if (isUsingApiGateway) {
      return [
        {
          source: '/version.json',
          destination: '/version.json',
        },
      ]
    }
    
    // Development: Proxy API requests to core-api directly (port 3001)
    return [
      {
        source: '/version.json',
        destination: '/version.json',
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig







