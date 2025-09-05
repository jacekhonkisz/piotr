import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const { clientId } = await request.json();
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // Check database for August 2024 data
    const { data: august2024Data, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'meta')
      .gte('summary_date', '2024-08-01')
      .lte('summary_date', '2024-08-31')
      .order('summary_date', { ascending: true });

    if (error) {
      logger.error('Error fetching August 2024 data:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Also check what the live API returns for August 2024
    const authHeader = request.headers.get('authorization');
    let liveApiData = null;
    
    if (authHeader) {
      try {
        const liveResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            clientId,
            dateRange: {
              start: '2024-08-01',
              end: '2024-08-31'
            },
            platform: 'meta',
            forceFresh: true // Force fresh API call
          })
        });
        
        if (liveResponse.ok) {
          const liveResult = await liveResponse.json();
          if (liveResult.success) {
            liveApiData = liveResult.data;
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch live API data for August 2024:', error);
      }
    }

    return NextResponse.json({
      success: true,
      august2024Debug: {
        databaseRecords: august2024Data?.length || 0,
        databaseData: august2024Data?.map(record => ({
          date: record.summary_date,
          reservationValue: record.reservation_value,
          totalSpend: record.total_spend,
          summaryType: record.summary_type,
          platform: record.platform
        })),
        totalReservationValueFromDB: august2024Data?.reduce((sum, record) => sum + (record.reservation_value || 0), 0) || 0,
        liveApiData: liveApiData ? {
          reservationValue: liveApiData.conversionMetrics?.reservation_value || 0,
          totalSpend: liveApiData.stats?.totalSpend || 0,
          source: 'live-api'
        } : null,
        note: 'This shows what data exists for August 2024 in database vs live API'
      }
    });

  } catch (error) {
    logger.error('Error in August 2024 debug endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
