import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../components/AuthProvider'
import { signIn, signUp, signOut, getCurrentProfile, isCurrentUserAdmin } from '../../lib/auth'
import { createClient } from '@supabase/supabase-js'

// Mock the supabase client
const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
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

// Test component to access auth context
function TestComponent() {
  const { user, profile, loading, signOut } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? user.email : 'No User'}</div>
      <div data-testid="profile">{profile ? profile.full_name : 'No Profile'}</div>
      <button onClick={signOut} data-testid="signout">Sign Out</button>
    </div>
  )
}

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('signIn', () => {
    test('user can sign in with valid credentials', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      const mockSession = { user: mockUser }
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      const result = await signIn('test@example.com', 'password123')
      
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(result.user).toEqual(mockUser)
    })

    test('user cannot sign in with invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(signIn('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid email or password. Please check your credentials and try again.'
      )
    })

    test('handles email not confirmed error', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      })

      await expect(signIn('test@example.com', 'password123')).rejects.toThrow(
        'Please check your email and confirm your account before signing in.'
      )
    })

    test('handles too many requests error', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Too many requests' },
      })

      await expect(signIn('test@example.com', 'password123')).rejects.toThrow(
        'Too many login attempts. Please wait a moment before trying again.'
      )
    })
  })

  describe('signUp', () => {
    test('user can sign up with valid information', async () => {
      const mockUser = { id: '1', email: 'new@example.com' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const result = await signUp('new@example.com', 'password123', 'John Doe', 'client')
      
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
      expect(result.user).toEqual(mockUser)
    })

    test('user can sign up as admin', async () => {
      const mockUser = { id: '1', email: 'admin@example.com' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      await signUp('admin@example.com', 'password123', 'Admin User', 'admin')
      
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'Admin User',
            role: 'admin',
          },
        },
      })
    })

    test('handles sign up error', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      })

      await expect(signUp('existing@example.com', 'password123', 'Existing User')).rejects.toThrow(
        'User already registered'
      )
    })
  })

  describe('signOut', () => {
    test('user can sign out successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      })

      await signOut()
      
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    test('handles sign out error', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' },
      })

      await expect(signOut()).rejects.toThrow('Sign out failed')
    })
  })

  describe('getCurrentProfile', () => {
    test('returns profile for authenticated user', async () => {
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

      const profile = await getCurrentProfile()
      
      expect(profile).toEqual(mockProfile)
    })

    test('returns null for unauthenticated user', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const profile = await getCurrentProfile()
      
      expect(profile).toBeNull()
    })

    test('handles profile fetch error', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
      
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' },
      })

      const profile = await getCurrentProfile()
      
      expect(profile).toBeNull()
    })
  })

  describe('isCurrentUserAdmin', () => {
    test('returns true for admin user', async () => {
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

      const isAdmin = await isCurrentUserAdmin()
      
      expect(isAdmin).toBe(true)
    })

    test('returns false for client user', async () => {
      const mockUser = { id: '1', email: 'client@example.com' }
      const mockProfile = { id: '1', full_name: 'Client User', role: 'client' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
      
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      const isAdmin = await isCurrentUserAdmin()
      
      expect(isAdmin).toBe(false)
    })
  })

  describe('AuthProvider', () => {
    test('renders with loading state initially', () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
    })

    test('updates state when user signs in', async () => {
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

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })

      await waitFor(() => {
        expect(screen.getByTestId('profile')).toHaveTextContent('Test User')
      })
    })

    test('handles sign out', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
      
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })

      fireEvent.click(screen.getByTestId('signout'))

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No User')
      })
    })
  })
}) 