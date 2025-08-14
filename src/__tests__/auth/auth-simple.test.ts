// Mock Supabase before importing auth functions
const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}))

// Mock the supabase instance
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}))

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('signIn should call supabase auth.signInWithPassword', async () => {
    const mockUser = { id: '1', email: 'test@example.com' }
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    // Import the auth functions after mocking
    const { signIn } = await import('../../lib/auth')
    
    const result = await signIn('test@example.com', 'password123')
    
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.data?.user).toEqual(mockUser)
  })

  test('signIn should handle invalid credentials', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    const { signIn } = await import('../../lib/auth')
    
    await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
      'Invalid email or password. Please check your credentials and try again.'
    )
  })

  test('signUp should call supabase auth.signUp', async () => {
    const mockUser = { id: '1', email: 'new@example.com' }
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const { signUp } = await import('../../lib/auth')
    
    const result = await signUp('new@example.com', 'password123')
    
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        data: {
          full_name: 'John Doe',
          role: 'client',
        },
      },
    })
    expect(result.data?.user).toEqual(mockUser)
  })

  test('signOut should call supabase auth.signOut', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({
      error: null,
    })

    const { signOut } = await import('../../lib/auth')
    
    await signOut()
    
    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
  })

  test('getCurrentProfile should return profile for authenticated user', async () => {
    const mockUser = { id: '1', email: 'test@example.com' }
    const mockProfile = { id: '1', full_name: 'Test User', role: 'client' }
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: mockProfile,
      error: null,
    })

    const { getCurrentProfile } = await import('../../lib/auth')
    
    const profile = await getCurrentProfile()
    
    expect(profile).toEqual(mockProfile)
  })

  test('isCurrentUserAdmin should return true for admin user', async () => {
    const mockUser = { id: '1', email: 'admin@example.com' }
    const mockProfile = { id: '1', full_name: 'Admin User', role: 'admin' }
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: mockProfile,
      error: null,
    })

    const { isCurrentUserAdmin } = await import('../../lib/auth')
    
    const isAdmin = await isCurrentUserAdmin()
    
    expect(isAdmin).toBe(true)
  })
}) 