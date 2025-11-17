/**
 * API Authentication Helper
 * 
 * Centralized authentication verification for API routes.
 * This ensures all data endpoints require proper authentication.
 * 
 * @module api-auth-helper
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Authentication result interface
 */
export interface AuthResult {
  user: {
    id: string;
    email: string;
    role?: string;
  } | null;
  error: string | null;
  profile?: any;
}

/**
 * Verify authentication from request headers
 * 
 * @param request - Next.js request object
 * @returns Authentication result with user or error
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        user: null,
        error: 'Missing or invalid authorization header'
      };
    }

    // Extract token
    const token = authHeader.substring(7);
    
    if (!token) {
      return {
        user: null,
        error: 'Empty authorization token'
      };
    }

    // Create Supabase client with service role for verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        user: null,
        error: authError?.message || 'Invalid or expired token'
      };
    }

    // Get user profile for additional info (role, etc.)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: profile?.role
      },
      error: null,
      profile
    };

  } catch (error) {
    console.error('Authentication verification error:', error);
    return {
      user: null,
      error: 'Authentication verification failed'
    };
  }
}

/**
 * Verify user has access to a specific client
 * 
 * @param userId - User ID from authentication
 * @param clientId - Client ID being accessed
 * @param userRole - User role (admin or client)
 * @returns true if user has access, false otherwise
 */
export async function verifyClientAccess(
  userId: string,
  clientId: string,
  userRole?: string
): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admins have access to all clients
    if (userRole === 'admin') {
      // Verify the client exists and belongs to this admin
      const { data: client } = await supabase
        .from('clients')
        .select('id, admin_id')
        .eq('id', clientId)
        .single();

      return !!client;
    }

    // Regular users can only access their own client data
    const { data: client } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    return !!client;

  } catch (error) {
    console.error('Client access verification error:', error);
    return false;
  }
}

/**
 * Create unauthorized response
 * 
 * @param message - Error message
 * @returns NextResponse with 401 status
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { 
      error: message,
      code: 'UNAUTHORIZED'
    },
    { status: 401 }
  );
}

/**
 * Create forbidden response
 * 
 * @param message - Error message
 * @returns NextResponse with 403 status
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { 
      error: message,
      code: 'FORBIDDEN'
    },
    { status: 403 }
  );
}

/**
 * Middleware function to require authentication
 * Use this as a wrapper for API route handlers
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireAuth(request);
 *   if (authResult instanceof NextResponse) return authResult;
 *   
 *   const { user } = authResult;
 *   // Continue with authenticated logic...
 * }
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const authResult = await verifyAuth(request);

  if (authResult.error || !authResult.user) {
    return unauthorizedResponse(authResult.error || 'Authentication required');
  }

  return authResult;
}

/**
 * Middleware function to require authentication and client access
 * 
 * @param request - Next.js request object
 * @param clientId - Client ID to verify access for
 * @returns AuthResult or error response
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const body = await request.json();
 *   const authResult = await requireAuthAndClientAccess(request, body.clientId);
 *   if (authResult instanceof NextResponse) return authResult;
 *   
 *   const { user } = authResult;
 *   // Continue with authenticated and authorized logic...
 * }
 * ```
 */
export async function requireAuthAndClientAccess(
  request: NextRequest,
  clientId: string
): Promise<AuthResult | NextResponse> {
  // First verify authentication
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Verify client access
  const hasAccess = await verifyClientAccess(
    user!.id,
    clientId,
    user!.role
  );

  if (!hasAccess) {
    return forbiddenResponse('You do not have access to this client');
  }

  return authResult;
}

