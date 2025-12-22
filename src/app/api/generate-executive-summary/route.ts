import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';
import logger from '../../../lib/logger';
import { authenticateRequest } from '../../../lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExecutiveSummaryData {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  averageCpa: number;
  currency: string;
  dateRange: {
    start: string;
    end: string;
  };
  clientName: string;
  // Conversion tracking data (if available)
  reservations?: number;
  reservationValue?: number;
  roas?: number;
  microConversions?: number;
  costPerReservation?: number;
  yearOverYearComparison?: {
    reservationValue: number;
    percentageChange: number;
  };
  estimatedOfflineImpact?: number;
  // Platform attribution
  platformAttribution?: string;
  platformSources?: string[];
  platformBreakdown?: {
    meta?: {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    };
    google?: {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    logger.info('🔑 AI Summary: Starting');
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const user = authResult.user;
    logger.info('🔐 Executive summary request authenticated for user:', user.email);

    // Parse request body
    const { clientId, dateRange, reportData } = await request.json();
    
    logger.info('🔍 [DEBUG] Raw request data structure:', {
      hasClientId: !!clientId,
      hasDateRange: !!dateRange,
      hasReportData: !!reportData,
      reportDataKeys: reportData ? Object.keys(reportData) : [],
      reportDataType: typeof reportData,
      hasMetaData: !!(reportData?.metaData),
      hasGoogleData: !!(reportData?.googleData),
      hasAccountSummary: !!(reportData?.account_summary),
      metaDataStructure: reportData?.metaData ? Object.keys(reportData.metaData) : [],
      googleDataStructure: reportData?.googleData ? Object.keys(reportData.googleData) : []
    });

    if (!clientId || !dateRange) {
      return NextResponse.json({ 
        error: 'Missing required parameters: clientId, dateRange' 
      }, { status: 400 });
    }

    // Get client data (no auth check)
    logger.info('🔍 AI Summary: Querying client data:', { clientId });
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    logger.info('📊 AI Summary: Client query result:', { 
      found: !!client, 
      error: clientError?.message,
      errorCode: clientError?.code 
    });

    if (clientError || !client) {
      logger.error('❌ AI Summary: Client not found:', { clientId, error: clientError });
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    
    logger.info('✅ AI Summary: Client data loaded:', { id: client.id, name: client.name });

    // Fetch data from smart cache/database instead of relying on passed data
    let actualReportData;
    let kpiData: any[] = [];
    
    // Check if client has both Meta and Google Ads for unified data fetching
    const hasGoogleAds = client.google_ads_enabled && client.google_ads_customer_id;
    const hasMetaAds = client.ad_account_id && client.meta_access_token;
    const shouldFetchUnifiedData = hasGoogleAds && hasMetaAds;
    
    logger.info('🔍 [AI-SUMMARY] Platform detection:', {
      hasGoogleAds,
      hasMetaAds,
      shouldFetchUnifiedData
    });
    
    // Helper function to sanitize numbers and prevent NaN/string concatenation
    const sanitizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };
    
    if (reportData && (reportData.metaData || reportData.googleData)) {
      // If reportData is provided with new structure (from PDF generation), convert it
      logger.info('🔍 [DEBUG] Extracting data from new structure:', {
        metaDataMetrics: reportData.metaData?.metrics,
        googleDataMetrics: reportData.googleData?.metrics
      });
      
      // ✅ CRITICAL FIX: Convert all values to numbers to prevent string concatenation
      const metaSpend = sanitizeNumber(reportData.metaData?.metrics?.totalSpend);
      const metaImpressions = sanitizeNumber(reportData.metaData?.metrics?.totalImpressions);
      const metaClicks = sanitizeNumber(reportData.metaData?.metrics?.totalClicks);
      // ONLY CHANGE: Get reservations from conversionMetrics instead of metrics
      const metaReservations = sanitizeNumber(reportData.metaData?.conversionMetrics?.reservations || 
                              reportData.metaData?.metrics?.totalReservations);
      const metaReservationValue = sanitizeNumber(reportData.metaData?.conversionMetrics?.reservation_value || 
                                  reportData.metaData?.metrics?.totalReservationValue);
      
      const googleSpend = sanitizeNumber(reportData.googleData?.metrics?.totalSpend);
      const googleImpressions = sanitizeNumber(reportData.googleData?.metrics?.totalImpressions);
      const googleClicks = sanitizeNumber(reportData.googleData?.metrics?.totalClicks);
      // ONLY CHANGE: Get reservations from conversionMetrics instead of metrics
      const googleReservations = sanitizeNumber(reportData.googleData?.conversionMetrics?.reservations || 
                                reportData.googleData?.metrics?.totalReservations);
      const googleReservationValue = sanitizeNumber(reportData.googleData?.conversionMetrics?.reservation_value || 
                                    reportData.googleData?.metrics?.totalReservationValue);
      
      logger.info('🔍 [DEBUG] Extracted values:', {
        metaSpend, metaImpressions, metaClicks, metaReservations, metaReservationValue,
        googleSpend, googleImpressions, googleClicks, googleReservations, googleReservationValue,
        totalSpend: metaSpend + googleSpend,
        totalReservations: metaReservations + googleReservations,
        totalReservationValue: metaReservationValue + googleReservationValue
      });
      
      actualReportData = {
        account_summary: {
          total_spend: metaSpend + googleSpend,
          total_impressions: metaImpressions + googleImpressions,
          total_clicks: metaClicks + googleClicks,
          total_conversions: metaReservations + googleReservations,
          average_ctr: ((metaClicks + googleClicks) / (metaImpressions + googleImpressions)) * 100 || 0,
          average_cpc: (metaSpend + googleSpend) / (metaClicks + googleClicks) || 0,
          average_cpa: (metaSpend + googleSpend) / (metaReservations + googleReservations) || 0,
          total_conversion_value: metaReservationValue + googleReservationValue,
          roas: (metaReservationValue + googleReservationValue) / (metaSpend + googleSpend) || 0,
          micro_conversions: (reportData.metaData?.conversionMetrics?.booking_step_1 || 0) + (reportData.googleData?.conversionMetrics?.booking_step_1 || 0) + (reportData.metaData?.funnel?.booking_step_1 || 0) + (reportData.googleData?.funnel?.booking_step_1 || 0),
          meta_spend: metaSpend,
          meta_impressions: metaImpressions,
          meta_clicks: metaClicks,
          meta_conversions: metaReservations,
          google_spend: googleSpend,
          google_impressions: googleImpressions,
          google_clicks: googleClicks,
          google_conversions: googleReservations
        }
      };
      
      logger.info('📊 [DATA-SYNC] Using provided report data (NEW STRUCTURE) for AI summary:', {
        totalSpend: actualReportData.account_summary.total_spend,
        metaSpend: actualReportData.account_summary.meta_spend,
        googleSpend: actualReportData.account_summary.google_spend,
        hasUnifiedData: !!(actualReportData.account_summary.meta_spend && actualReportData.account_summary.google_spend),
        dataSource: 'PROVIDED_BY_PDF_NEW_STRUCTURE'
      });
    } else if (reportData && reportData.account_summary) {
      // If reportData is provided with old structure, use it
      actualReportData = reportData;
      logger.info('📊 [DATA-SYNC] Using provided report data (OLD STRUCTURE) for AI summary:', {
        totalSpend: actualReportData.account_summary.total_spend,
        metaSpend: actualReportData.account_summary.meta_spend,
        googleSpend: actualReportData.account_summary.google_spend,
        hasUnifiedData: !!(actualReportData.account_summary.meta_spend && actualReportData.account_summary.google_spend),
        dataSource: 'PROVIDED_BY_PDF_OLD_STRUCTURE'
      });
    } else {
      // Fetch data from the same source as reports (smart cache/database)
      logger.info('📊 Fetching data from smart cache for AI summary...');
      
      try {
        // Import the smart cache helper
        const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
        
        // Determine if this is current month to use smart cache
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isCurrentMonth = dateRange.start.startsWith(currentMonth);
        
        if (isCurrentMonth) {
          // Use smart cache for current month
          const cacheResult = await getSmartCacheData(clientId, false);
          
          // Extract platform-specific data
          const metaStats = cacheResult.data.meta?.stats || {};
          const googleStats = cacheResult.data.googleAds?.stats || {};
          
          actualReportData = {
            account_summary: {
              total_spend: cacheResult.data.combined?.totalSpend || 0,
              total_impressions: cacheResult.data.combined?.totalImpressions || 0,
              total_clicks: cacheResult.data.combined?.totalClicks || 0,
              total_conversions: cacheResult.data.combined?.totalConversions || 0,
              average_ctr: cacheResult.data.combined?.averageCtr || 0,
              average_cpc: cacheResult.data.combined?.averageCpc || 0,
              average_cpa: cacheResult.data.combined?.totalConversions > 0 ? 
                (cacheResult.data.combined.totalSpend / cacheResult.data.combined.totalConversions) : 0,
              total_conversion_value: 0,
              roas: 0,
              micro_conversions: 0,
              // Add platform-specific breakdown
              meta_spend: metaStats.totalSpend || 0,
              meta_impressions: metaStats.totalImpressions || 0,
              meta_clicks: metaStats.totalClicks || 0,
              meta_conversions: metaStats.totalConversions || 0,
              google_spend: googleStats.totalSpend || 0,
              google_impressions: googleStats.totalImpressions || 0,
              google_clicks: googleStats.totalClicks || 0,
              google_conversions: googleStats.totalConversions || 0
            }
          };
          
          logger.info('✅ Fetched data from smart cache:', {
            spend: actualReportData.account_summary.total_spend,
            impressions: actualReportData.account_summary.total_impressions,
            metaSpend: actualReportData.account_summary.meta_spend,
            googleSpend: actualReportData.account_summary.google_spend,
            source: cacheResult.source
          });
        } else {
          // For historical data, fetch from database
          const { data: fetchedKpiData, error: kpiError } = await supabase
            .from('daily_kpi_data')
            .select('*')
            .eq('client_id', clientId)
            .gte('date', dateRange.start)
            .lte('date', dateRange.end);
            
          if (kpiError) {
            throw new Error(`Failed to fetch historical data: ${kpiError.message}`);
          }
          
          kpiData = fetchedKpiData || [];
          
          // Calculate totals from KPI data
          const totals = kpiData.reduce((acc, day) => ({
            spend: acc.spend + (day.total_spend || 0),
            impressions: acc.impressions + (day.total_impressions || 0),
            clicks: acc.clicks + (day.total_clicks || 0),
            conversions: acc.conversions + (day.total_conversions || 0)
          }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          
          actualReportData = {
            account_summary: {
              total_spend: totals.spend,
              total_impressions: totals.impressions,
              total_clicks: totals.clicks,
              total_conversions: totals.conversions,
              average_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
              average_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
              average_cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
              total_conversion_value: 0,
              roas: 0,
              micro_conversions: 0
            }
          };
          
          logger.info('✅ Fetched historical data from database:', {
            spend: totals.spend,
            impressions: totals.impressions,
            records: kpiData.length
          });
        }
      } catch (error) {
        logger.error('❌ Failed to fetch data for AI summary:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch report data for AI summary generation'
        }, { status: 500 });
      }
    }

    // Fetch platform-separated data for unified reports (only if not provided by PDF)
    const hasProvidedPlatformData = actualReportData?.account_summary?.meta_spend !== undefined && 
                                   actualReportData?.account_summary?.google_spend !== undefined;
    
    if (shouldFetchUnifiedData && actualReportData?.account_summary && !hasProvidedPlatformData) {
      logger.info('🔍 [AI-SUMMARY] Fetching platform-separated data for unified summary...');
      
      try {
        // Fetch Meta data
        const metaResponse = await fetch('/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header (auth disabled)
          },
          body: JSON.stringify({
            dateRange,
            clientId,
            platform: 'meta'
          })
        });

        // Fetch Google Ads data
        const googleResponse = await fetch('/api/fetch-google-ads-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header (auth disabled)
          },
          body: JSON.stringify({
            dateRange,
            clientId,
            platform: 'google'
          })
        });

        let metaData = null;
        let googleData = null;

        if (metaResponse.ok) {
          const metaResult = await metaResponse.json();
          if (metaResult.success && metaResult.data) {
            metaData = metaResult.data;
            logger.info(`✅ [AI-SUMMARY] Fetched Meta data: ${metaData.stats?.totalSpend || 0} PLN`);
          }
        }

        if (googleResponse.ok) {
          const googleResult = await googleResponse.json();
          if (googleResult.success && googleResult.data) {
            googleData = googleResult.data;
            logger.info(`✅ [AI-SUMMARY] Fetched Google data: ${googleData.stats?.totalSpend || 0} PLN`);
          }
        }

        // Add platform-separated data to account_summary
        if (metaData || googleData) {
          actualReportData.account_summary.meta_spend = metaData?.stats?.totalSpend || 0;
          actualReportData.account_summary.meta_impressions = metaData?.stats?.totalImpressions || 0;
          actualReportData.account_summary.meta_clicks = metaData?.stats?.totalClicks || 0;
          actualReportData.account_summary.meta_conversions = metaData?.stats?.totalConversions || 0;
          
          actualReportData.account_summary.google_spend = googleData?.stats?.totalSpend || 0;
          actualReportData.account_summary.google_impressions = googleData?.stats?.totalImpressions || 0;
          actualReportData.account_summary.google_clicks = googleData?.stats?.totalClicks || 0;
          actualReportData.account_summary.google_conversions = googleData?.stats?.totalConversions || 0;
          
          logger.info('✅ [AI-SUMMARY] Added platform-separated data to account_summary');
        }
      } catch (error) {
        logger.error('❌ [AI-SUMMARY] Error fetching platform-separated data:', error);
        // Continue with combined data if platform separation fails
      }
    } else if (hasProvidedPlatformData) {
      logger.info('✅ [AI-SUMMARY] Using platform data provided by PDF generation:', {
        metaSpend: actualReportData.account_summary.meta_spend,
        googleSpend: actualReportData.account_summary.google_spend,
        source: 'pdf_unified_data'
      });
    }

    // Validate that we have actual data
    const hasValidData = actualReportData?.account_summary?.total_spend > 0 || 
                        actualReportData?.account_summary?.total_impressions > 0 || 
                        actualReportData?.account_summary?.total_clicks > 0;
    
    if (!hasValidData) {
      logger.warn('⚠️ No valid data found for AI summary generation', {
        clientId,
        dateRange,
        data: actualReportData?.account_summary
      });
      
      return NextResponse.json({
        success: false,
        error: 'No advertising data found for the specified period. AI summary cannot be generated without campaign data.'
      }, { status: 400 });
    }

    // Detect platform sources for attribution
    let platformAttribution = 'kampanie reklamowe'; // default generic
    let platformSources: string[] = [];
    let platformBreakdown: any = null;
    
    // Check if we have platform-specific data in actualReportData
    const metaSpend = actualReportData.account_summary?.meta_spend || 0;
    const googleSpend = actualReportData.account_summary?.google_spend || 0;
    const hasMetaData = metaSpend > 0 || (actualReportData.account_summary?.meta_impressions || 0) > 0;
    const hasGoogleData = googleSpend > 0 || (actualReportData.account_summary?.google_impressions || 0) > 0;
    
    if (hasMetaData || hasGoogleData) {
      // We have platform-specific data from smart cache
      if (hasMetaData && hasGoogleData) {
        platformAttribution = 'kampanie Meta Ads i Google Ads';
        platformSources = ['meta', 'google'];
        platformBreakdown = {
          meta: {
            spend: Number.isFinite(actualReportData.account_summary.meta_spend) ? actualReportData.account_summary.meta_spend : 0,
            impressions: Number.isFinite(actualReportData.account_summary.meta_impressions) ? actualReportData.account_summary.meta_impressions : 0,
            clicks: Number.isFinite(actualReportData.account_summary.meta_clicks) ? actualReportData.account_summary.meta_clicks : 0,
            conversions: Number.isFinite(actualReportData.account_summary.meta_conversions) ? actualReportData.account_summary.meta_conversions : 0
          },
          google: {
            spend: Number.isFinite(actualReportData.account_summary.google_spend) ? actualReportData.account_summary.google_spend : 0,
            impressions: Number.isFinite(actualReportData.account_summary.google_impressions) ? actualReportData.account_summary.google_impressions : 0,
            clicks: Number.isFinite(actualReportData.account_summary.google_clicks) ? actualReportData.account_summary.google_clicks : 0,
            conversions: Number.isFinite(actualReportData.account_summary.google_conversions) ? actualReportData.account_summary.google_conversions : 0
          }
        };
      } else if (hasMetaData) {
        platformAttribution = 'kampanie Meta Ads';
        platformSources = ['meta'];
      } else if (hasGoogleData) {
        platformAttribution = 'kampanie Google Ads';
        platformSources = ['google'];
      }
      
      logger.info('📊 Platform attribution from smart cache data:', {
        attribution: platformAttribution,
        hasMetaData,
        hasGoogleData,
        metaSpend,
        googleSpend
      });
    } else if (kpiData && kpiData.length > 0) {
      // Fallback to analyzing data sources from KPI data
      const sources = [...new Set(kpiData.map((day: any) => day.data_source))];
      const hasMetaSource = sources.some((s: string) => s && s.includes('meta'));
      const hasGoogleSource = sources.some((s: string) => s && s.includes('google'));
      
      if (hasMetaSource && hasGoogleSource) {
        platformAttribution = 'kampanie Meta Ads i Google Ads';
        platformSources = ['meta', 'google'];
      } else if (hasMetaSource) {
        platformAttribution = 'kampanie Meta Ads';
        platformSources = ['meta'];
      } else if (hasGoogleSource) {
        platformAttribution = 'kampanie Google Ads';
        platformSources = ['google'];
      }
      
      logger.info('📊 Platform attribution from KPI data sources:', {
        sources,
        attribution: platformAttribution,
        hasMetaSource,
        hasGoogleSource
      });
    }

    // If no platform data detected, skip AI summary generation
    if (platformSources.length === 0) {
      logger.info('⚠️ No platform data detected - skipping AI summary generation');
      return NextResponse.json({
        success: false,
        error: 'No platform data available for AI summary generation',
        skipSummary: true
      }, { status: 400 });
    }

    // Prepare data for AI summary (using correct API response structure)
    logger.info('📊 AI Summary data extraction - API response structure:', {
      hasStats: !!actualReportData.stats,
      hasConversionMetrics: !!actualReportData.conversionMetrics,
      hasAccountSummary: !!actualReportData.account_summary,
      statsKeys: actualReportData.stats ? Object.keys(actualReportData.stats) : [],
      conversionKeys: actualReportData.conversionMetrics ? Object.keys(actualReportData.conversionMetrics) : []
    });
    
    // Note: sanitizeNumber is already defined earlier in the function (line 127)
    
    const summaryData: ExecutiveSummaryData = {
      totalSpend: sanitizeNumber(actualReportData.account_summary?.total_spend),
      totalImpressions: sanitizeNumber(actualReportData.account_summary?.total_impressions),
      totalClicks: sanitizeNumber(actualReportData.account_summary?.total_clicks),
      totalConversions: sanitizeNumber(actualReportData.account_summary?.total_conversions),
      averageCtr: sanitizeNumber(actualReportData.account_summary?.average_ctr),
      averageCpc: sanitizeNumber(actualReportData.account_summary?.average_cpc),
      averageCpa: sanitizeNumber(actualReportData.account_summary?.average_cpa),
      currency: 'PLN', // Hardcoded to PLN for Polish market
      dateRange: dateRange,
      clientName: client.name,
      // Extract conversion tracking data if available - FIXED to use actual reservations
      reservations: sanitizeNumber(actualReportData.account_summary?.total_conversions),
      reservationValue: sanitizeNumber(actualReportData.account_summary?.total_conversion_value),
      roas: sanitizeNumber(actualReportData.account_summary?.roas),
      microConversions: sanitizeNumber(actualReportData.account_summary?.micro_conversions),
      costPerReservation: sanitizeNumber(actualReportData.account_summary?.average_cpa),
      // Add platform attribution
      platformAttribution: platformAttribution,
      platformSources: platformSources,
      platformBreakdown: platformBreakdown
    };

    logger.info('✅ AI Summary data prepared successfully:', {
      totalSpend: summaryData.totalSpend,
      totalImpressions: summaryData.totalImpressions,
      totalClicks: summaryData.totalClicks,
      totalConversions: summaryData.totalConversions,
      reservations: summaryData.reservations,
      reservationValue: summaryData.reservationValue,
      roas: summaryData.roas,
      clientName: summaryData.clientName
    });

    // Generate AI summary using OpenAI
    const aiSummary = await generateAISummary(summaryData);

    // If OpenAI failed, return error response
    if (!aiSummary) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate AI summary - OpenAI service unavailable'
      }, { status: 503 });
    }

    // Save to cache if within retention period (12 months) and not in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');
    const cacheService = ExecutiveSummaryCacheService.getInstance();
    
    if (!isDevelopment && cacheService.isWithinRetentionPeriod(dateRange)) {
      await cacheService.saveSummary(clientId, dateRange, aiSummary);
      logger.info('💾 Saved AI Executive Summary to cache');
    } else if (isDevelopment) {
      logger.info('🔄 [DEV MODE] Skipping AI summary cache save for development');
    } else {
      logger.info('⚠️ Summary not saved to cache (outside 12-month retention period)');
    }

    return NextResponse.json({
      success: true,
      summary: aiSummary
    });

  } catch (error) {
    console.error('Error generating executive summary:', error);
    return NextResponse.json({ 
      error: 'Failed to generate executive summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Import the centralized AI summary generator
import { generateAISummary } from '../../../lib/ai-summary-generator'; 