/**
 * Unified Data Fetcher - Extracted from reports page
 * 
 * This is the EXACT same logic used in /reports page (lines 162-237)
 * to ensure consistency between dashboard and reports data fetching.
 */

/**
 * Unified data fetching function - handles both Meta and Google Ads
 * Uses the same API endpoints and logic as reports page
 */
export const fetchUnifiedData = async (params: {
  dateRange: { start: string; end: string };
  clientId: string;
  platform?: string;
  forceFresh?: boolean;
  reason?: string;
  session?: any;
}) => {
  const { dateRange, clientId, platform = 'meta', forceFresh = false, reason, session } = params;
  
  console.log('📡 🔧 UNIFIED DATA FETCH:', {
    dateRange,
    clientId,
    platform,
    forceFresh,
    reason,
    timestamp: new Date().toISOString()
  });

  // Determine API endpoint based on platform (same as reports)
  const apiEndpoint = platform === 'meta' 
    ? '/api/fetch-live-data'
    : '/api/fetch-google-ads-live-data';

  // Prepare request body with consistent structure (same as reports)
  const requestBody = {
    dateRange,
    clientId,
    platform,
    ...(forceFresh && { forceFresh: true }),
    ...(reason && { reason })
  };

  console.log('📡 Unified API call:', { endpoint: apiEndpoint, body: requestBody });

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // 🔧 CACHE VALIDATION: Log data source for debugging (same as reports)
    if (result.data?.dataSourceValidation) {
      const validation = result.data.dataSourceValidation;
      console.log('📊 DATA SOURCE VALIDATION:', {
        expected: validation.expectedSource,
        actual: validation.actualSource,
        cacheFirstEnforced: validation.cacheFirstEnforced,
        potentialCacheBypassed: validation.potentialCacheBypassed
      });
      
      // Warn if cache was bypassed unexpectedly (same as reports)
      if (validation.potentialCacheBypassed) {
        console.warn('🚨 CACHE BYPASS WARNING: Live API used when cache should have been available');
      }
    }

    console.log('📡 Unified API response:', {
      success: result.success,
      campaignCount: result.data?.campaigns?.length || 0,
      source: result.debug?.source || 'unknown',
      cachePolicy: result.debug?.cachePolicy || 'unknown'
    });

    return result;
  } catch (error) {
    console.error('📡 Unified API error:', error);
    throw error;
  }
};
