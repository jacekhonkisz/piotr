import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YearOverYearData {
  current: {
    spend: number;
    impressions: number;
    clicks: number;
    booking_step_1?: number;
    booking_step_2?: number;
    booking_step_3?: number;
    reservations?: number;
  };
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    booking_step_1?: number;
    booking_step_2?: number;
    booking_step_3?: number;
    reservations?: number;
  };
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    booking_step_1?: number;
    booking_step_2?: number;
    booking_step_3?: number;
    reservations?: number;
  };
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`🔄 REAL DATA COMPARISON API [${requestId}] - START`);
  
  try {
    const body = await request.json();
    console.log(`🔄 [${requestId}] Request body:`, {
      hasClientId: !!body.clientId,
      clientIdLength: body.clientId?.length || 0,
      hasDateRange: !!body.dateRange,
      dateRange: body.dateRange,
      platform: body.platform
    });
    
    const { clientId, dateRange, platform = 'meta' } = body;

    if (!clientId || !dateRange?.start || !dateRange?.end) {
      console.error(`❌ [${requestId}] Missing parameters:`, {
        hasClientId: !!clientId,
        hasDateRange: !!dateRange,
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end
      });
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    
    console.log(`🔄 [${requestId}] Fetching REAL ${platform} data for comparison:`, { clientId: clientId.substring(0,8), dateRange, platform });
    
    // Calculate previous year date range
      const currentStart = new Date(dateRange.start);
      const currentEnd = new Date(dateRange.end);
      
      const prevYearStart = new Date(currentStart);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
      
      const prevYearEnd = new Date(currentEnd);
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);
      
    const prevDateRange = {
      start: prevYearStart.toISOString().split('T')[0],
      end: prevYearEnd.toISOString().split('T')[0]
    };
    
    console.log('🔄 Year-over-year periods:', {
        current: dateRange,
        previous: prevDateRange,
      platform
      });
    
    // Fetch REAL current data using the same system as reports
    let currentData = null;
    let previousData = null;
    
    console.log(`🔄 [${requestId}] Starting data fetching process...`);
    
    try {
      if (platform === 'google') {
        console.log(`🔄 [${requestId}] Platform: Google Ads`);
        console.log('🔄 Fetching REAL Google Ads data...');
        const { GoogleAdsStandardizedDataFetcher } = await import('../../../lib/google-ads-standardized-data-fetcher');
        
        // Get current period data
        const currentResult = await GoogleAdsStandardizedDataFetcher.fetchData({
      clientId,
          dateRange,
          reason: 'comparison-current-google',
          sessionToken: undefined
        });
        
        if (currentResult?.success && currentResult.data?.stats) {
          const stats = currentResult.data.stats as any;
          const campaigns = currentResult.data.campaigns as any[] || [];
          
          // Use same aggregation logic as main reports (campaign-level data)
          currentData = {
            spend: stats.totalSpend || 0,
            impressions: stats.totalImpressions || 0,
            clicks: stats.totalClicks || 0,
            booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
            reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0)
          };
        }
        
        console.log('✅ Real Google current data:', currentData);
        
      } else {
        console.log(`🔄 [${requestId}] Platform: Meta`);
        console.log('🔄 Fetching REAL Meta data...');
        const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
        
        console.log(`🔄 [${requestId}] Calling StandardizedDataFetcher for current data...`);
        // Get current period data
        const currentResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
          reason: 'comparison-current-meta',
          sessionToken: undefined
        });
        
        console.log(`🔄 [${requestId}] StandardizedDataFetcher result:`, {
          success: currentResult?.success,
          hasData: !!currentResult?.data,
          hasStats: !!currentResult?.data?.stats,
          hasCampaigns: !!currentResult?.data?.campaigns,
          campaignsLength: currentResult?.data?.campaigns?.length || 0
        });
        
        if (currentResult?.success && currentResult.data?.stats) {
          const stats = currentResult.data.stats as any;
          const campaigns = currentResult.data.campaigns as any[] || [];
          
          // Use same aggregation logic as main reports (campaign-level data)
          currentData = {
            spend: stats.totalSpend || 0,
            impressions: stats.totalImpressions || 0,
            clicks: stats.totalClicks || 0,
            booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
            reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0)
          };
        }
        
        console.log('✅ Real Meta current data:', currentData);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error fetching current data:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        platform,
        clientId: clientId?.substring(0,8),
        dateRange
      });
    }
    
    // Fetch previous year data from database (historical data)
    try {
      const tableName = platform === 'google' ? 'google_ads_campaign_summaries' : 'campaign_summaries';
      const dateColumn = platform === 'google' ? 'period_start' : 'summary_date';
      const typeColumn = platform === 'google' ? 'period_type' : 'summary_type';
      
      // 🔧 FIX: Determine if this is a weekly or monthly comparison based on date range duration
      const currentStartDate = new Date(dateRange.start);
      const currentEndDate = new Date(dateRange.end);
      const daysDifference = Math.ceil((currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Determine comparison type: weekly (≤ 7 days) or monthly (> 7 days)
      const isWeeklyComparison = daysDifference <= 7;
      const comparisonType = isWeeklyComparison ? 'weekly' : 'monthly';
      
      console.log(`🔍 [${requestId}] Comparison type analysis:`, {
        currentDateRange: dateRange,
        previousDateRange: { start: prevYearStart.toISOString().split('T')[0], end: prevYearEnd.toISOString().split('T')[0] },
        daysDifference,
        comparisonType,
        platform,
        clientId: clientId.substring(0,8)
      });
      
      let prevData = null;
      let dbError = null;
      
      if (isWeeklyComparison) {
        // 🔧 WEEKLY COMPARISON: Use live fetch for historical data (stored weekly data is unreliable)
        console.log(`🔄 [${requestId}] Fetching WEEKLY comparison data via live fetch (stored data unreliable)...`);
        
        try {
          // Try to live fetch historical data first
          const historicalResult = platform === 'google' 
            ? await (await import('../../../lib/google-ads-standardized-data-fetcher')).GoogleAdsStandardizedDataFetcher.fetchData({
                clientId,
                dateRange: {
                  start: prevDateRange.start!,
                  end: prevDateRange.end!
                },
                reason: 'comparison-historical-google',
                sessionToken: undefined
              })
            : await (await import('../../../lib/standardized-data-fetcher')).StandardizedDataFetcher.fetchData({
                clientId,
                dateRange: {
                  start: prevDateRange.start!,
                  end: prevDateRange.end!
                },
                platform: 'meta',
                reason: 'comparison-historical-meta',
                sessionToken: undefined
              });

          if (historicalResult?.success && historicalResult.data?.stats) {
            const stats = historicalResult.data.stats as any;
            const campaigns = historicalResult.data.campaigns as any[] || [];
            
            previousData = {
              spend: stats.totalSpend || 0,
              impressions: stats.totalImpressions || 0,
              clicks: stats.totalClicks || 0,
              // Note: Funnel data from live fetch of historical data
              booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
              booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
              booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
              reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0)
            };
            
            console.log(`✅ [${requestId}] Live fetch historical data successful:`, {
              period: prevDateRange,
              spend: previousData.spend,
              funnel: `${previousData.booking_step_1}→${previousData.booking_step_2}→${previousData.booking_step_3}→${previousData.reservations}`
            });
          } else {
            console.log(`⚠️ [${requestId}] Live fetch historical failed, falling back to stored data`);
            throw new Error('Live fetch failed, will try stored data');
          }
        } catch (liveError) {
          console.log(`⚠️ [${requestId}] Live fetch error: ${liveError instanceof Error ? liveError.message : 'Unknown error'}, trying stored data...`);
          
          // Fallback to stored data query
          console.log(`🔄 [${requestId}] Falling back to stored weekly data...`);
        
          // For weekly comparisons, look for data that matches the exact week period
          const { data: weeklyData, error: weeklyError } = await supabase
          .from(tableName)
          .select(platform === 'google' 
            ? 'total_spend, total_impressions, total_clicks, total_booking_step_1, total_booking_step_2, total_booking_step_3, total_reservations, period_start, period_end'
            : 'total_spend, total_impressions, total_clicks, booking_step_1, booking_step_2, booking_step_3, reservations, summary_date, campaign_data'
          )
          .eq('client_id', clientId)
          .eq(typeColumn, 'weekly')
          .gte(dateColumn, prevYearStart.toISOString().split('T')[0])
          .lte(dateColumn, prevYearEnd.toISOString().split('T')[0]) as { data: any[] | null; error: any; };

        console.log(`🔍 [${requestId}] Weekly database query:`, {
          tableName,
          clientId: clientId.substring(0,8),
          dateColumn,
          searchRange: [prevYearStart.toISOString().split('T')[0], prevYearEnd.toISOString().split('T')[0]],
          foundRecords: weeklyData?.length || 0,
          actualRecords: weeklyData?.map(r => ({ 
            date: (r as any).summary_date || (r as any).period_start, 
            spend: (r as any).total_spend 
          }))
        });

        if (weeklyData && weeklyData.length > 0) {
          // Filter out weeks with obviously placeholder/default funnel data
          const validWeeks = weeklyData.filter(week => {
            const spend = parseFloat((week as any).total_spend || '0');
            const step1 = parseInt((week as any).booking_step_1 || '0');
            const step2 = parseInt((week as any).booking_step_2 || '0');
            const step3 = parseInt((week as any).booking_step_3 || '0');
            const reservations = parseInt((week as any).reservations || '0');
            
            // Check for placeholder data patterns:
            // 1. All funnel steps are the same small number (like 2,2,2,2)
            // 2. High spend but very low funnel numbers (indicates data quality issues)
            const allSameSmallNumbers = (step1 === step2 && step2 === step3 && step1 <= 5);
            const highSpendLowFunnel = (spend > 1000 && step1 <= 5);
            const isPlaceholderData = allSameSmallNumbers || highSpendLowFunnel;
            
            console.log(`🔍 [${requestId}] Week ${(week as any).summary_date || (week as any).period_start} validation:`, {
              spend,
              funnel: `${step1}→${step2}→${step3}→${reservations}`,
              allSameSmallNumbers,
              highSpendLowFunnel,
              isPlaceholderData: isPlaceholderData ? 'YES (FILTERED OUT)' : 'NO (VALID)'
            });
            
            return !isPlaceholderData;
          });
          
          console.log(`🔍 [${requestId}] Filtered weeks: ${weeklyData.length} total → ${validWeeks.length} valid`);
          
          if (validWeeks.length === 0) {
            console.log(`⚠️ [${requestId}] No valid weekly data found (all weeks appear to have placeholder data)`);
            prevData = null;
            dbError = { message: 'No valid historical weekly data available' };
          } else {
            // Find the best matching week from valid weeks
            let bestMatch = validWeeks[0];
            let bestMatchScore = Infinity;
            
            for (const week of validWeeks) {
              let weekStart: Date;
              let matchScore: number;
              
              if (platform === 'google') {
                // Google Ads has period_start and period_end
                weekStart = new Date((week as any).period_start);
                const weekEnd = new Date((week as any).period_end);
                const startDiff = Math.abs(weekStart.getTime() - prevYearStart.getTime());
                const endDiff = Math.abs(weekEnd.getTime() - prevYearEnd.getTime());
                matchScore = startDiff + endDiff;
              } else {
                // Meta only has summary_date (start of the week)
                weekStart = new Date((week as any).summary_date);
                const startDiff = Math.abs(weekStart.getTime() - prevYearStart.getTime());
                matchScore = startDiff;
              }
              
              if (matchScore < bestMatchScore) {
                bestMatch = week;
                bestMatchScore = matchScore;
              }
            }
          
            prevData = bestMatch;
            dbError = weeklyError;
            console.log(`✅ [${requestId}] Found weekly match:`, {
              matchedWeek: platform === 'google' 
                ? `${(bestMatch as any).period_start} to ${(bestMatch as any).period_end}`
                : `Week starting ${(bestMatch as any).summary_date}`,
              totalSpend: (bestMatch as any).total_spend,
              matchScore: bestMatchScore,
              funnelData: `${(bestMatch as any).booking_step_1}→${(bestMatch as any).booking_step_2}→${(bestMatch as any).booking_step_3}→${(bestMatch as any).reservations}`
            });
          }
        } else {
          dbError = weeklyError;
          console.log(`❌ [${requestId}] No weekly data found for comparison period`);
        }
        
        } // End of catch block for live fetch fallback
        
      } else {
        // 🔧 MONTHLY COMPARISON: Use month-based logic (existing behavior)
        console.log('🔄 Fetching MONTHLY comparison data from database...');
        
        const prevMonth = `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 1).padStart(2, '0')}-01`;
        const prevMonthEnd = `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 2).padStart(2, '0')}-01`;
        
        console.log('🔍 Monthly database query:', {
          tableName,
          clientId: clientId.substring(0,8),
          dateColumn,
          searchRange: [prevMonth, prevMonthEnd]
        });

        // Try monthly data first
        const { data: monthlyData, error: monthlyError } = await supabase
          .from(tableName)
          .select(platform === 'google' 
            ? 'total_spend, total_impressions, total_clicks, total_booking_step_1, total_booking_step_2, total_booking_step_3, total_reservations, period_start'
            : 'total_spend, total_impressions, total_clicks, booking_step_1, booking_step_2, booking_step_3, reservations, summary_date, campaign_data'
          )
          .eq('client_id', clientId)
          .eq(typeColumn, 'monthly')
          .gte(dateColumn, prevMonth)
          .lt(dateColumn, prevMonthEnd)
          .limit(1)
          .single() as { data: any; error: any; };

        if (monthlyData) {
          prevData = monthlyData;
          dbError = monthlyError;
          console.log('✅ Found monthly data:', { totalSpend: monthlyData.total_spend });
        } else {
          // Fallback to aggregated weekly data for the month
          const { data: weeklyData, error: weeklyError } = await supabase
            .from(tableName)
            .select(platform === 'google' 
              ? 'total_spend, total_impressions, total_clicks, total_booking_step_1, total_booking_step_2, total_booking_step_3, total_reservations, period_start'
              : 'total_spend, total_impressions, total_clicks, booking_step_1, booking_step_2, booking_step_3, reservations, summary_date'
            )
            .eq('client_id', clientId)
            .eq(typeColumn, 'weekly')
            .gte(dateColumn, prevMonth)
            .lt(dateColumn, prevMonthEnd) as { data: any[] | null; error: any; };

          if (weeklyData && weeklyData.length > 0) {
            // Aggregate weekly data into monthly totals
            prevData = {
              total_spend: weeklyData.reduce((sum: number, week: any) => sum + (parseFloat(week.total_spend) || 0), 0),
              total_impressions: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_impressions) || 0), 0),
              total_clicks: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_clicks) || 0), 0),
              ...(platform === 'google' ? {
                total_booking_step_1: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_booking_step_1) || 0), 0),
                total_booking_step_2: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_booking_step_2) || 0), 0),
                total_booking_step_3: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_booking_step_3) || 0), 0),
                total_reservations: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_reservations) || 0), 0)
              } : {
                booking_step_1: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.booking_step_1) || 0), 0),
                booking_step_2: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.booking_step_2) || 0), 0),
                booking_step_3: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.booking_step_3) || 0), 0),
                reservations: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.reservations) || 0), 0)
              })
            };
            dbError = weeklyError;
            console.log('📊 Aggregated weekly data into monthly totals:', { 
              weekCount: weeklyData.length, 
              totalSpend: prevData.total_spend 
            });
          } else {
            dbError = monthlyError || weeklyError;
            console.log('❌ No monthly or weekly data found');
          }
        }
      }
      
      console.log('🔍 Database query result:', { prevData, dbError });
      
      // If no data found, check what historical data exists for this client
      if (!prevData) {
        console.log('🔍 No previous year data found, checking available historical data...');
        const { data: availableData } = await supabase
          .from(tableName)
          .select((platform === 'google' ? 'period_start' : 'summary_date') + ', total_spend')
          .eq('client_id', clientId)
          .eq(platform === 'google' ? 'period_type' : 'summary_type', 'monthly')
          .order(platform === 'google' ? 'period_start' : 'summary_date', { ascending: false })
          .limit(10) as { data: any[] | null };
        
        console.log('🔍 Available historical data for client:', availableData);
      }
      
      if (prevData) {
        // Use same logic as main reports API - aggregate from campaign_data if available
        let funnelData = {
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          reservations: 0
        };

        console.log(`🔍 [${requestId}] Extracting funnel data from prevData:`, {
          hasCampaignData: !!(prevData as any).campaign_data,
          campaignDataType: typeof (prevData as any).campaign_data,
          campaignDataLength: Array.isArray((prevData as any).campaign_data) ? (prevData as any).campaign_data.length : 'not array',
          directColumns: {
            booking_step_1: (prevData as any).booking_step_1,
            booking_step_2: (prevData as any).booking_step_2,
            booking_step_3: (prevData as any).booking_step_3,
            reservations: (prevData as any).reservations,
            total_booking_step_1: (prevData as any).total_booking_step_1,
            total_booking_step_2: (prevData as any).total_booking_step_2,
            total_booking_step_3: (prevData as any).total_booking_step_3,
            total_reservations: (prevData as any).total_reservations
          }
        });

        // Check if campaign_data exists and has meaningful funnel data
        if ((prevData as any).campaign_data && Array.isArray((prevData as any).campaign_data)) {
          const campaigns = (prevData as any).campaign_data;
          const campaignFunnelData = {
            booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
            reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0)
          };
          
          // Check if campaign_data has meaningful funnel data (not all zeros)
          const hasMeaningfulCampaignData = (
            campaignFunnelData.booking_step_1 > 0 ||
            campaignFunnelData.booking_step_2 > 0 ||
            campaignFunnelData.booking_step_3 > 0 ||
            campaignFunnelData.reservations > 0
          );
          
          if (hasMeaningfulCampaignData) {
            funnelData = campaignFunnelData;
            console.log(`✅ [${requestId}] Using campaign_data for funnel metrics:`, funnelData);
          } else {
            // Campaign data exists but has no meaningful funnel data, fall back to direct columns
            console.log(`⚠️ [${requestId}] Campaign data exists but has no funnel data, falling back to direct columns`);
            funnelData = {
              booking_step_1: parseInt(
                platform === 'google' 
                  ? (prevData as any).total_booking_step_1 || '0'
                  : (prevData as any).booking_step_1 || '0'
              ) || 0,
              booking_step_2: parseInt(
                platform === 'google' 
                  ? (prevData as any).total_booking_step_2 || '0'
                  : (prevData as any).booking_step_2 || '0'
              ) || 0,
              booking_step_3: parseInt(
                platform === 'google' 
                  ? (prevData as any).total_booking_step_3 || '0'
                  : (prevData as any).booking_step_3 || '0'
              ) || 0,
              reservations: parseInt(
                platform === 'google' 
                  ? (prevData as any).total_reservations || '0'
                  : (prevData as any).reservations || '0'
              ) || 0
            };
            console.log(`📊 [${requestId}] Using direct columns for funnel metrics:`, funnelData);
          }
      } else {
          // Fallback to direct columns (platform-specific)
          funnelData = {
            booking_step_1: parseInt(
              platform === 'google' 
                ? (prevData as any).total_booking_step_1 || '0'
                : (prevData as any).booking_step_1 || '0'
            ) || 0,
            booking_step_2: parseInt(
              platform === 'google' 
                ? (prevData as any).total_booking_step_2 || '0'
                : (prevData as any).booking_step_2 || '0'
            ) || 0,
            booking_step_3: parseInt(
              platform === 'google' 
                ? (prevData as any).total_booking_step_3 || '0'
                : (prevData as any).booking_step_3 || '0'
            ) || 0,
            reservations: parseInt(
              platform === 'google' 
                ? (prevData as any).total_reservations || '0'
                : (prevData as any).reservations || '0'
            ) || 0
          };
          console.log(`📊 [${requestId}] Using direct columns for funnel metrics:`, funnelData);
        }

        // Check if funnel data appears to be placeholder/unreliable for weekly comparisons
        const isWeeklyWithPoorFunnelData = isWeeklyComparison && (
          funnelData.booking_step_1 <= 5 && 
          funnelData.booking_step_2 <= 5 && 
          funnelData.booking_step_3 <= 5 &&
          parseFloat(prevData.total_spend || '0') > 1000 // High spend but low funnel = data quality issue
        );
        
        if (isWeeklyWithPoorFunnelData) {
          console.log(`⚠️ [${requestId}] Weekly funnel data appears unreliable, excluding from comparison`);
          previousData = {
            spend: parseFloat(prevData.total_spend || '0') || 0,
            impressions: parseInt(prevData.total_impressions || '0') || 0,
            clicks: parseInt(prevData.total_clicks || '0') || 0,
            // Set funnel data to 0 to indicate unavailable/unreliable
            booking_step_1: 0,
            booking_step_2: 0,
            booking_step_3: 0,
            reservations: 0
          };
        } else {
        previousData = {
          spend: parseFloat(prevData.total_spend || '0') || 0,
          impressions: parseInt(prevData.total_impressions || '0') || 0,
          clicks: parseInt(prevData.total_clicks || '0') || 0,
          ...funnelData
        };
        }
      }
      
      console.log('✅ Real previous year data:', previousData);
      
    } catch (error) {
      console.error('❌ Error fetching previous year data:', error);
    }
    
    // Calculate changes
    const calculateChange = (current: number, previous: number, metricName?: string): number => {
      if (previous === 0) {
        // For funnel metrics, if historical data is 0, it's likely unreliable
        if (metricName && ['booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations'].includes(metricName)) {
          // Return special value to indicate "no reliable historical data"
          return -999; // Frontend will display this as "N/A" or "No historical data"
        }
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };
    
    const current = currentData || { spend: 0, impressions: 0, clicks: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 };
    const previous = previousData || { spend: 0, impressions: 0, clicks: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 };

    const result: YearOverYearData = {
      current,
      previous,
      changes: {
        spend: Math.round(calculateChange(current.spend, previous.spend, 'spend') * 10) / 10,
        impressions: Math.round(calculateChange(current.impressions, previous.impressions, 'impressions') * 10) / 10,
        clicks: Math.round(calculateChange(current.clicks, previous.clicks, 'clicks') * 10) / 10,
        booking_step_1: calculateChange(current.booking_step_1, previous.booking_step_1, 'booking_step_1') === -999 ? -999 : Math.round(calculateChange(current.booking_step_1, previous.booking_step_1, 'booking_step_1') * 10) / 10,
        booking_step_2: calculateChange(current.booking_step_2, previous.booking_step_2, 'booking_step_2') === -999 ? -999 : Math.round(calculateChange(current.booking_step_2, previous.booking_step_2, 'booking_step_2') * 10) / 10,
        booking_step_3: calculateChange(current.booking_step_3, previous.booking_step_3, 'booking_step_3') === -999 ? -999 : Math.round(calculateChange(current.booking_step_3, previous.booking_step_3, 'booking_step_3') * 10) / 10,
        reservations: calculateChange(current.reservations, previous.reservations, 'reservations') === -999 ? -999 : Math.round(calculateChange(current.reservations, previous.reservations, 'reservations') * 10) / 10
      }
    };
    
    console.log('✅ FINAL COMPARISON RESULT:', {
      platform,
      currentSpend: current.spend,
      previousSpend: previous.spend,
      hasHistoricalData: previous.spend > 0,
      clientId: clientId.substring(0,8)
    });
    
    console.log(`✅ [${requestId}] FINAL COMPARISON RESULT:`, {
      platform,
      currentSpend: current.spend,
      previousSpend: previous.spend,
      hasHistoricalData: previous.spend > 0,
      clientId: clientId.substring(0,8),
      resultKeys: Object.keys(result),
      changesKeys: Object.keys(result.changes)
    });
    
    console.log('✅ REAL DATA RESULT:', result);
    
    const response = NextResponse.json(result);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;

  } catch (error) {
    console.error('❌ Real data API Error:', error);
    return NextResponse.json({ 
      error: 'Internal error',
      current: { spend: 0, impressions: 0, clicks: 0 },
      previous: { spend: 0, impressions: 0, clicks: 0 },
      changes: { spend: 0, impressions: 0, clicks: 0 }
    }, { status: 500 });
  }
}