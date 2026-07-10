/** Preset internal addresses offered in the admin test-email UI. */
export const INTERNAL_TEST_RECIPIENT_PRESETS = [
  'jac.honkisz@gmail.com',
  'kontakt@piotrbajerlein.pl',
  'pbajerlein@gmail.com'
] as const;

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Normalize + de-duplicate a list of email addresses (case-insensitive), preserving order. */
export function dedupeEmails(emails: Array<string | null | undefined>): string[] {
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

/** Parse admin test override(s): string, comma-separated string, or array → deduped valid emails. */
export function normalizeReviewRecipientsOverride(
  input: string | string[] | null | undefined
): string[] | undefined {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[;,]/)
      : [];
  const normalized = dedupeEmails(raw).filter(isValidEmailAddress);
  return normalized.length > 0 ? normalized : undefined;
}
