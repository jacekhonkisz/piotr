/**
 * OPTIMIZATION 1: PARALLEL DATA FETCHING
 * 
 * Replace sequential Meta + Google API calls with parallel execution
 * 
 * Expected Impact: 40-50% faster (from 20-40s to 10-20s)
 * Implementation Time: 30 minutes
 * Risk: Low
 */

import { NextRequest, NextResponse } from 'next/server';

// ❌ BEFORE: Sequential execution
async function fetchDataSequential(request: NextRequest, targetClient: any, startDate: string, endDate: string) {
  const startTime = Date.now();
  
  // First Meta (10-20 seconds)
  let metaData = null;
  if (targetClient.meta_access_token && targetClient.ad_account_id) {
    const metaResponse = await fetch(`/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.headers.get('authorization')?.substring(7)}`
      },
      body: JSON.stringify({
        clientId: targetClient.id,
        dateRange: { start: startDate, end: endDate },
        platform: 'meta'
      })
    });
    
    if (metaResponse.ok) {
      const metaResult = await metaResponse.json();
      metaData = metaResult.success ? metaResult.data : null;
    }
  }
  
  // Then Google (another 10-20 seconds)
  let googleData = null;
  if (targetClient.google_ads_enabled && targetClient.google_ads_customer_id) {
    const googleResponse = await fetch(`/api/fetch-google-ads-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.headers.get('authorization')?.substring(7)}`
      },
      body: JSON.stringify({
        clientId: targetClient.id,
        dateRange: { start: startDate, end: endDate }
      })
    });
    
    if (googleResponse.ok) {
      const googleResult = await googleResponse.json();
      googleData = googleResult.success ? googleResult.data : null;
    }
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`⏱️ Sequential fetch took ${totalTime}ms`);
  // Total: Meta time + Google time = 20-40 seconds
  
  return { metaData, googleData };
}

// ✅ AFTER: Parallel execution
async function fetchDataParallel(request: NextRequest, targetClient: any, startDate: string, endDate: string) {
  const startTime = Date.now();
  const authToken = request.headers.get('authorization')?.substring(7);
  
  // Create both promises first (don't await yet)
  const promises = [];
  
  // Meta promise
  if (targetClient.meta_access_token && targetClient.ad_account_id) {
    promises.push(
      fetch(`/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          clientId: targetClient.id,
          dateRange: { start: startDate, end: endDate },
          platform: 'meta'
        })
      })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Meta API error: ${response.status}`);
        const result = await response.json();
        return { platform: 'meta', data: result.success ? result.data : null };
      })
      .catch((error) => {
        console.error('Meta fetch failed:', error);
        return { platform: 'meta', data: null, error: error.message };
      })
    );
  } else {
    promises.push(Promise.resolve({ platform: 'meta', data: null }));
  }
  
  // Google promise
  if (targetClient.google_ads_enabled && targetClient.google_ads_customer_id) {
    promises.push(
      fetch(`/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          clientId: targetClient.id,
          dateRange: { start: startDate, end: endDate }
        })
      })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Google API error: ${response.status}`);
        const result = await response.json();
        return { platform: 'google', data: result.success ? result.data : null };
      })
      .catch((error) => {
        console.error('Google fetch failed:', error);
        return { platform: 'google', data: null, error: error.message };
      })
    );
  } else {
    promises.push(Promise.resolve({ platform: 'google', data: null }));
  }
  
  // Wait for both to complete
  const results = await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  console.log(`⚡ Parallel fetch took ${totalTime}ms`);
  // Total: max(Meta time, Google time) = 10-20 seconds (50% improvement!)
  
  // Extract results
  const metaResult = results.find(r => r.platform === 'meta');
  const googleResult = results.find(r => r.platform === 'google');
  
  return {
    metaData: metaResult?.data || null,
    googleData: googleResult?.data || null,
    metaError: metaResult?.error || null,
    googleError: googleResult?.error || null
  };
}

// ✅ EVEN BETTER: Using Promise.allSettled for better error handling
async function fetchDataParallelResilient(
  request: NextRequest, 
  targetClient: any, 
  startDate: string, 
  endDate: string
) {
  const startTime = Date.now();
  const authToken = request.headers.get('authorization')?.substring(7);
  
  // Helper function to create fetch promise
  const createFetchPromise = (endpoint: string, platform: string, enabled: boolean) => {
    if (!enabled) {
      return Promise.resolve({ platform, data: null, error: null, skipped: true });
    }
    
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        clientId: targetClient.id,
        dateRange: { start: startDate, end: endDate },
        platform
      }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`${platform} API returned ${response.status}`);
      }
      const result = await response.json();
      return { 
        platform, 
        data: result.success ? result.data : null,
        error: result.success ? null : result.error
      };
    })
    .catch((error) => {
      console.error(`${platform} fetch failed:`, error.message);
      return { 
        platform, 
        data: null, 
        error: error.message 
      };
    });
  };
  
  // Create both promises
  const [metaResult, googleResult] = await Promise.allSettled([
    createFetchPromise(
      '/api/fetch-live-data',
      'meta',
      !!(targetClient.meta_access_token && targetClient.ad_account_id)
    ),
    createFetchPromise(
      '/api/fetch-google-ads-live-data',
      'google',
      !!(targetClient.google_ads_enabled && targetClient.google_ads_customer_id)
    )
  ]);
  
  const totalTime = Date.now() - startTime;
  
  // Log performance metrics
  console.log(`⚡ Parallel resilient fetch completed:`, {
    totalTime: `${totalTime}ms`,
    metaStatus: metaResult.status,
    googleStatus: googleResult.status,
    improvement: `~${Math.round((40000 - totalTime) / 40000 * 100)}% faster than worst-case sequential`
  });
  
  // Extract results safely
  const meta = metaResult.status === 'fulfilled' ? metaResult.value : { data: null, error: 'Promise rejected' };
  const google = googleResult.status === 'fulfilled' ? googleResult.value : { data: null, error: 'Promise rejected' };
  
  return {
    metaData: meta.data,
    googleData: google.data,
    metaError: meta.error,
    googleError: google.error,
    responseTime: totalTime
  };
}

