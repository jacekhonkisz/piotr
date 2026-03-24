/**
 * Email Configuration
 * 
 * Supports two modes:
 * - REVIEW MODE (default): All emails redirect to kontakt@piotrbajerlein.pl for manual review
 * - DIRECT MODE: Emails go directly to client addresses
 * 
 * The mode is stored in the `settings` table and toggled from the Calendar UI.
 */

import { createClient } from '@supabase/supabase-js';

const REVIEW_EMAIL = 'kontakt@piotrbajerlein.pl';

export const EMAIL_CONFIG = {
  MONITORING_MODE: false,
  
  REVIEW_MODE_DEFAULT: true,
  REVIEW_EMAIL,
  
  MONITORING_EMAILS: [
    'pbajerlein@gmail.com'
  ],
  
  RATE_LIMIT: {
    MAX_REQUESTS: 2,
    WINDOW_MS: 1000,
    RETRY_AFTER_MS: 1000
  },
  
  MONITORING_SUBJECT_PREFIX: '[MONITORING]',
  REVIEW_SUBJECT_PREFIX: '[DO WERYFIKACJI]',
  
  MONITORING_NOTICE_STYLE: {
    background: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '15px',
    margin: '20px 0',
    fontFamily: 'Arial, sans-serif'
  },
  
  MONITORING_EMAIL_DELAY: 100,
  
  LOG_ORIGINAL_RECIPIENTS: true,
  LOG_MONITORING_REDIRECTS: true
} as const;

// --- Review Mode Cache ---
let _reviewModeCache: { value: boolean; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Fetch review mode setting from database with caching.
 * Falls back to REVIEW_MODE_DEFAULT (true) if not yet stored.
 */
export async function isReviewMode(): Promise<boolean> {
  if (_reviewModeCache && Date.now() - _reviewModeCache.fetchedAt < CACHE_TTL_MS) {
    return _reviewModeCache.value;
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_review_mode')
      .single();

    if (error || !data) {
      _reviewModeCache = { value: EMAIL_CONFIG.REVIEW_MODE_DEFAULT, fetchedAt: Date.now() };
      return EMAIL_CONFIG.REVIEW_MODE_DEFAULT;
    }

    const enabled = data.value === 'true';
    _reviewModeCache = { value: enabled, fetchedAt: Date.now() };
    return enabled;
  } catch {
    return _reviewModeCache?.value ?? EMAIL_CONFIG.REVIEW_MODE_DEFAULT;
  }
}

/**
 * Update review mode setting in the database. Busts the cache immediately.
 */
export async function setReviewMode(enabled: boolean): Promise<boolean> {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'email_review_mode',
          value: String(enabled),
          description: 'When true, all report emails redirect to kontakt@piotrbajerlein.pl for review',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Failed to update email_review_mode:', error);
      return false;
    }

    _reviewModeCache = { value: enabled, fetchedAt: Date.now() };
    return true;
  } catch (err) {
    console.error('Failed to update email_review_mode:', err);
    return false;
  }
}

/** Bust cache (useful after toggling in the same process) */
export function bustReviewModeCache(): void {
  _reviewModeCache = null;
}

// --- Legacy monitoring helpers (kept for backward compat) ---

export function getMonitoringEmails(): string[] {
  return EMAIL_CONFIG.MONITORING_MODE ? [...EMAIL_CONFIG.MONITORING_EMAILS] : [];
}

export function isMonitoringMode(): boolean {
  return EMAIL_CONFIG.MONITORING_MODE;
}

/**
 * Synchronous recipient getter (used by FlexibleEmailService).
 * If review mode state is cached, uses it. Otherwise falls back to the static default.
 */
export function getEmailRecipients(originalRecipient: string): string[] {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return [...EMAIL_CONFIG.MONITORING_EMAILS];
  }
  const reviewEnabled = _reviewModeCache?.value ?? EMAIL_CONFIG.REVIEW_MODE_DEFAULT;
  if (reviewEnabled) {
    return [REVIEW_EMAIL];
  }
  return [originalRecipient];
}

/**
 * Async recipient getter — always reads the freshest setting.
 */
export async function getEmailRecipientsAsync(originalRecipient: string): Promise<{ recipients: string[]; originalRecipient: string; isRedirected: boolean }> {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return { recipients: [...EMAIL_CONFIG.MONITORING_EMAILS], originalRecipient, isRedirected: true };
  }
  const reviewEnabled = await isReviewMode();
  if (reviewEnabled) {
    return { recipients: [REVIEW_EMAIL], originalRecipient, isRedirected: true };
  }
  return { recipients: [originalRecipient], originalRecipient, isRedirected: false };
}

export function getEmailSubject(originalSubject: string): string {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return `${EMAIL_CONFIG.MONITORING_SUBJECT_PREFIX} ${originalSubject}`;
  }
  const reviewEnabled = _reviewModeCache?.value ?? EMAIL_CONFIG.REVIEW_MODE_DEFAULT;
  if (reviewEnabled) {
    return `${EMAIL_CONFIG.REVIEW_SUBJECT_PREFIX} ${originalSubject}`;
  }
  return originalSubject;
}

/**
 * Async subject getter — always reads freshest setting.
 */
export async function getEmailSubjectAsync(originalSubject: string, originalRecipient?: string): Promise<string> {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return `${EMAIL_CONFIG.MONITORING_SUBJECT_PREFIX} ${originalSubject}`;
  }
  const reviewEnabled = await isReviewMode();
  if (reviewEnabled) {
    const recipientNote = originalRecipient ? ` [dla: ${originalRecipient}]` : '';
    return `${EMAIL_CONFIG.REVIEW_SUBJECT_PREFIX}${recipientNote} ${originalSubject}`;
  }
  return originalSubject;
}
