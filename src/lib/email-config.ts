/**
 * Email Configuration
 * 
 * This file contains email-related configuration settings.
 * Update MONITORING_MODE and MONITORING_EMAILS when ready for production.
 */

export const EMAIL_CONFIG = {
  // Set to false when ready for production
  MONITORING_MODE: false, // ✅ PRODUCTION: Disabled monitoring mode
  
  // Monitoring email addresses (only used when MONITORING_MODE is true)
  // Updated to use verified Resend email address
  MONITORING_EMAILS: [
    // 'pbajerlein@gmail.com'  // Disabled for production
  ],
  
  // Email settings
  RATE_LIMIT: {
    MAX_REQUESTS: 10,     // Resend allows 10 requests per second
    WINDOW_MS: 1000,      // 1 second window
    RETRY_AFTER_MS: 1000  // Wait 1 second before retry
  },
  
  // Subject prefixes
  MONITORING_SUBJECT_PREFIX: '[MONITORING]',
  
  // Monitoring notice styling
  MONITORING_NOTICE_STYLE: {
    background: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '15px',
    margin: '20px 0',
    fontFamily: 'Arial, sans-serif'
  },
  
  // Delays between emails (in milliseconds)
  MONITORING_EMAIL_DELAY: 100, // Small delay between monitoring emails
  
  // Logging settings
  LOG_ORIGINAL_RECIPIENTS: true,
  LOG_MONITORING_REDIRECTS: true
} as const;

/**
 * Get monitoring emails based on current configuration
 */
export function getMonitoringEmails(): string[] {
  return EMAIL_CONFIG.MONITORING_MODE ? [...EMAIL_CONFIG.MONITORING_EMAILS] : [];
}

/**
 * Check if monitoring mode is enabled
 */
export function isMonitoringMode(): boolean {
  return EMAIL_CONFIG.MONITORING_MODE;
}

/**
 * Get the appropriate recipient(s) for an email
 * In monitoring mode, returns monitoring emails
 * In production mode, returns the original recipient
 */
export function getEmailRecipients(originalRecipient: string): string[] {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return [...EMAIL_CONFIG.MONITORING_EMAILS];
  }
  return [originalRecipient];
}

/**
 * Get the appropriate subject for an email
 * In monitoring mode, adds monitoring prefix
 * In production mode, returns original subject
 */
export function getEmailSubject(originalSubject: string): string {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return `${EMAIL_CONFIG.MONITORING_SUBJECT_PREFIX} ${originalSubject}`;
  }
  return originalSubject;
}
