import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import the same fetchReportData function from PDF generation
async function fetchReportData(clientId: string, dateRange: { start: string; end: string }, request: NextRequest) {
  // Get client data using same pattern as reports page (no auth)
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
    
  if (clientError || !clientData) {
    throw new Error('Client not found');
  }
  
  const reportData: any = {
    clientId,
    clientName: clientData.name,
    clientLogo: clientData.logo_url || undefined,
    dateRange,
    aiSummary: undefined,
    yoyComparison: undefined,
    metaData: undefined,
    googleData: undefined
  };
  
  // Import the same data fetchers used by reports page
  const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
  const { GoogleAdsStandardizedDataFetcher } = await import('../../../lib/google-ads-standardized-data-fetcher');
  
  // Fetch Meta data using EXACT same logic as reports page
  let metaData = null;
  let metaError = null;
  
  if (clientData.meta_access_token && clientData.ad_account_id) {
    try {
      // Use the working fetch-live-data API instead of StandardizedDataFetcher
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: clientId,
          dateRange: dateRange,
          platform: 'meta',
          reason: 'email-generation-meta'
        })
      });
      
      if (response.ok) {
        const metaResult = await response.json();
        if (metaResult.success) {
          metaData = metaResult.data;
          reportData.metaData = metaData;
        } else {
          metaError = metaResult.debug?.reason || 'Unknown error';
        }
      } else {
        metaError = `API call failed: ${response.status}`;
      }
    } catch (error) {
      metaError = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  
  // Fetch Google data using EXACT same logic as reports page
  let googleData = null;
  let googleError = null;
  
  if (clientData.google_ads_enabled && clientData.google_ads_customer_id) {
    try {
      // First try with refresh token if available
      if (clientData.google_ads_refresh_token) {
        const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
          clientId: clientId,
          dateRange: dateRange,
          reason: 'email-generation-google',
          sessionToken: clientData.google_ads_refresh_token
        });
        
        if (googleResult.success) {
          googleData = googleResult.data;
          reportData.googleData = googleData;
        } else {
          googleError = googleResult.debug?.reason || 'Unknown error';
        }
      } else {
        // If no refresh token, try to fetch from Google Ads smart cache
        console.log('🔄 No Google Ads refresh token, trying smart cache...');
        const cacheResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-ads-smart-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            clientId: clientId,
            forceRefresh: false
          })
        });
        
        if (cacheResponse.ok) {
          const cacheResult = await cacheResponse.json();
          if (cacheResult.success && cacheResult.data) {
            googleData = cacheResult.data;
            reportData.googleData = googleData;
            console.log('✅ Google Ads data fetched from cache:', {
              spend: googleData.stats?.totalSpend || 0,
              impressions: googleData.stats?.totalImpressions || 0
            });
          } else {
            googleError = 'No Google Ads data in cache';
          }
        } else {
          googleError = `Google Ads cache API failed: ${cacheResponse.status}`;
        }
      }
    } catch (error) {
      googleError = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  
  // AI SUMMARY REMOVED: Only PDF generation should create AI summary
  // Email system will get AI summary directly from PDF generation
  logger.info('🚫 AI summary generation DISABLED in get-report-data-only');
  logger.info('📧 Email system should get AI summary from PDF generation instead');
  reportData.aiSummary = undefined;
  
  return reportData;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, dateRange } = body;

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Missing clientId or dateRange' }, { status: 400 });
    }

    // Fetch report data using the same logic as PDF generation
    const reportData = await fetchReportData(clientId, dateRange, request);
    
    return NextResponse.json({
      success: true,
      data: reportData,
      aiSummary: reportData.aiSummary,
      aiSummaryLength: reportData.aiSummary?.length || 0,
      hasMetaData: !!reportData.metaData,
      hasGoogleData: !!reportData.googleData
    });

  } catch (error) {
    console.error('❌ Error fetching report data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch report data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
