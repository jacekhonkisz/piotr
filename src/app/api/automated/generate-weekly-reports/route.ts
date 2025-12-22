import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReportForPeriod } from '../../../../lib/automated-report-generator';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Automated Weekly Report Generation
 * 
 * Triggered by cron job every Monday at 3 AM
 * Generates reports for the previous completed week (Monday to Sunday) for all active clients
 * Security: Protected with CRON_SECRET authentication
 */
export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  const startTime = Date.now();
  
  try {
    logger.info('📅 Starting automated weekly report generation');
    
    // Calculate previous week period (Monday to Sunday)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToLastMonday = currentDayOfWeek === 0 ? 7 : currentDayOfWeek; // If Sunday, go back 7 days
    
    // Get last Monday (start of previous week)
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday - 7); // Go back to previous week's Monday
    lastMonday.setHours(0, 0, 0, 0);
    
    // Get last Sunday (end of previous week)
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);
    
    const periodStart = lastMonday.toISOString().split('T')[0];
    const periodEnd = lastSunday.toISOString().split('T')[0];
    
    logger.info('📅 Generating weekly reports for period:', { periodStart, periodEnd });
    
    // Get all active clients with Meta Ads or Google Ads configured for weekly reports
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, google_ads_enabled, reporting_frequency')
      .or('meta_access_token.not.is.null,google_ads_enabled.eq.true')
      .eq('reporting_frequency', 'weekly');
    
    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('ℹ️ No clients configured for weekly reports');
      return NextResponse.json({
        success: true,
        message: 'No clients configured for weekly reports',
        generated: 0
      });
    }
    
    logger.info(`📊 Found ${clients.length} clients configured for weekly reports`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Generate reports for each client
    for (const client of clients) {
      try {
        logger.info(`📄 Generating weekly report for client: ${client.name} (${client.email})`);
        
        // Check if report already exists in reports table (legacy system)
        const { data: existingReport } = await supabase
          .from('reports')
          .select('id')
          .eq('client_id', client.id)
          .eq('date_range_start', periodStart)
          .eq('date_range_end', periodEnd)
          .maybeSingle();
        
        if (existingReport) {
          logger.info(`⏭️ Weekly report already exists for ${client.name}, skipping`);
          continue;
        }
        
        // Generate the report using existing API endpoint
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || '') 
          : 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/generate-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ✅ FIX: Use CRON_SECRET for internal cron calls
            'Authorization': `Bearer ${process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: periodStart,
              end: periodEnd
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Report generation API failed: ${response.status} ${response.statusText}`);
        }
        
        const generatedReport = await response.json();
        
        logger.info(`✅ Successfully generated weekly report for ${client.name}`, {
          reportId: generatedReport.report?.id,
          success: generatedReport.success
        });
        
        results.successful++;
        
      } catch (error) {
        const errorMessage = `Failed to generate weekly report for ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error('❌ Weekly report generation failed', { 
          clientId: client.id, 
          clientName: client.name,
          error: errorMessage 
        });
        
        results.failed++;
        results.errors.push(errorMessage);
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('🎯 Weekly report generation completed', {
      totalClients: clients.length,
      successful: results.successful,
      failed: results.failed,
      responseTime
    });
    
    // Return success even if some reports failed (partial success)
    return NextResponse.json({
      success: true,
      message: `Weekly report generation completed`,
      period: { start: periodStart, end: periodEnd },
      results: {
        totalClients: clients.length,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      },
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('❌ Automated weekly report generation failed', { 
      error: errorMessage,
      responseTime 
    });
    
    return NextResponse.json({
      success: false,
      error: 'Automated weekly report generation failed',
      details: errorMessage,
      responseTime
    }, { status: 500 });
  }
}

/**
 * Manual trigger for weekly report generation (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { weekStart, weekEnd } = body;
    
    // If specific week provided, validate and use that
    if (weekStart && weekEnd) {
      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      
      // Validate it's a proper week (7 days)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (daysDiff !== 7) {
        return NextResponse.json({
          success: false,
          error: 'Invalid week range. Must be exactly 7 days.',
          details: `Provided range is ${daysDiff} days`
        }, { status: 400 });
      }
      
      logger.info('📅 Manual weekly report generation triggered', { 
        weekStart, 
        weekEnd,
        triggeredBy: 'manual'
      });
    } else {
      logger.info('📅 Manual weekly report generation triggered for previous week', { 
        triggeredBy: 'manual'
      });
    }
    
    // Reuse the GET logic
    return await GET();
    
  } catch (error) {
    logger.error('❌ Manual weekly report generation failed', { error });
    
    return NextResponse.json({
      success: false,
      error: 'Manual weekly report generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
