import {
  bearerHeader,
  extractBearerToken,
  internalBearerHeader,
  matchesBearerSecret,
  matchesSecret,
  readSecret,
} from '@/lib/shared-secret';

const ENV_KEYS = ['TEST_SECRET', 'CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

describe('shared-secret', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe('readSecret', () => {
    it('trims surrounding whitespace', () => {
      process.env.TEST_SECRET = '  abc123\n';
      expect(readSecret('TEST_SECRET')).toBe('abc123');
    });

    it('treats unset and blank values as missing', () => {
      expect(readSecret('TEST_SECRET')).toBeUndefined();
      process.env.TEST_SECRET = '   \n';
      expect(readSecret('TEST_SECRET')).toBeUndefined();
    });
  });

  describe('matchesSecret', () => {
    // Regression: production stored SUPABASE_SERVICE_ROLE_KEY with a trailing
    // newline. fetch strips it from the Authorization header in transit, so a
    // strict === against process.env never matched and every scheduled report
    // failed with "PDF generation failed: HTTP 401".
    it('matches when the stored secret has a trailing newline', () => {
      process.env.TEST_SECRET = 'service-role-key\n';
      expect(matchesSecret('service-role-key', 'TEST_SECRET')).toBe(true);
    });

    it('matches when the supplied token has stray whitespace', () => {
      process.env.TEST_SECRET = 'service-role-key';
      expect(matchesSecret(' service-role-key ', 'TEST_SECRET')).toBe(true);
    });

    it('rejects a different secret', () => {
      process.env.TEST_SECRET = 'service-role-key';
      expect(matchesSecret('other-key', 'TEST_SECRET')).toBe(false);
    });

    it('rejects everything when the secret is not configured', () => {
      expect(matchesSecret('', 'TEST_SECRET')).toBe(false);
      expect(matchesSecret('anything', 'TEST_SECRET')).toBe(false);
      expect(matchesSecret(null, 'TEST_SECRET')).toBe(false);
    });
  });

  describe('extractBearerToken', () => {
    it('reads the token from a well-formed header', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    });

    it('accepts a case-insensitive scheme', () => {
      expect(extractBearerToken('bearer abc123')).toBe('abc123');
    });

    it('returns undefined for missing or non-bearer headers', () => {
      expect(extractBearerToken(null)).toBeUndefined();
      expect(extractBearerToken('Basic abc123')).toBeUndefined();
      expect(extractBearerToken('Bearer ')).toBeUndefined();
    });
  });

  describe('matchesBearerSecret', () => {
    it('authenticates a cron call when CRON_SECRET has a trailing newline', () => {
      process.env.CRON_SECRET = 'cron-secret\n';
      expect(matchesBearerSecret('Bearer cron-secret', 'CRON_SECRET')).toBe(true);
    });

    it('does not authenticate an empty header against an unset secret', () => {
      expect(matchesBearerSecret('Bearer ', 'CRON_SECRET')).toBe(false);
      expect(matchesBearerSecret(null, 'CRON_SECRET')).toBe(false);
    });
  });

  describe('bearerHeader', () => {
    it('builds a header from the trimmed secret', () => {
      process.env.TEST_SECRET = 'abc123\n';
      expect(bearerHeader('TEST_SECRET')).toBe('Bearer abc123');
    });

    it('never emits "Bearer undefined"', () => {
      expect(bearerHeader('TEST_SECRET')).toBeUndefined();
    });
  });

  describe('internalBearerHeader', () => {
    it('prefers CRON_SECRET and falls back to the service role key', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role\n';
      expect(internalBearerHeader()).toBe('Bearer service-role');

      process.env.CRON_SECRET = 'cron-secret\n';
      expect(internalBearerHeader()).toBe('Bearer cron-secret');
    });

    it('returns an empty string when neither secret is set', () => {
      expect(internalBearerHeader()).toBe('');
    });
  });

  describe('header transport round-trip', () => {
    // Proves the underlying cause: the value that arrives over HTTP is the
    // trimmed one, so the receiving side must compare trimmed values.
    it('survives fetch header normalization', () => {
      process.env.TEST_SECRET = 'service-role-key\n';

      const headers = new Headers({ Authorization: `Bearer ${process.env.TEST_SECRET}` });
      const received = headers.get('authorization');

      expect(received).toBe('Bearer service-role-key');
      expect(received === `Bearer ${process.env.TEST_SECRET}`).toBe(false);
      expect(matchesBearerSecret(received, 'TEST_SECRET')).toBe(true);
    });
  });
});
