/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',
      // Add your Supabase storage domain
      'your-project.supabase.co',
      // Add any other image domains you'll use
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/webhooks/:path*',
        destination: '/api/webhooks/:path*',
      },
    ];
  },
  // Environment variables will be handled by Next.js automatically
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Output configuration for Vercel
  output: 'standalone',
};

module.exports = nextConfig; 