/**
 * AI Summary Configuration
 * 
 * Centralized configuration for AI summary generation in production
 */

export interface AISummaryConfig {
  // OpenAI Configuration
  openai: {
    model: string;
    maxTokens: number;
    temperature: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  
  // Cost Control
  costControl: {
    maxDailyCost: number;
    maxMonthlyCost: number;
    costPerToken: number;
  };
  
  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
  };
  
  // Fallback Configuration
  fallback: {
    enabled: boolean;
    useInDevelopment: boolean;
    useInCheapMode: boolean;
  };
  
  // Monitoring
  monitoring: {
    logPerformance: boolean;
    logCosts: boolean;
    logErrors: boolean;
  };
}

export const defaultConfig: AISummaryConfig = {
  openai: {
    model: 'gpt-3.5-turbo',
    maxTokens: 300,
    temperature: 0.5,
    maxRetries: 3,
    retryDelayMs: 1000
  },
  
  costControl: {
    maxDailyCost: 10.0, // $10 per day
    maxMonthlyCost: 300.0, // $300 per month
    costPerToken: 0.0015 / 1000 // $0.0015 per 1K tokens
  },
  
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000
  },
  
  fallback: {
    enabled: true,
    useInDevelopment: true,
    useInCheapMode: true
  },
  
  monitoring: {
    logPerformance: true,
    logCosts: true,
    logErrors: true
  }
};

export function getAISummaryConfig(): AISummaryConfig {
  return {
    ...defaultConfig,
    // Override with environment variables if available
    openai: {
      ...defaultConfig.openai,
      model: process.env.OPENAI_MODEL || defaultConfig.openai.model,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '300'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.5'),
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.OPENAI_RETRY_DELAY_MS || '1000')
    },
    
    costControl: {
      ...defaultConfig.costControl,
      maxDailyCost: parseFloat(process.env.AI_MAX_DAILY_COST || '10.0'),
      maxMonthlyCost: parseFloat(process.env.AI_MAX_MONTHLY_COST || '300.0')
    },
    
    fallback: {
      ...defaultConfig.fallback,
      enabled: process.env.AI_FALLBACK_ENABLED !== 'false',
      useInDevelopment: process.env.AI_USE_FALLBACK_IN_DEV !== 'false',
      useInCheapMode: process.env.AI_USE_FALLBACK_IN_CHEAP_MODE !== 'false'
    }
  };
}

export function validateConfig(config: AISummaryConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.openai.maxTokens < 50 || config.openai.maxTokens > 4000) {
    errors.push('maxTokens must be between 50 and 4000');
  }
  
  if (config.openai.temperature < 0 || config.openai.temperature > 2) {
    errors.push('temperature must be between 0 and 2');
  }
  
  if (config.openai.maxRetries < 1 || config.openai.maxRetries > 10) {
    errors.push('maxRetries must be between 1 and 10');
  }
  
  if (config.costControl.maxDailyCost < 0) {
    errors.push('maxDailyCost must be positive');
  }
  
  if (config.costControl.maxMonthlyCost < 0) {
    errors.push('maxMonthlyCost must be positive');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
