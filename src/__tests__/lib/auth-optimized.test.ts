/**
 * Comprehensive tests for optimized authentication system
 */

import { getCurrentProfileOptimized, signInOptimized, clearProfileCacheOptimized, getProfileCacheStats } from '../../lib/auth-optimized';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock logger
jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Optimized Authentication System', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getSession: jest.fn(),
        signInWithPassword: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    };

    mockCreateClient.mockReturnValue(mockSupabase);
    
    // Clear cache before each test
    clearProfileCacheOptimized();
  });

  describe('getCurrentProfileOptimized', () => {
    it('should return null when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getCurrentProfileOptimized();
      expect(result).toBeNull();
    });

    it('should return cached profile on second call', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = { 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'client',
        full_name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      // First call - should fetch from database
      const result1 = await getCurrentProfileOptimized();
      expect(result1).toEqual(mockProfile);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getCurrentProfileOptimized();
      expect(result2).toEqual(mockProfile);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // No additional DB call
    });

    it('should handle database query timeout', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      // Mock timeout
      mockSupabase.from().select().eq().single.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile query timeout')), 100)
        )
      );

      const result = await getCurrentProfileOptimized();
      expect(result).toBeNull();
    });

    it('should handle session timeout', async () => {
      mockSupabase.auth.getSession.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 100)
        )
      );

      const result = await getCurrentProfileOptimized();
      expect(result).toBeNull();
    });

    it('should cache null results for failed queries', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' }
      });

      // First call - should query database and cache null
      const result1 = await getCurrentProfileOptimized();
      expect(result1).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should use cached null result
      const result2 = await getCurrentProfileOptimized();
      expect(result2).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // No additional DB call
    });
  });

  describe('signInOptimized', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockAuthData = {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token-123' }
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      const result = await signInOptimized('test@example.com', 'password123');
      
      expect(result.data).toEqual(mockAuthData);
      expect(result.error).toBeNull();
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should handle sign in errors', async () => {
      const mockError = { message: 'Invalid credentials' };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await signInOptimized('test@example.com', 'wrongpassword');
      
      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should handle sign in exceptions', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await signInOptimized('test@example.com', 'password123');
      
      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = { 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'client',
        full_name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      // Load profile into cache
      await getCurrentProfileOptimized();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Verify cache hit
      await getCurrentProfileOptimized();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Clear cache
      clearProfileCacheOptimized('user-123');

      // Should fetch from database again
      await getCurrentProfileOptimized();
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', () => {
      const stats = getProfileCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('ongoingRequests');
      
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.ongoingRequests).toBe('number');
    });
  });

  describe('Performance', () => {
    it('should complete profile loading within performance threshold', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = { 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'client',
        full_name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const startTime = performance.now();
      const result = await getCurrentProfileOptimized();
      const endTime = performance.now();
      
      expect(result).toEqual(mockProfile);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests without race conditions', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockProfile = { 
        id: 'user-123', 
        email: 'test@example.com', 
        role: 'client',
        full_name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      // Add delay to simulate slow database
      mockSupabase.from().select().eq().single.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: mockProfile, error: null }), 100)
        )
      );

      // Make concurrent requests
      const promises = Array(5).fill(0).map(() => getCurrentProfileOptimized());
      const results = await Promise.all(promises);

      // All should return the same profile
      results.forEach(result => {
        expect(result).toEqual(mockProfile);
      });

      // Should only make one database call due to deduplication
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });
});
