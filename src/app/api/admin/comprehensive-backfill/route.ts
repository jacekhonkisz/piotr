import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';

/**
 * COMPREHENSIVE SYSTEM-WIDE BACKFILL
 * 
 * This endpoint backfills ALL historical data for ALL clients
 * with complete conversion tracking including reach and booking_step_3
 */

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 Starting comprehensive system-wide backfill...');
    
    const body = await request.json().catch(() => ({}));
    const { 
      months = 12,           // How many months back to collect
      startFromCurrent = true, // Start from current month and go backwards
      dryRun = false         // If true, only simulate without actual collection
    } = body;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get all active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, api_status')
      .eq('api_status', 'valid');

    if (clientError || !clients || clients.length === 0) {
      return NextResponse.json({ 
        error: 'No active clients found',
        details: clientError?.message 
      }, { status: 400 });
    }

    logger.info(`👥 Found ${clients.length} active clients for backfill`);

    // Calculate date ranges for the past N months
    const dateRanges = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      // Don't go beyond today for the current month
      if (i === 0) {
        endDate.setTime(Math.min(endDate.getTime(), now.getTime()));
      }
      
      dateRanges.push({
        month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      });
    }

    logger.info(`📅 Backfill scope: ${dateRanges.length} months, ${dateRanges.reduce((sum, r) => sum + r.days, 0)} total days`);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        scope: {
          clients: clients.length,
          months: dateRanges.length,
          totalDays: dateRanges.reduce((sum, r) => sum + r.days, 0),
          estimatedRecords: clients.length * dateRanges.reduce((sum, r) => sum + r.days, 0)
        },
        dateRanges,
        message: 'Dry run completed - no data collected'
      });
    }

    // Execute backfill for each month
    const results = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const range of dateRanges) {
      logger.info(`📊 Processing ${range.month} (${range.days} days)...`);
      
      try {
        // Call the existing backfill endpoint for this range
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || '') 
          : 'http://localhost:3000';
        const backfillResponse = await fetch(`${baseUrl}/api/admin/backfill-daily-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            days: range.days,
            endDate: range.endDate // Backfill from this end date backwards
          })
        });

        if (backfillResponse.ok) {
          const backfillResult = await backfillResponse.json();
          results.push({
            month: range.month,
            success: true,
            daysProcessed: backfillResult.daysProcessed || range.days,
            records: backfillResult.completenessReport?.totalRecords || 0
          });
          totalProcessed += backfillResult.daysProcessed || range.days;
        } else {
          throw new Error(`Backfill failed with status ${backfillResponse.status}`);
        }
        
      } catch (error) {
        logger.error(`❌ Failed to process ${range.month}:`, error);
        results.push({
          month: range.month,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        totalErrors++;
      }

      // Add delay between months to avoid overwhelming the system
      if (dateRanges.indexOf(range) < dateRanges.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    // Final validation
    const { count: finalRecordCount } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*', { count: 'exact', head: true });

    logger.info(`🎉 Comprehensive backfill completed: ${totalProcessed} days processed, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        clientsProcessed: clients.length,
        monthsProcessed: dateRanges.length,
        totalDaysProcessed: totalProcessed,
        totalErrors,
        finalRecordCount
      },
      results,
      message: `Comprehensive backfill completed for ${clients.length} clients across ${dateRanges.length} months`
    });

  } catch (error) {
    logger.error('❌ Comprehensive backfill failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  // Return backfill status/info
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get current data status
    const { count: totalRecords } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*', { count: 'exact', head: true });

    const { data: dateRange } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('api_status', 'valid');

    return NextResponse.json({
      status: 'ready',
      currentData: {
        totalRecords,
        dateRange: {
          earliest: dateRange?.[0]?.date,
          latest: latestDate?.[0]?.date
        },
        activeClients: clients?.length || 0
      },
      availableOptions: {
        months: [1, 3, 6, 12, 24],
        dryRun: true
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
