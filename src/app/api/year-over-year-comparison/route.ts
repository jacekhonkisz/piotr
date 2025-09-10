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
  console.log('🔄 REAL DATA COMPARISON API');
  
  try {
    const body = await request.json();
    const { clientId, dateRange, platform = 'meta' } = body;

    if (!clientId || !dateRange?.start || !dateRange?.end) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    
    console.log(`🔄 Fetching REAL ${platform} data for comparison:`, { clientId: clientId.substring(0,8), dateRange, platform });
    
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
    
    try {
      if (platform === 'google') {
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
        console.log('🔄 Fetching REAL Meta data...');
      const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
      
        // Get current period data
        const currentResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
          reason: 'comparison-current-meta',
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
        
        console.log('✅ Real Meta current data:', currentData);
      }
    } catch (error) {
      console.error('❌ Error fetching current data:', error);
    }
    
    // Fetch previous year data from database (historical data)
    try {
      const prevMonth = `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 1).padStart(2, '0')}-01`;
      const prevMonthEnd = `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 1).padStart(2, '0')}-30`;
      
      console.log('🔄 Fetching previous year from database:', { prevMonth, prevMonthEnd, platform });
      
      const tableName = platform === 'google' ? 'google_ads_campaign_summaries' : 'campaign_summaries';
      
      console.log('🔍 Database query details:', {
        tableName,
        clientId: clientId.substring(0,8),
        dateColumn: platform === 'google' ? 'period_start' : 'summary_date',
        searchDates: [prevMonth, prevMonthEnd],
        typeColumn: platform === 'google' ? 'period_type' : 'summary_type'
      });

      // Fetch weekly data for better funnel metrics (Meta has funnel data in weekly summaries)
      const { data: weeklyData, error: weeklyError } = await supabase
        .from(tableName)
        .select(platform === 'google' 
          ? 'total_spend, total_impressions, total_clicks, total_booking_step_1, total_booking_step_2, total_booking_step_3, total_reservations, period_start'
          : 'total_spend, total_impressions, total_clicks, booking_step_1, booking_step_2, booking_step_3, reservations, summary_date'
        )
        .eq('client_id', clientId)
        .eq(platform === 'google' ? 'period_type' : 'summary_type', 'weekly')
        .gte(platform === 'google' ? 'period_start' : 'summary_date', `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 1).padStart(2, '0')}-01`)
        .lt(platform === 'google' ? 'period_start' : 'summary_date', `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 2).padStart(2, '0')}-01`);

      // Also try monthly as fallback - include campaign_data for Meta
      const { data: monthlyData, error: monthlyError } = await supabase
        .from(tableName)
        .select(platform === 'google' 
          ? 'total_spend, total_impressions, total_clicks, total_booking_step_1, total_booking_step_2, total_booking_step_3, total_reservations, period_start'
          : 'total_spend, total_impressions, total_clicks, booking_step_1, booking_step_2, booking_step_3, reservations, summary_date, campaign_data'
        )
        .eq('client_id', clientId)
        .eq(platform === 'google' ? 'period_type' : 'summary_type', 'monthly')
        .gte(platform === 'google' ? 'period_start' : 'summary_date', `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 1).padStart(2, '0')}-01`)
        .lt(platform === 'google' ? 'period_start' : 'summary_date', `${prevYearStart.getFullYear()}-${String(prevYearStart.getMonth() + 2).padStart(2, '0')}-01`)
        .limit(1)
        .single() as { 
          data: any; 
          error: any; 
        };

      // Prioritize monthly data for funnel metrics (has campaign_data), use weekly as fallback
      let prevData = null;
      let dbError = null;

      if (monthlyData) {
        // Use monthly data first (has campaign_data with correct funnel metrics)
        prevData = monthlyData;
        dbError = monthlyError;
        console.log('✅ Using monthly data (has campaign_data with correct funnel metrics):', prevData);
      } else if (weeklyData && weeklyData.length > 0) {
        // Fallback to aggregated weekly data
        prevData = {
          total_spend: weeklyData.reduce((sum: number, week: any) => sum + (parseFloat(week.total_spend) || 0), 0),
          total_impressions: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_impressions) || 0), 0),
          total_clicks: weeklyData.reduce((sum: number, week: any) => sum + (parseInt(week.total_clicks) || 0), 0),
          // Use platform-specific column names for funnel data
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
        console.log('📊 Fallback to aggregated weekly data:', prevData);
        console.log(`📊 Found ${weeklyData.length} weekly summaries for aggregation`);
      } else {
        dbError = weeklyError || monthlyError;
        console.log('❌ No weekly or monthly data found');
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

        // Check if campaign_data exists and has the real funnel data
        if ((prevData as any).campaign_data && Array.isArray((prevData as any).campaign_data)) {
          const campaigns = (prevData as any).campaign_data;
          funnelData = {
            booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
            reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0)
          };
          console.log('✅ Using campaign_data for funnel metrics:', funnelData);
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
          console.log('📊 Using direct columns for funnel metrics:', funnelData);
        }

        previousData = {
          spend: parseFloat(prevData.total_spend || '0') || 0,
          impressions: parseInt(prevData.total_impressions || '0') || 0,
          clicks: parseInt(prevData.total_clicks || '0') || 0,
          ...funnelData
        };
      }
      
      console.log('✅ Real previous year data:', previousData);
      
    } catch (error) {
      console.error('❌ Error fetching previous year data:', error);
    }
    
    // Calculate changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    const current = currentData || { spend: 0, impressions: 0, clicks: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 };
    const previous = previousData || { spend: 0, impressions: 0, clicks: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 };

    const result: YearOverYearData = {
      current,
      previous,
      changes: {
        spend: Math.round(calculateChange(current.spend, previous.spend) * 10) / 10,
        impressions: Math.round(calculateChange(current.impressions, previous.impressions) * 10) / 10,
        clicks: Math.round(calculateChange(current.clicks, previous.clicks) * 10) / 10,
        booking_step_1: Math.round(calculateChange(current.booking_step_1, previous.booking_step_1) * 10) / 10,
        booking_step_2: Math.round(calculateChange(current.booking_step_2, previous.booking_step_2) * 10) / 10,
        booking_step_3: Math.round(calculateChange(current.booking_step_3, previous.booking_step_3) * 10) / 10,
        reservations: Math.round(calculateChange(current.reservations, previous.reservations) * 10) / 10
      }
    };
    
    console.log('✅ FINAL COMPARISON RESULT:', {
      platform,
      currentSpend: current.spend,
      previousSpend: previous.spend,
      hasHistoricalData: previous.spend > 0,
      clientId: clientId.substring(0,8)
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