/**
 * COMPLETE REPLACEMENT FOR generate-report/route.ts lines 109-182
 */
export async function generateReportOptimized(request: NextRequest, targetClient: any, startDate: string, endDate: string) {
  console.log('🔄 Using optimized parallel data fetching...');
  
  // Parallel fetch with resilient error handling
  const { metaData, googleData, metaError, googleError, responseTime } = 
    await fetchDataParallelResilient(request, targetClient, startDate, endDate);
  
  // Combine data from both platforms
  const combinedCampaigns = [
    ...(metaData?.campaigns || []),
    ...(googleData?.campaigns || [])
  ];
  
  // Calculate combined stats
  const combinedStats = {
    totalSpend: (metaData?.stats?.totalSpend || 0) + (googleData?.stats?.totalSpend || 0),
    totalImpressions: (metaData?.stats?.totalImpressions || 0) + (googleData?.stats?.totalImpressions || 0),
    totalClicks: (metaData?.stats?.totalClicks || 0) + (googleData?.stats?.totalClicks || 0),
    totalConversions: (metaData?.stats?.totalConversions || 0) + (googleData?.stats?.totalConversions || 0),
    averageCtr: 0,
    averageCpc: 0
  };
  
  combinedStats.averageCtr = combinedStats.totalImpressions > 0 ? 
    (combinedStats.totalClicks / combinedStats.totalImpressions) * 100 : 0;
  combinedStats.averageCpc = combinedStats.totalClicks > 0 ? 
    combinedStats.totalSpend / combinedStats.totalClicks : 0;
  
  // Combine conversion metrics
  const combinedConversionMetrics = {
    click_to_call: (metaData?.conversionMetrics?.click_to_call || 0) + (googleData?.conversionMetrics?.click_to_call || 0),
    email_contacts: (metaData?.conversionMetrics?.email_contacts || 0) + (googleData?.conversionMetrics?.email_contacts || 0),
    booking_step_1: (metaData?.conversionMetrics?.booking_step_1 || 0) + (googleData?.conversionMetrics?.booking_step_1 || 0),
    booking_step_2: (metaData?.conversionMetrics?.booking_step_2 || 0) + (googleData?.conversionMetrics?.booking_step_2 || 0),
    booking_step_3: (metaData?.conversionMetrics?.booking_step_3 || 0) + (googleData?.conversionMetrics?.booking_step_3 || 0),
    reservations: (metaData?.conversionMetrics?.reservations || 0) + (googleData?.conversionMetrics?.reservations || 0),
    reservation_value: (metaData?.conversionMetrics?.reservation_value || 0) + (googleData?.conversionMetrics?.reservation_value || 0),
    roas: 0,
    cost_per_reservation: 0
  };
  
  combinedConversionMetrics.roas = combinedStats.totalSpend > 0 ? 
    combinedConversionMetrics.reservation_value / combinedStats.totalSpend : 0;
  combinedConversionMetrics.cost_per_reservation = combinedConversionMetrics.reservations > 0 ? 
    combinedStats.totalSpend / combinedConversionMetrics.reservations : 0;
  
  // Performance logging
  console.log('📊 Report generation performance:', {
    dataFetchTime: `${responseTime}ms`,
    metaSuccess: !!metaData,
    googleSuccess: !!googleData,
    totalCampaigns: combinedCampaigns.length,
    totalSpend: combinedStats.totalSpend
  });
  
  return {
    date_range: { start: startDate, end: endDate },
    generated_at: new Date().toISOString(),
    account_summary: combinedStats,
    campaigns: combinedCampaigns,
    conversionMetrics: combinedConversionMetrics,
    platformData: {
      meta: metaData,
      google: googleData
    },
    errors: {
      meta: metaError,
      google: googleError
    },
    performance: {
      dataFetchTime: responseTime,
      optimizationApplied: 'parallel-fetching'
    }
  };
}

/**
 * USAGE:
 * 
 * In src/app/api/generate-report/route.ts, replace lines 104-258 with:
 * 
 * const report = await generateReportOptimized(request, targetClient, startDate, endDate);
 */

