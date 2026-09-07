/**
 * @jest-environment node
 *
 * Regression coverage for the service-role branch of authenticateRequest.
 *
 * Production stored SUPABASE_SERVICE_ROLE_KEY with a trailing newline. fetch
 * strips that newline from the Authorization header in transit, so the previous
 * strict `===` against process.env never matched: every scheduled report died
 * with `PDF generation failed: HTTP 401 - {"error":"Authentication required"}`.
 */

import { NextRequest } from 'next/server';

const ADMIN_PROFILE = { id: 'admin-1', email: 'admin@example.com' };

const getUser = jest.fn();
const adminProfileSingle = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({ single: adminProfileSingle })),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        })),
      })),
    })),
  })),
}));

jest.mock('../../lib/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const SERVICE_ROLE_KEY = 'test-service-role-key';

/** Send the key exactly the way fetch would put it on the wire. */
function requestWithToken(token: string): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  return new NextRequest('http://localhost:3000/api/generate-pdf', { headers });
}

describe('authenticateRequest - service role', () => {
  let originalKey: string | undefined;
  let authenticateRequest: typeof import('../../lib/auth-middleware').authenticateRequest;

  beforeAll(() => {
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
    authenticateRequest = require('../../lib/auth-middleware').authenticateRequest;
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
    adminProfileSingle.mockResolvedValue({ data: ADMIN_PROFILE, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
  });

  it('authenticates the scheduler when the stored key has a trailing newline', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = `${SERVICE_ROLE_KEY}\n`;

    const result = await authenticateRequest(requestWithToken(SERVICE_ROLE_KEY));

    expect(result.success).toBe(true);
    expect(result.user).toEqual({
      id: ADMIN_PROFILE.id,
      email: ADMIN_PROFILE.email,
      role: 'admin',
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('authenticates when the key is stored cleanly', async () => {
    const result = await authenticateRequest(requestWithToken(SERVICE_ROLE_KEY));

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('admin');
  });

  it('rejects a token that is not the service role key', async () => {
    const result = await authenticateRequest(requestWithToken('not-the-key'));

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(getUser).toHaveBeenCalled();
  });

  it('rejects service-role calls when no admin profile exists', async () => {
    adminProfileSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });

    const result = await authenticateRequest(requestWithToken(SERVICE_ROLE_KEY));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Admin profile not found for service role request');
    expect(result.statusCode).toBe(401);
  });
});
