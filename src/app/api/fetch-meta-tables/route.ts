import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api-optimized';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('Meta tables fetch started', { endpoint: '/api/fetch-meta-tables' });
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    const user = authResult.user;
    logger.info('🔐 Meta tables fetch authenticated for user:', user.email);
    
    // Parse request body
    const requestBody = await request.json();
    const { dateRange, clientId, forceRefresh } = requestBody;
    
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

    const client = clientData;
    
    // Validate client has required Meta credentials
    if (!client.meta_access_token || !client.ad_account_id) {
      return createErrorResponse('Client missing Meta Ads credentials', 400);
    }
    
    logger.info('Success', {
      id: client.id,
      name: client.name,
      dateRange,
      forceRefresh
    });
    
    // 🔧 NEW: Check if this is a current month request - use smart cache
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const isCurrentMonth = 
      startDate.getFullYear() === currentYear &&
      startDate.getMonth() === currentMonth &&
      endDate >= now;
    
    logger.info('🔍 Meta tables date range analysis:', {
      isCurrentMonth,
      startDate: dateRange.start,
      endDate: dateRange.end,
      currentDate: now.toISOString().split('T')[0]
    });
    
    // 🔧 CRITICAL FIX: Force smart cache for current month (bypass all fallbacks)
    if (isCurrentMonth && !forceRefresh) {
      logger.info('🔧 Attempting smart cache for current month');
      try {
        const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
        const cacheResult = await getSmartCacheData(clientId, false, 'meta');
        
        logger.info('📊 Smart cache result:', {
          success: cacheResult.success,
          demographicCount: cacheResult.data?.metaTables?.demographicPerformance?.length || 0,
          placementCount: cacheResult.data?.metaTables?.placementPerformance?.length || 0
        });
        
        // If smart cache has data, return it immediately (even if metaTables is empty)
        if (cacheResult.success && cacheResult.data) {
          const metaTables = cacheResult.data.metaTables || {
            demographicPerformance: [],
            placementPerformance: [],
            adRelevanceResults: []
          };
          
          const demographicsCount = metaTables.demographicPerformance?.length || 0;
          const placementCount = metaTables.placementPerformance?.length || 0;
          
          // 🔧 CRITICAL FIX: If cache has empty arrays, fall back to live API
          if (demographicsCount === 0 && placementCount === 0) {
            logger.info('⚠️ Cache has empty metaTables - falling back to live API');
            // Don't return here - let it fall through to live API section below
          } else {
            // Cache has data - return it
            logger.info('✅ Returning from smart cache with data');
            const responseTime = Date.now() - startTime;
            
            return NextResponse.json({
              success: true,
              data: {
                metaTables,
                dateRange,
                client: { id: client.id, name: client.name }
              },
              debug: {
                responseTime,
                source: 'smart-cache-forced',
                cacheAge: cacheResult.data.cacheAge || 0,
                metaApiError: null,
                hasMetaApiError: false,
                authenticatedUser: user.email
              }
            });
          }
        }
      } catch (cacheError) {
        console.error('❌ FORCED smart cache failed:', cacheError);
        logger.error('Smart cache error:', cacheError);
      }
    }
    
    // 🔧 REMOVED: Duplicate smart cache check that was returning empty arrays
    // The forced check above now handles all smart cache logic with proper empty array validation
    
    // 🔴 FALLBACK: Fetch from live Meta API (historical data or cache miss)
    logger.info('📊 Fetching meta tables from live API...');
    
    // Initialize Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    let metaTables = null;
    let metaApiError: string | null = null;
    
    try {
      // Fetch all meta tables in parallel with individual error handling
      const [placementResult, demographicResult, adRelevanceResult] = await Promise.allSettled([
        metaService.getPlacementPerformance(adAccountId, dateRange.start, dateRange.end),
        metaService.getDemographicPerformance(adAccountId, dateRange.start, dateRange.end),
        metaService.getAdRelevanceResults(adAccountId, dateRange.start, dateRange.end)
      ]);
      
      // Process results with individual error handling
      let placementData: any[] = [];
      let demographicData: any[] = [];
      let adRelevanceData: any[] = [];
      let partialErrors: string[] = [];
      
      if (placementResult.status === 'fulfilled') {
        placementData = placementResult.value || [];
        logger.info('Success', placementData.length, 'records');
      } else {
        console.error('❌ Placement performance failed:', placementResult.reason);
        partialErrors.push(`Placement: ${placementResult.reason}`);
      }
      
      if (demographicResult.status === 'fulfilled') {
        demographicData = demographicResult.value || [];
        logger.info('Success', demographicData.length, 'records');
      } else {
        console.error('❌ Demographic performance failed:', demographicResult.reason);
        partialErrors.push(`Demographics: ${demographicResult.reason}`);
      }
      
      if (adRelevanceResult.status === 'fulfilled') {
        adRelevanceData = adRelevanceResult.value || [];
        logger.info('Success', adRelevanceData.length, 'records');
      } else {
        console.error('❌ Ad relevance results failed:', adRelevanceResult.reason);
        partialErrors.push(`Ad Relevance: ${adRelevanceResult.reason}`);
      }
      
      metaTables = {
        placementPerformance: placementData,
        demographicPerformance: demographicData,
        adRelevanceResults: adRelevanceData
      };
      
      // Set error message if any partial failures occurred
      if (partialErrors.length > 0) {
        metaApiError = `Partial Meta API failures: ${partialErrors.join(', ')}`;
        logger.info('⚠️ Partial meta tables data available despite some API failures');
      } else {
        logger.info('Success', {
          placementCount: placementData.length,
          demographicCount: demographicData.length,
          adRelevanceCount: adRelevanceData.length
        });
      }
      
    } catch (error) {
      console.error('❌ Complete failure to fetch meta tables:', error);
      metaApiError = error instanceof Error ? error.message : 'Unknown error';
      metaTables = {
        placementPerformance: [],
        demographicPerformance: [],
        adRelevanceResults: []
      };
    }

    const responseTime = Date.now() - startTime;
    
    logger.info('Meta tables fetch completed', {
      clientId: client.id,
      responseTime,
      hasError: !!metaApiError,
      source: 'live-api'
    });

    return NextResponse.json({
      success: true,
      data: {
        metaTables,
        dateRange,
        client: {
          id: client.id,
          name: client.name
        }
      },
      debug: {
        responseTime,
        source: 'live-api',
        cacheAge: 0,
        metaApiError,
        hasMetaApiError: !!metaApiError,
        authenticatedUser: user.email
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Meta tables fetch failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Meta tables fetch failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 