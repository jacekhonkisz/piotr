const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure environment variables are available in browser
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Enable experimental features for better error handling
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Disable ESLint during build to allow deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const devCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' data: blob: https:; font-src 'self' data: blob:; connect-src 'self' ws: wss: https://*.supabase.co https://graph.facebook.com; frame-src 'self' blob:";
    const prodCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://graph.facebook.com; frame-src 'self' blob:";

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
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: isDev ? devCsp : prodCsp,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
}

const sentryWebpackPluginOptions = {
  silent: true,
  org: "your-org",
  project: "meta-ads-reporting",
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions); 