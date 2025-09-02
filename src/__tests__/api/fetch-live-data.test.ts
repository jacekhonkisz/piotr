/**
 * Tests for fetch-live-data API endpoint
 */

import { POST } from '../../app/api/fetch-live-data/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('../../lib/auth-middleware', () => ({
  authenticateRequest: jest.fn(),
  canAccessClient: jest.fn(),
  createErrorResponse: jest.fn((error, status) => 
    new Response(JSON.stringify({ error }), { status })
  )
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          maybeSingle: jest.fn()
        }))
      }))
    })),
    auth: {
      getSession: jest.fn()
    }
  }))
}));

jest.mock('../../lib/meta-api', () => ({
  MetaAPIService: jest.fn().mockImplementation(() => ({
    validateToken: jest.fn(),
    getTokenInfo: jest.fn(),
    getCampaignInsights: jest.fn(),
    getMonthlyCampaignInsights: jest.fn(),
    getCampaigns: jest.fn(),
    getAccountInfo: jest.fn(),
    clearCache: jest.fn()
  }))
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../lib/performance', () => ({
  performanceMonitor: {
    recordAPICall: jest.fn()
  }
}));

describe('/api/fetch-live-data', () => {
  let mockAuthenticateRequest: jest.Mock;
  let mockCanAccessClient: jest.Mock;
  let mockSupabase: any;
  let mockMetaAPIService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAuthenticateRequest = require('../../lib/auth-middleware').authenticateRequest;
    mockCanAccessClient = require('../../lib/auth-middleware').canAccessClient;
    mockSupabase = require('@supabase/supabase-js').createClient();
    mockMetaAPIService = require('../../lib/meta-api').MetaAPIService;
  });

  it('should return 401 for unauthenticated request', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: false,
      error: 'Authentication failed',
      statusCode: 401
    });

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'test-client' })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing client ID', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'test@example.com', role: 'admin' }
    });

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({}) // Missing clientId
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
  });

  it('should return 404 for non-existent client', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'test@example.com', role: 'admin' }
    });

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'Client not found' }
    });

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'non-existent-client' })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(404);
  });

  it('should return 403 for unauthorized client access', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'client@example.com', role: 'client' }
    });

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { 
        id: 'client123', 
        email: 'otherclient@example.com',
        meta_access_token: 'token123',
        ad_account_id: 'act_123'
      },
      error: null
    });

    mockCanAccessClient.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'client123' })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(403);
  });

  it('should handle current month cache hit', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'admin@example.com', role: 'admin' }
    });

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { 
        id: 'client123', 
        email: 'client@example.com',
        meta_access_token: 'token123',
        ad_account_id: 'act_123'
      },
      error: null
    });

    mockCanAccessClient.mockReturnValue(true);

    // Mock current month cache hit
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'current_month_cache') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    cache_data: {
                      campaigns: [],
                      stats: {
                        totalSpend: 1000,
                        totalImpressions: 10000,
                        totalClicks: 100,
                        totalConversions: 10,
                        averageCtr: 1.0,
                        averageCpc: 10.0
                      },
                      conversionMetrics: {
                        click_to_call: 5,
                        email_contacts: 3,
                        booking_step_1: 8,
                        reservations: 2,
                        reservation_value: 500,
                        roas: 0.5,
                        cost_per_reservation: 500,
                        booking_step_2: 1
                      }
                    },
                    last_updated: new Date().toISOString()
                  },
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { 
                id: 'client123', 
                email: 'client@example.com',
                meta_access_token: 'token123',
                ad_account_id: 'act_123'
              },
              error: null
            })
          })
        })
      };
    });

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ 
        clientId: 'client123',
        dateRange: { start: startDate, end: endDate }
      })
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.debug.source).toContain('cache');
  });

  it('should handle Meta API validation failure', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'admin@example.com', role: 'admin' }
    });

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { 
        id: 'client123', 
        email: 'client@example.com',
        meta_access_token: 'invalid_token',
        ad_account_id: 'act_123'
      },
      error: null
    });

    mockCanAccessClient.mockReturnValue(true);

    // Mock no cache (force Meta API call)
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'current_month_cache') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null })
              })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { 
                id: 'client123', 
                email: 'client@example.com',
                meta_access_token: 'invalid_token',
                ad_account_id: 'act_123'
              },
              error: null
            })
          })
        })
      };
    });

    // Mock Meta API service with invalid token
    const mockMetaInstance = {
      validateToken: jest.fn().mockResolvedValue({ valid: false, error: 'Invalid token' }),
      clearCache: jest.fn()
    };
    mockMetaAPIService.mockImplementation(() => mockMetaInstance);

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ 
        clientId: 'client123',
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
        forceFresh: true // Force Meta API call
      })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid Meta Ads token');
  });

  it('should successfully fetch live data with valid token', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      user: { id: 'user123', email: 'admin@example.com', role: 'admin' }
    });

    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { 
        id: 'client123', 
        email: 'client@example.com',
        meta_access_token: 'valid_token',
        ad_account_id: 'act_123'
      },
      error: null
    });

    mockCanAccessClient.mockReturnValue(true);

    // Mock no cache (force Meta API call)
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'current_month_cache') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null })
              })
            })
          }),
          upsert: jest.fn().mockResolvedValue({ error: null })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: { 
                id: 'client123', 
                email: 'client@example.com',
                meta_access_token: 'valid_token',
                ad_account_id: 'act_123'
              },
              error: null
            })
          })
        })
      };
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session_token' } },
      error: null
    });

    // Mock Meta API service with valid responses
    const mockMetaInstance = {
      validateToken: jest.fn().mockResolvedValue({ valid: true }),
      getTokenInfo: jest.fn().mockResolvedValue({ 
        success: true, 
        info: { scopes: ['ads_read'] },
        isLongLived: true 
      }),
      getCampaignInsights: jest.fn().mockResolvedValue([
        {
          campaign_id: 'camp123',
          campaign_name: 'Test Campaign',
          spend: 100,
          impressions: 1000,
          clicks: 10,
          conversions: 1,
          ctr: 1.0,
          cpc: 10.0,
          click_to_call: 1,
          email_contacts: 0,
          booking_step_1: 1,
          reservations: 1,
          reservation_value: 100,
          booking_step_2: 0,
          booking_step_3: 0
        }
      ]),
      getAccountInfo: jest.fn().mockResolvedValue({
        currency: 'USD',
        timezone_name: 'America/New_York',
        account_status: 'ACTIVE'
      }),
      clearCache: jest.fn()
    };
    mockMetaAPIService.mockImplementation(() => mockMetaInstance);

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ 
        clientId: 'client123',
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
        forceFresh: true
      })
    });

    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.campaigns).toHaveLength(1);
    expect(data.data.stats.totalSpend).toBe(100);
    expect(data.debug.tokenValid).toBe(true);
  });

  it('should handle internal server errors gracefully', async () => {
    mockAuthenticateRequest.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'client123' })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});

