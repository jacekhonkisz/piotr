import { createMocks } from 'node-mocks-http'
import { GET, POST } from '../../app/api/clients/route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    admin: {
      createUser: jest.fn(),
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
    },
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  })),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

// Mock MetaAPIService
jest.mock('../../lib/meta-api', () => ({
  MetaAPIService: jest.fn().mockImplementation(() => ({
    validateAndConvertToken: jest.fn().mockResolvedValue({
      valid: true,
      convertedToken: 'converted-token',
      isLongLived: true,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    }),
    validateAdAccount: jest.fn().mockResolvedValue({
      valid: true,
      account: { name: 'Test Account' },
    }),
  })),
}))

// Mock user credentials generation
jest.mock('../../lib/user-credentials', () => ({
  generatePassword: jest.fn(() => 'generated-password'),
  generateUsername: jest.fn(() => 'test@example.com'),
}))

describe('/api/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    test('returns 401 without authentication', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    test('returns 401 with invalid token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('returns 403 for non-admin user', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'client' },
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    test('returns clients for admin user', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockClients = [
        { id: '1', name: 'Client 1', email: 'client1@example.com' },
        { id: '2', name: 'Client 2', email: 'client2@example.com' },
      ]
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().select().eq().order().range().mockResolvedValue({
        data: mockClients,
        error: null,
        count: 2,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.clients).toEqual(mockClients)
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
    })

    test('applies search filter', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().select().eq().or().order().range().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients?search=test',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await GET(req)

      expect(mockSupabase.from().or).toHaveBeenCalledWith(
        'name.ilike.%test%,email.ilike.%test%,company.ilike.%test%'
      )
    })

    test('applies status filter', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.from().select().eq().eq().order().range().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/clients?status=valid',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      await GET(req)

      expect(mockSupabase.from().eq).toHaveBeenCalledWith('api_status', 'valid')
    })
  })

  describe('POST', () => {
    const validClientData = {
      name: 'Test Client',
      email: 'test@example.com',
      ad_account_id: 'act_123456789',
      meta_access_token: 'valid-token',
      company: 'Test Company',
      reporting_frequency: 'monthly',
      notes: 'Test notes',
    }

    test('returns 401 without authentication', async () => {
      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    test('returns 403 for non-admin user', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'client' },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })

    test('creates client successfully', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      const mockCreatedUser = { id: '2', email: 'test@example.com' }
      const mockClient = { id: '1', name: 'Test Client', email: 'test@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      })

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: mockCreatedUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null, // No existing profile
        error: null,
      })

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockClient,
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.client).toEqual(mockClient)
      expect(data.credentials).toEqual({
        username: 'test@example.com',
        password: 'generated-password',
      })
    })

    test('handles existing user error', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { 
          users: [{ email: 'test@example.com' }] 
        },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('already exists')
    })

    test('handles Meta API validation failure', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      // Mock MetaAPIService to return validation failure
      const { MetaAPIService } = require('../../lib/meta-api')
      MetaAPIService.mockImplementation(() => ({
        validateAndConvertToken: jest.fn().mockResolvedValue({
          valid: false,
          error: 'Invalid token',
        }),
        validateAdAccount: jest.fn(),
      }))

      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Meta API token validation failed')
    })

    test('handles ad account validation failure', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      })

      // Mock MetaAPIService to return ad account validation failure
      const { MetaAPIService } = require('../../lib/meta-api')
      MetaAPIService.mockImplementation(() => ({
        validateAndConvertToken: jest.fn().mockResolvedValue({
          valid: true,
          convertedToken: 'converted-token',
          isLongLived: true,
        }),
        validateAdAccount: jest.fn().mockResolvedValue({
          valid: false,
          error: 'Invalid ad account',
        }),
      }))

      const { req } = createMocks({
        method: 'POST',
        url: '/api/clients',
        body: validClientData,
        headers: {
          authorization: 'Bearer valid-token',
        },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Ad account validation failed')
    })
  })
}) 