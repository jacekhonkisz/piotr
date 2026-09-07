/**
 * Shared-secret helpers for server-to-server authentication.
 *
 * Secrets such as CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY are compared
 * against tokens that arrive in an Authorization header. The Fetch spec strips
 * leading and trailing whitespace from header values in transit, but
 * process.env preserves it verbatim, so a secret stored with a stray trailing
 * newline can never match the token the server actually receives. Every
 * comparison and every outgoing header must therefore go through the trimmed
 * value.
 *
 * Implemented without node:crypto so it can also run in Edge middleware.
 *
 * @module shared-secret
 */

const BEARER_PREFIX = 'Bearer ';

/**
 * Read a secret from the environment, normalized for header transport.
 *
 * @param name - Environment variable name
 * @returns The trimmed secret, or undefined when unset or blank
 */
export function readSecret(name: string): string | undefined {
  const raw = process.env[name];

  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Build an Authorization header value for a secret held in the environment.
 *
 * @param name - Environment variable name
 * @returns `Bearer <secret>`, or undefined when the secret is unset
 */
export function bearerHeader(name: string): string | undefined {
  const secret = readSecret(name);
  return secret ? `${BEARER_PREFIX}${secret}` : undefined;
}

/**
 * Authorization header for internal fan-out calls between our own endpoints.
 *
 * Prefers CRON_SECRET and falls back to the service role key, matching what the
 * receiving guards accept.
 *
 * @returns `Bearer <secret>`, or an empty string when neither secret is set
 */
export function internalBearerHeader(): string {
  return bearerHeader('CRON_SECRET') || bearerHeader('SUPABASE_SERVICE_ROLE_KEY') || '';
}

/**
 * Extract the token from an Authorization header.
 *
 * @param authHeader - Raw Authorization header value
 * @returns The trimmed bearer token, or undefined when absent or malformed
 */
export function extractBearerToken(authHeader: string | null | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }

  const normalized = authHeader.trim();
  if (!normalized.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())) {
    return undefined;
  }

  const token = normalized.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

/**
 * Compare two secrets without leaking the position of the first difference.
 *
 * Length is treated as non-secret, which is standard for this kind of check.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

/**
 * Check a candidate token against a secret stored in the environment.
 *
 * @param candidate - Token supplied by the caller
 * @param name - Environment variable holding the expected secret
 * @returns true only when the secret is configured and the values match
 */
export function matchesSecret(candidate: string | null | undefined, name: string): boolean {
  const expected = readSecret(name);

  if (!expected || typeof candidate !== 'string') {
    return false;
  }

  return constantTimeEquals(candidate.trim(), expected);
}

/**
 * Check an Authorization header against a secret stored in the environment.
 *
 * @param authHeader - Raw Authorization header value
 * @param name - Environment variable holding the expected secret
 * @returns true only when the secret is configured and the bearer token matches
 */
export function matchesBearerSecret(
  authHeader: string | null | undefined,
  name: string
): boolean {
  return matchesSecret(extractBearerToken(authHeader), name);
}
