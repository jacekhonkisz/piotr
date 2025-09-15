/**
 * Email Provider Configuration
 * 
 * This file manages email provider settings for different environments and use cases.
 * Easy to switch between Resend, Gmail, and other providers.
 */

export interface EmailProviderConfig {
  provider: 'resend' | 'gmail' | 'auto';
  resend: {
    apiKey: string;
    fromAddress: string;
    verifiedDomains: string[];
  };
  gmail: {
    user: string;
    appPassword: string;
  };
  routing: {
    // Email patterns that should use specific providers
    patterns: Array<{
      pattern: RegExp;
      provider: 'resend' | 'gmail';
      reason: string;
    }>;
  };
}

export const EMAIL_PROVIDER_CONFIG: EmailProviderConfig = {
  // Default provider (auto = smart selection based on recipient)
  provider: 'auto',
  
  // Resend configuration
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
    verifiedDomains: ['resend.dev'], // Add your custom domains here
  },
  
  // Gmail configuration
  gmail: {
    user: process.env.GMAIL_USER || 'jac.honkisz@gmail.com',
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
  },
  
  // Smart routing rules
  routing: {
    patterns: [
      {
        pattern: /jac\.honkisz@gmail\.com/i,
        provider: 'gmail',
        reason: 'Direct delivery to Jac for testing'
      },
      {
        pattern: /pbajerlein@gmail\.com/i,
        provider: 'resend',
        reason: 'Verified Resend address'
      },
      {
        pattern: /@.*\.com$/i,
        provider: 'resend',
        reason: 'Production client emails via Resend'
      }
    ]
  }
};

/**
 * Get the appropriate email provider for a given recipient
 */
export function getProviderForRecipient(recipient: string): 'resend' | 'gmail' {
  // Check routing patterns first
  for (const rule of EMAIL_PROVIDER_CONFIG.routing.patterns) {
    if (rule.pattern.test(recipient)) {
      return rule.provider;
    }
  }
  
  // Default to Resend for production emails
  return 'resend';
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: 'resend' | 'gmail'): boolean {
  switch (provider) {
    case 'resend':
      return !!(EMAIL_PROVIDER_CONFIG.resend.apiKey && EMAIL_PROVIDER_CONFIG.resend.fromAddress);
    case 'gmail':
      return !!(EMAIL_PROVIDER_CONFIG.gmail.user && EMAIL_PROVIDER_CONFIG.gmail.appPassword);
    default:
      return false;
  }
}

/**
 * Get configuration status for all providers
 */
export function getProviderStatus() {
  return {
    resend: {
      configured: isProviderConfigured('resend'),
      fromAddress: EMAIL_PROVIDER_CONFIG.resend.fromAddress,
      verifiedDomains: EMAIL_PROVIDER_CONFIG.resend.verifiedDomains
    },
    gmail: {
      configured: isProviderConfigured('gmail'),
      user: EMAIL_PROVIDER_CONFIG.gmail.user
    },
    defaultProvider: EMAIL_PROVIDER_CONFIG.provider
  };
}
