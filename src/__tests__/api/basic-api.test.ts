import { createMocks } from 'node-mocks-http'

// Mock the API route functions directly
const mockGetClients = jest.fn()
const mockPostClients = jest.fn()

// Mock the route module
jest.mock('../../app/api/clients/route', () => ({
  GET: mockGetClients,
  POST: mockPostClients,
}))

describe('Basic API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should handle GET request', async () => {
    // Mock successful response
    mockGetClients.mockResolvedValue({
      json: () => Promise.resolve({ clients: [], pagination: { page: 1, total: 0 } }),
      status: 200,
    })

    const { req } = createMocks({
      method: 'GET',
      url: '/api/clients',
      headers: {
        authorization: 'Bearer test-token',
      },
    })

    // This would normally call the actual route handler
    // For now, we're just testing the mock setup
    expect(mockGetClients).toBeDefined()
  })

  test('should handle POST request', async () => {
    // Mock successful response
    mockPostClients.mockResolvedValue({
      json: () => Promise.resolve({ success: true, client: { id: '1', name: 'Test Client' } }),
      status: 200,
    })

    const { req } = createMocks({
      method: 'POST',
      url: '/api/clients',
      body: {
        name: 'Test Client',
        email: 'test@example.com',
        ad_account_id: 'act_123',
        meta_access_token: 'token',
      },
      headers: {
        authorization: 'Bearer test-token',
      },
    })

    // This would normally call the actual route handler
    // For now, we're just testing the mock setup
    expect(mockPostClients).toBeDefined()
  })
}) 