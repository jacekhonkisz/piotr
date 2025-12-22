import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReportForPeriod } from '../../../../lib/automated-report-generator';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Automated Monthly Report Generation
 * 
 * Triggered by cron job on the 1st day of each month at 2 AM
 * Generates reports for the previous completed month for all active clients
 */
export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  const startTime = Date.now();
  
  try {
    logger.info('🗓️ Starting automated monthly report generation');
    
    // Calculate previous month period
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = previousMonth.toISOString().split('T')[0];
    const periodEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0];
    
    logger.info('📅 Generating reports for period:', { periodStart, periodEnd });
    
    // Get all active clients with Meta Ads or Google Ads configured
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, google_ads_enabled, reporting_frequency')
      .or('meta_access_token.not.is.null,google_ads_enabled.eq.true')
      .eq('reporting_frequency', 'monthly');
    
    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('ℹ️ No clients configured for monthly reports');
      return NextResponse.json({
        success: true,
        message: 'No clients configured for monthly reports',
        generated: 0
      });
    }
    
    logger.info(`📊 Found ${clients.length} clients configured for monthly reports`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Generate reports for each client
    for (const client of clients) {
      try {
        logger.info(`📄 Generating monthly report for client: ${client.name} (${client.email})`);
        
        // Check if report already exists in reports table (legacy system)
        const { data: existingReport } = await supabase
          .from('reports')
          .select('id')
          .eq('client_id', client.id)
          .eq('date_range_start', periodStart)
          .eq('date_range_end', periodEnd)
          .maybeSingle();
        
        if (existingReport) {
          logger.info(`⏭️ Report already exists for ${client.name}, skipping`);
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
        
        logger.info(`✅ Successfully generated monthly report for ${client.name}`, {
          reportId: generatedReport.report?.id,
          success: generatedReport.success
        });
        
        results.successful++;
        
      } catch (error) {
        const errorMessage = `Failed to generate report for ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error('❌ Report generation failed', { 
          clientId: client.id, 
          clientName: client.name,
          error: errorMessage 
        });
        
        results.failed++;
        results.errors.push(errorMessage);
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('🎯 Monthly report generation completed', {
      totalClients: clients.length,
      successful: results.successful,
      failed: results.failed,
      responseTime
    });
    
    // Return success even if some reports failed (partial success)
    return NextResponse.json({
      success: true,
      message: `Monthly report generation completed`,
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
    
    logger.error('❌ Automated monthly report generation failed', { 
      error: errorMessage,
      responseTime 
    });
    
    return NextResponse.json({
      success: false,
      error: 'Automated monthly report generation failed',
      details: errorMessage,
      responseTime
    }, { status: 500 });
  }
}

/**
 * Manual trigger for monthly report generation (for testing)
 */
export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const { month, year } = body;
    
    // If specific month/year provided, use that; otherwise use previous month
    let periodStart: string;
    let periodEnd: string;
    
    if (month && year) {
      const targetDate = new Date(year, month - 1, 1);
      periodStart = targetDate.toISOString().split('T')[0] || '';
      periodEnd = new Date(year, month, 0).toISOString().split('T')[0] || '';
    } else {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodStart = previousMonth.toISOString().split('T')[0] || '';
      periodEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)
        .toISOString().split('T')[0] || '';
    }
    
    logger.info('📅 Manual monthly report generation triggered', { 
      periodStart, 
      periodEnd,
      triggeredBy: 'manual'
    });
    
    // Reuse the GET logic
    return await GET();
    
  } catch (error) {
    logger.error('❌ Manual monthly report generation failed', { error });
    
    return NextResponse.json({
      success: false,
      error: 'Manual monthly report generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
