/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    // Proxy API requests to core-api directly (port 3001) since it's exposed to host
    // In production/Docker, this would go through api-gateway
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
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






