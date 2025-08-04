import { createMocks } from 'node-mocks-http'
import { GET, POST } from '../../app/api/reports/route'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
  })),
}

const mockJwtClient = {
  auth: {
    getUser: jest.fn(),
  },
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((url, key, options) => {
    if (options?.global?.headers?.Authorization) {
      return mockJwtClient
    }
    return mockSupabase
  }),
}))

describe('/api/reports', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    test('returns 401 without authentication', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    test('returns 401 with invalid token', async () => {
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('returns 403 for user without role', async () => {
      const mockUser = { id: '1', email: 'user@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null, // No profile
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    test('admin can get all reports', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockReports = [
        { id: '1', client_id: '1', generated_at: '2024-01-01' },
        { id: '2', client_id: '2', generated_at: '2024-01-02' },
      ]
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().select().order().mockResolvedValue({
        data: mockReports,
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reports).toEqual(mockReports)
    })

    test('admin can get reports for specific client', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockReports = [
        { id: '1', client_id: '1', generated_at: '2024-01-01' },
      ]
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: mockReports,
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports?clientId=1',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reports).toEqual(mockReports)
    })

    test('client can get their own reports', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      const mockClient = { id: '1' }
      const mockReports = [
        { id: '1', client_id: '1', generated_at: '2024-01-01' },
      ]
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'client' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockClient,
          error: null,
        })

      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: mockReports,
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reports).toEqual(mockReports)
    })

    test('returns 404 when client not found', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'client' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null, // Client not found
          error: null,
        })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/reports',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Client not found')
    })
  })

  describe('POST', () => {
    const validReportData = {
      clientId: '1',
      dateRangeStart: '2024-01-01',
      dateRangeEnd: '2024-01-31',
      reportData: {
        campaigns: [
          {
            campaign_id: '123',
            campaign_name: 'Test Campaign',
            impressions: 1000,
            clicks: 50,
            spend: 100,
          },
        ],
      },
    }

    test('returns 401 without authentication', async () => {
      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    test('returns 401 with invalid token', async () => {
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('returns 403 for user without role', async () => {
      const mockUser = { id: '1', email: 'user@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null, // No profile
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    test('admin can create report for any client', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockReport = { id: '1', client_id: '1', generated_at: '2024-01-01' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockReport,
        error: null,
      })

      mockSupabase.from().insert().mockResolvedValue({
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.report).toEqual(mockReport)
    })

    test('admin requires clientId', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: { ...validReportData, clientId: undefined },
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Client ID required for admin')
    })

    test('client can create report for themselves', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      const mockClient = { id: '1' }
      const mockReport = { id: '1', client_id: '1', generated_at: '2024-01-01' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'client' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockClient,
          error: null,
        })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockReport,
        error: null,
      })

      mockSupabase.from().insert().mockResolvedValue({
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: { ...validReportData, clientId: undefined }, // Client doesn't provide clientId
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.report).toEqual(mockReport)
    })

    test('returns 404 when client not found', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { role: 'client' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null, // Client not found
          error: null,
        })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Client not found')
    })

    test('handles report creation error', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create report')
    })

    test('handles campaign data storage error gracefully', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockReport = { id: '1', client_id: '1', generated_at: '2024-01-01' }
      
      mockJwtClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockReport,
        error: null,
      })

      mockSupabase.from().insert().mockResolvedValue({
        error: { message: 'Campaign storage error' },
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/reports',
        body: validReportData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      // Should still succeed even if campaign storage fails
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.report).toEqual(mockReport)
    })
  })
}) 