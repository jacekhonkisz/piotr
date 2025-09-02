/**
 * Tests for AuthProvider component
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../components/AuthProvider';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signOut: jest.fn()
  }
};

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

jest.mock('../../lib/auth', () => ({
  getCurrentProfile: jest.fn()
}));

// Test component that uses the auth context
function TestComponent() {
  const { user, profile, loading, signOut } = useAuth();
  
  if (loading) return <div data-testid="loading">Loading...</div>;
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="profile">{profile ? profile.role : 'No profile'}</div>
      <button onClick={signOut} data-testid="signout">Sign Out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  let mockGetCurrentProfile: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentProfile = require('../../lib/auth').getCurrentProfile;
    
    // Default mocks
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    });
    
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
    mockGetCurrentProfile.mockResolvedValue(null);
  });

  it('should render loading state initially', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should handle no user session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(screen.getByTestId('profile')).toHaveTextContent('No profile');
    });
  });

  it('should handle user session with profile', async () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com'
    };

    const mockProfile = {
      id: 'user123',
      email: 'test@example.com',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockGetCurrentProfile.mockResolvedValue(mockProfile);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('admin');
    });
  });

  it('should handle session error', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session error' }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });
  });

  it('should handle profile loading error', async () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com'
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockGetCurrentProfile.mockRejectedValue(new Error('Profile loading failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('No profile');
    });
  });

  it('should handle auth state changes', async () => {
    let authStateChangeCallback: (event: string, session: any) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    // Simulate sign in
    const mockUser = {
      id: 'user123',
      email: 'test@example.com'
    };

    const mockProfile = {
      id: 'user123',
      email: 'test@example.com',
      role: 'client',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockGetCurrentProfile.mockResolvedValue(mockProfile);

    act(() => {
      authStateChangeCallback('SIGNED_IN', { user: mockUser });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('profile')).toHaveTextContent('client');
    });
  });

  it('should handle sign out', async () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com'
    };

    const mockProfile = {
      id: 'user123',
      email: 'test@example.com',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockGetCurrentProfile.mockResolvedValue(mockProfile);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for user to be loaded
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    // Click sign out
    const signOutButton = screen.getByTestId('signout');
    
    await act(async () => {
      signOutButton.click();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('should handle sign out error', async () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com'
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    mockGetCurrentProfile.mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    });

    mockSupabase.auth.signOut.mockResolvedValue({
      error: { message: 'Sign out failed' }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    const signOutButton = screen.getByTestId('signout');
    
    await expect(async () => {
      await act(async () => {
        signOutButton.click();
      });
    }).rejects.toThrow();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleSpy.mockRestore();
  });

  it('should handle session timeout gracefully', async () => {
    // Mock session timeout
    mockSupabase.auth.getSession.mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 100)
      )
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    }, { timeout: 6000 }); // Wait longer than the 5s timeout
  });
});

