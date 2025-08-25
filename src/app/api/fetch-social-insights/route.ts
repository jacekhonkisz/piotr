import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SocialInsightsService } from '../../../lib/social-insights-api';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('Social insights fetch started', { endpoint: '/api/fetch-social-insights' });
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    const { user } = authResult;
    
    // Parse request body
    const requestBody = await request.json();
    const { dateRange, clientId, period = 'day' } = requestBody;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    if (!dateRange || !dateRange.start || !dateRange.end) {
      return createErrorResponse('Date range required', 400);
    }
    
    // Get client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      console.error('❌ Client not found:', { clientId, error: clientError });
      return createErrorResponse('Client not found', 404);
    }
    
    // Check if user can access this client
    if (!canAccessClient(user, clientData.email)) {
      return createErrorResponse('Access denied', 403);
    }

    const client = clientData;
    
    // Validate client has required Meta credentials
    if (!client.meta_access_token) {
      return createErrorResponse('Client missing Meta access token', 400);
    }
    
    logger.info('Client validated for social insights', {
      id: client.id,
      name: client.name,
      email: client.email,
      hasMetaToken: !!client.meta_access_token
    });
    
    // Initialize Social Insights API service
    const socialService = new SocialInsightsService(client.meta_access_token);
    
    // Validate social permissions first
    const permissionCheck = await socialService.validateSocialPermissions();
    if (!permissionCheck.valid) {
      logger.warn('Insufficient social permissions', {
        clientId: client.id,
        missing: permissionCheck.missing,
        granted: permissionCheck.permissions
      });
      
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for social insights',
        details: {
          missing: permissionCheck.missing,
          required: ['pages_read_engagement', 'pages_show_list', 'instagram_basic', 'instagram_manage_insights']
        }
      }, { status: 400 });
    }
    
    // Fetch social insights
    logger.info('Fetching social insights', {
      clientId: client.id,
      dateRange,
      period
    });
    
    const socialMetrics = await socialService.getSocialMetrics(
      dateRange.start,
      dateRange.end,
      period
    );
    
    if (!socialMetrics) {
      return createErrorResponse('Failed to fetch social insights', 500);
    }
    
    // Get available accounts info
    const availableAccounts = await socialService.getAvailableAccounts();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info('Social insights fetch completed', {
      clientId: client.id,
      duration: `${duration}ms`,
      facebookMetrics: Object.keys(socialMetrics.facebook).length,
      instagramMetrics: Object.keys(socialMetrics.instagram).length,
      pagesFound: availableAccounts.pages.length,
      instagramAccountsFound: availableAccounts.instagram.length
    });
    
    return NextResponse.json({
      success: true,
      data: {
        metrics: socialMetrics,
        accounts: availableAccounts,
        permissions: permissionCheck.permissions,
        metadata: {
          clientId: client.id,
          clientName: client.name,
          dateRange: socialMetrics.dateRange,
          period,
          fetchDuration: duration
        }
      }
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.error('Social insights fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`
    });
    
    return createErrorResponse(
      `Social insights fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
} 