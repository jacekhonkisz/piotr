import { NextRequest, NextResponse } from 'next/server';
import { ProductionDataManager } from '../../../../lib/production-data-manager';
import { supabaseAdmin } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

/**
 * AUTOMATED MONTHLY AGGREGATION
 * 
 * Runs on the 1st of each month to:
 * 1. Generate monthly summaries from daily data
 * 2. Preserve historical data before cleanup
 * 3. Ensure data continuity for reports
 * 
 * Security: Protected with CRON_SECRET authentication
 */

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  // For Vercel cron jobs - they only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  try {
    logger.info('🏭 Starting automated monthly aggregation...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get target month from request or default to previous month
    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || (() => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return lastMonth;
    })();

    const targetYear = targetDate instanceof Date ? targetDate.getFullYear() : new Date(targetDate).getFullYear();
    const targetMonth = targetDate instanceof Date ? targetDate.getMonth() + 1 : new Date(targetDate).getMonth() + 1;

    logger.info(`📅 Aggregating data for: ${targetYear}-${String(targetMonth).padStart(2, '0')}`);

    // Get all active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, api_status')
      .eq('api_status', 'valid');

    if (clientError) {
      logger.error('❌ Error fetching clients:', clientError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    if (!clients || clients.length === 0) {
      logger.info('⚠️ No active clients found');
      return NextResponse.json({ 
        success: true, 
        message: 'No active clients to process',
        processed: 0 
      });
    }

    logger.info(`📊 Processing ${clients.length} clients for monthly aggregation`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each client for both Meta and Google platforms
    for (const client of clients) {
      logger.info(`📊 Processing client: ${client.name} (${client.id})`);
      
      // Process Meta data
      try {
        const metaSummary = await ProductionDataManager.generateMonthlySummary({
          clientId: client.id,
          year: targetYear,
          month: targetMonth,
          platform: 'meta'
        });
        
        if (metaSummary) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            platform: 'meta',
            success: true,
            spend: (metaSummary as any).total_spend || 0,
            reservations: (metaSummary as any).reservations || 0
          });
          successCount++;
          logger.info(`✅ Meta summary generated for ${client.name}`);
        } else {
          results.push({
            clientId: client.id,
            clientName: client.name,
            platform: 'meta',
            success: false,
            error: 'No daily data available'
          });
          logger.warn(`⚠️ No Meta data for ${client.name}`);
        }
      } catch (error) {
        results.push({
          clientId: client.id,
          clientName: client.name,
          platform: 'meta',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
        logger.error(`❌ Meta aggregation failed for ${client.name}:`, error);
      }

      // Process Google Ads data
      try {
        const googleSummary = await ProductionDataManager.generateMonthlySummary({
          clientId: client.id,
          year: targetYear,
          month: targetMonth,
          platform: 'google'
        });
        
        if (googleSummary) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            platform: 'google',
            success: true,
            spend: (googleSummary as any).total_spend || 0,
            reservations: (googleSummary as any).reservations || 0
          });
          successCount++;
          logger.info(`✅ Google summary generated for ${client.name}`);
        } else {
          results.push({
            clientId: client.id,
            clientName: client.name,
            platform: 'google',
            success: false,
            error: 'No daily data available'
          });
          logger.warn(`⚠️ No Google data for ${client.name}`);
        }
      } catch (error) {
        results.push({
          clientId: client.id,
          clientName: client.name,
          platform: 'google',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
        logger.error(`❌ Google aggregation failed for ${client.name}:`, error);
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Run cleanup after aggregation
    logger.info('🧹 Running data cleanup after aggregation...');
    const cleanupResults = await ProductionDataManager.cleanupOldData();

    const summary = {
      success: true,
      targetYear,
      targetMonth,
      totalClients: clients.length,
      successCount,
      failureCount,
      cleanupResults,
      results,
      timestamp: new Date().toISOString()
    };

    logger.info('✅ Monthly aggregation completed:', {
      clients: clients.length,
      successes: successCount,
      failures: failureCount,
      dailyDeleted: cleanupResults.dailyDeleted,
      monthlyDeleted: cleanupResults.monthlyDeleted
    });

    return NextResponse.json(summary);

  } catch (error) {
    logger.error('❌ Monthly aggregation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

