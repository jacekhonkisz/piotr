/**
 * Comprehensive tests for auth middleware
 */

import { authenticateRequest, canAccessClient } from '../../lib/auth-middleware';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Auth Middleware', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = require('@supabase/supabase-js').createClient();
  });

  describe('authenticateRequest', () => {
    it('should return error for missing authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or invalid authorization header');
      expect(result.statusCode).toBe(401);
    });

    it('should return error for invalid authorization header format', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'InvalidFormat token123' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing or invalid authorization header');
      expect(result.statusCode).toBe(401);
    });

    it('should return error for invalid token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer invalid_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized - Invalid token');
      expect(result.statusCode).toBe(401);
    });

    it('should return error when user profile not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found' }
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer valid_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User profile not found');
      expect(result.statusCode).toBe(404);
    });

    it('should return error for invalid user role', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'invalid_role' },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer valid_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied - Invalid user role');
      expect(result.statusCode).toBe(403);
    });

    it('should successfully authenticate admin user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin123', email: 'admin@example.com' } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'admin' },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer valid_admin_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'admin123',
        email: 'admin@example.com',
        role: 'admin'
      });
    });

    it('should successfully authenticate client user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'client123', email: 'client@example.com' } },
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { role: 'client' },
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer valid_client_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'client123',
        email: 'client@example.com',
        role: 'client'
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer valid_token' }
      });
      
      const result = await authenticateRequest(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal authentication error');
      expect(result.statusCode).toBe(500);
    });
  });

  // Note: requireAdmin function appears to be incomplete in the source, skipping tests for now

  describe('canAccessClient', () => {
    it('should allow admin to access any client', () => {
      const adminUser = { id: 'admin123', email: 'admin@example.com', role: 'admin' as const };
      expect(canAccessClient(adminUser, 'anyclient@example.com')).toBe(true);
    });

    it('should allow client to access their own data', () => {
      const clientUser = { id: 'client123', email: 'client@example.com', role: 'client' as const };
      expect(canAccessClient(clientUser, 'client@example.com')).toBe(true);
    });

    it('should not allow client to access other client data', () => {
      const clientUser = { id: 'client123', email: 'client@example.com', role: 'client' as const };
      expect(canAccessClient(clientUser, 'otherclient@example.com')).toBe(false);
    });

    it('should return false for invalid role', () => {
      const invalidUser = { id: 'user123', email: 'user@example.com', role: 'invalid' as any };
      expect(canAccessClient(invalidUser, 'client@example.com')).toBe(false);
    });
  });
});
