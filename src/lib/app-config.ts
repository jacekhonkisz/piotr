/**
 * Centralized Application Configuration
 * 
 * This file contains all configuration values for the application,
 * ensuring consistent behavior across development and production environments.
 */

export interface AppConfig {
  app: {
    baseUrl: string;
    environment: string;
    isDevelopment: boolean;
    isProduction: boolean;
  };
  cache: {
    smartCacheDuration: number;
    profileCacheDuration: number;
    queryCacheDuration: number;
    executiveSummaryRetentionMonths: number;
  };
  api: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  external: {
    resendApiKey: string;
    openaiApiKey: string;
    metaAccessToken: string;
  };
}

/**
 * Get the base URL for the application
 * Handles both development and production environments
 */
export function getBaseUrl(): string {
  // In production, use the configured app URL
  if (process.env.NODE_ENV === 'production') {
    const prodUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!prodUrl) {
      console.error('❌ NEXT_PUBLIC_APP_URL is required in production');
      throw new Error('NEXT_PUBLIC_APP_URL environment variable is required in production');
    }
    return prodUrl;
  }
  
  // In development, use localhost
  return 'http://localhost:3000';
}

/**
 * Validate required environment variables using the centralized validator
 * Throws an error if any required variables are missing
 */
export function validateEnvironment(): void {
  const { validateEnvironmentOrThrow } = require('./environment-validator');
  validateEnvironmentOrThrow();
}

/**
 * Get the complete application configuration
 */
export function getAppConfig(): AppConfig {
  // Validate environment first
  validateEnvironment();

  const environment = process.env.NODE_ENV || 'development';
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  return {
    app: {
      baseUrl: getBaseUrl(),
      environment,
      isDevelopment,
      isProduction,
    },
    cache: {
      smartCacheDuration: 3 * 60 * 60 * 1000, // 3 hours
      profileCacheDuration: 10 * 60 * 1000,   // 10 minutes
      queryCacheDuration: 2 * 60 * 1000,      // 2 minutes
      executiveSummaryRetentionMonths: 12,     // 12 months
    },
    api: {
      timeout: 60000,        // 60 seconds
      maxRetries: 3,         // 3 retry attempts
      retryDelay: 1000,      // 1 second base delay
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    external: {
      resendApiKey: process.env.RESEND_API_KEY || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      metaAccessToken: process.env.META_ACCESS_TOKEN || '',
    },
  };
}

// Export singleton instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = getAppConfig();
  }
  return configInstance;
}

// Export commonly used values for convenience
export const config = {
  get baseUrl() { return getBaseUrl(); },
  get isDevelopment() { return process.env.NODE_ENV === 'development'; },
  get isProduction() { return process.env.NODE_ENV === 'production'; },
};
