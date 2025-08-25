/**
 * Tests for health check endpoint
 */

import { GET } from '../../app/api/health/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          then: jest.fn()
        }))
      }))
    }))
  }))
}));

// Mock logger
jest.mock('../../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock fetch for Meta API check
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should return healthy status when all checks pass', async () => {
    // Mock successful database check
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from().select().limit.mockResolvedValue({
      data: [{ count: 5 }],
      error: null
    });

    // Mock successful system logs check
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_logs') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({
                  data: [{ created_at: new Date().toISOString() }],
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          limit: () => Promise.resolve({
            data: [{ count: 5 }],
            error: null
          })
        })
      };
    });

    // Mock successful Meta API check
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe(true);
    expect(data.checks.cronJobs).toBe(true);
    expect(data.checks.metaAPI).toBe(true);
    expect(data.checks.overall).toBe(true);
    expect(data.responseTime).toBeGreaterThan(0);
    expect(data.timestamp).toBeDefined();
  });

  it('should return unhealthy status when database check fails', async () => {
    // Mock failed database check
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from().select().limit.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.checks.database).toBe(false);
    expect(data.checks.overall).toBe(false);
  });

  it('should handle cron job check failure gracefully', async () => {
    // Mock successful database check
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_logs') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({
                  data: [],
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          limit: () => Promise.resolve({
            data: [{ count: 5 }],
            error: null
          })
        })
      };
    });

    // Mock successful Meta API check
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200); // Still healthy because database works
    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe(true);
    expect(data.checks.cronJobs).toBe(false);
    expect(data.checks.metaAPI).toBe(true);
    expect(data.checks.overall).toBe(true); // Overall healthy if database works
  });

  it('should handle Meta API check timeout', async () => {
    jest.useFakeTimers();

    // Mock successful database check
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'system_logs') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({
                  data: [{ created_at: new Date().toISOString() }],
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          limit: () => Promise.resolve({
            data: [{ count: 5 }],
            error: null
          })
        })
      };
    });

    // Mock timeout for Meta API
    mockFetch.mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    );

    const requestPromise = GET();

    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(4000);

    const response = await requestPromise;
    const data = await response.json();

    expect(response.status).toBe(200); // Still healthy because database works
    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe(true);
    expect(data.checks.metaAPI).toBe(false);
    expect(data.checks.overall).toBe(true);

    jest.useRealTimers();
  });

  it('should include system statistics in response', async () => {
    // Mock successful checks
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'clients') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ count: 10 }],
              error: null
            })
          })
        };
      }
      if (table === 'current_month_cache') {
        return {
          select: () => Promise.resolve({
            data: [{ count: 25 }],
            error: null
          })
        };
      }
      if (table === 'system_logs') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({
                  data: [{ created_at: new Date().toISOString() }],
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          limit: () => Promise.resolve({
            data: [{ count: 5 }],
            error: null
          })
        })
      };
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const response = await GET();
    const data = await response.json();

    expect(data.system).toBeDefined();
    expect(data.system.activeClients).toBeDefined();
    expect(data.system.cachedRecords).toBeDefined();
    expect(data.system.lastHealthCheck).toBeDefined();
  });

  it('should complete health check within reasonable time', async () => {
    // Mock all checks to be fast
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from.mockImplementation(() => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [{ count: 5 }], error: null }),
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ 
              data: [{ created_at: new Date().toISOString() }], 
              error: null 
            })
          })
        })
      })
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    const startTime = Date.now();
    const response = await GET();
    const endTime = Date.now();
    const data = await response.json();

    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(data.responseTime).toBeLessThan(5000);
  });

  it('should handle unexpected errors gracefully', async () => {
    // Mock unexpected error
    const mockSupabase = require('@supabase/supabase-js').createClient();
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe('error');
    expect(data.error).toBeDefined();
    expect(data.responseTime).toBeGreaterThan(0);
  });
});
