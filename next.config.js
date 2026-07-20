/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure environment variables are available in browser
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Enable experimental features for better error handling
  experimental: {
    // Required on Next 14 so src/instrumentation.ts (Sentry init) is loaded.
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      '@supabase/supabase-js',
      'google-ads-api',
      '@grpc/grpc-js',
      'google-gax',
      'puppeteer-core',
      '@sparticuz/chromium',
    ],
  },
  
  // Webpack configuration to exclude Google Ads from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mark Google Ads and gRPC as external for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http2: false,
      };
    }
    return config;
  },

  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // TypeScript errors now fail the build (all suppressed errors were fixed).
  // ESLint is still skipped during builds to avoid blocking on lint-only issues.
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const devCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' data: blob: https:; font-src 'self' data: blob:; connect-src 'self' ws: wss: https://*.supabase.co https://graph.facebook.com; frame-src 'self' blob:";
    const prodCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://graph.facebook.com https://*.vercel.app; frame-src 'self' blob:";

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

const { withSentryConfig } = require('@sentry/nextjs');

// Wrap with Sentry. Source-map upload only runs when SENTRY_AUTH_TOKEN (+ org/
// project) are set; otherwise it is skipped and the build still succeeds.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // We initialize Sentry ourselves via sentry.*.config.ts, so let the plugin
  // wire the client config but keep its footprint minimal.
  disableLogger: true,
  widenClientFileUpload: false,
}); 