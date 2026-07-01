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

function parseEmailList(value: string | undefined): string[] {
  return (value || '')
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(Boolean);
}

const REVIEW_EMAIL = process.env.EMAIL_REVIEW_RECIPIENT || 'kontakt@piotrbajerlein.pl';
const REVIEW_CC = parseEmailList(process.env.EMAIL_REVIEW_CC);
const REVIEW_RECIPIENTS = dedupeEmails([REVIEW_EMAIL, ...REVIEW_CC]);

// Admin always receives a copy (DW/CC) of every client report for preview/oversight.
const ADMIN_PREVIEW_CC = process.env.EMAIL_ADMIN_CC || 'kontakt@piotrbajerlein.pl';

export const EMAIL_CONFIG = {
  MONITORING_MODE: false,
  
  REVIEW_MODE_DEFAULT: true,
  REVIEW_EMAIL,
  REVIEW_CC,
  REVIEW_RECIPIENTS,

  // CC (Polish: "DW") recipient added to every outgoing client report.
  ADMIN_PREVIEW_CC,
  
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
    return [...REVIEW_RECIPIENTS];
  }
  return [originalRecipient];
}

/**
 * Async recipient getter — always reads the freshest setting.
 */
export async function getEmailRecipientsAsync(
  originalRecipient: string,
  reviewRecipientOverride?: string
): Promise<{ recipients: string[]; originalRecipient: string; isRedirected: boolean }> {
  if (EMAIL_CONFIG.MONITORING_MODE) {
    return { recipients: [...EMAIL_CONFIG.MONITORING_EMAILS], originalRecipient, isRedirected: true };
  }
  const reviewEnabled = await isReviewMode();
  if (reviewEnabled) {
    return {
      recipients: reviewRecipientOverride ? [reviewRecipientOverride] : [...REVIEW_RECIPIENTS],
      originalRecipient,
      isRedirected: true
    };
  }
  return { recipients: [originalRecipient], originalRecipient, isRedirected: false };
}

/** Normalize + de-duplicate a list of email addresses (case-insensitive), preserving order. */
function dedupeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export interface ResolvedEmailEnvelope {
  /** Primary recipient (To). */
  to: string;
  /** CC ("DW") recipients — additional client contacts + admin preview copy. */
  cc: string[];
  /** True when the message was redirected away from real clients (review/monitoring mode). */
  isRedirected: boolean;
  /** The originally intended primary recipient (for logging/subject annotation). */
  originalRecipient: string;
}

/**
 * Resolve the full To/CC envelope for a client report.
 *
 * Normal mode:
 *   - To  = primary client contact
 *   - CC  = remaining client contacts + admin preview address (kontakt@piotrbajerlein.pl)
 *
 * Review / monitoring mode:
 *   - Everything is redirected to internal review recipients and client CC is dropped,
 *     so no real client ever receives a message while review mode is enabled.
 */
export async function resolveEmailEnvelope(
  primaryRecipient: string,
  additionalRecipients: string[] = [],
  options?: { reviewRecipientOverride?: string; skipAdminCc?: boolean }
): Promise<ResolvedEmailEnvelope> {
  const originalRecipient = primaryRecipient;

  if (EMAIL_CONFIG.MONITORING_MODE) {
    return {
      to: EMAIL_CONFIG.MONITORING_EMAILS[0] ?? ADMIN_PREVIEW_CC,
      cc: [],
      isRedirected: true,
      originalRecipient
    };
  }

  const reviewEnabled = await isReviewMode();
  if (reviewEnabled) {
    const [reviewTo = REVIEW_EMAIL, ...reviewCc] = options?.reviewRecipientOverride
      ? [options.reviewRecipientOverride]
      : REVIEW_RECIPIENTS;

    return {
      to: reviewTo,
      cc: reviewCc,
      isRedirected: true,
      originalRecipient
    };
  }

  // Direct mode: send to all client contacts + always CC the admin preview address.
  const ccCandidates = [...additionalRecipients];
  if (!options?.skipAdminCc) {
    ccCandidates.push(ADMIN_PREVIEW_CC);
  }

  // Remove anything that duplicates the primary recipient.
  const primaryKey = primaryRecipient.trim().toLowerCase();
  const cc = dedupeEmails(ccCandidates).filter(email => email.toLowerCase() !== primaryKey);

  return {
    to: primaryRecipient,
    cc,
    isRedirected: false,
    originalRecipient
  };
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
