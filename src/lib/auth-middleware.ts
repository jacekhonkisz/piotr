import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'client';
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  statusCode?: number;
}

/**
 * Centralized authentication middleware for API routes
 * @param request - NextRequest object
 * @returns AuthResult with user information or error details
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        statusCode: 401
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create a client with the JWT token
    const jwtClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get user from the JWT token
    const { data: { user }, error: authError } = await jwtClient.auth.getUser();
    
    if (authError || !user) {
      logger.error('Auth middleware - token validation failed:', { 
        error: authError?.message,
        tokenLength: token?.length,
        tokenPreview: token?.substring(0, 20) + '...'
      });
      return {
        success: false,
        error: `Unauthorized - Invalid token: ${authError?.message || 'No user found'}`,
        statusCode: 401
      };
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        error: 'User profile not found',
        statusCode: 404
      };
    }

    if (profile.role !== 'admin' && profile.role !== 'client') {
      return {
        success: false,
        error: 'Access denied - Invalid user role',
        statusCode: 403
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        role: profile.role
      }
    };

  } catch (error) {
    logger.error('Authentication error:', error);
    return {
      success: false,
      error: 'Internal authentication error',
      statusCode: 500
    };
  }
}

/**
 * Middleware to check if user has admin role
 * @param user - Authenticated user object
 * @returns boolean indicating if user is admin
 */
export function requireAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}

/**
 * Middleware to check if user can access a specific client
 * @param user - Authenticated user object
 * @param clientEmail - Email of the client being accessed
 * @returns boolean indicating if user can access the client
 */
export function canAccessClient(user: AuthenticatedUser, clientEmail: string): boolean {
  if (user.role === 'admin') {
    return true; // Admins can access any client
  }
  
  if (user.role === 'client') {
    return user.email === clientEmail; // Clients can only access their own data
  }
  
  return false;
}

/**
 * Helper function to create error response
 * @param error - Error message
 * @param statusCode - HTTP status code
 * @returns NextResponse with error
 */
export function createErrorResponse(error: string, statusCode: number = 400): NextResponse {
  return NextResponse.json({ error }, { status: statusCode });
}

/**
 * Helper function to create success response
 * @param data - Response data
 * @param statusCode - HTTP status code
 * @returns NextResponse with data
 */
export function createSuccessResponse(data: any, statusCode: number = 200): NextResponse {
  return NextResponse.json(data, { status: statusCode });
} 