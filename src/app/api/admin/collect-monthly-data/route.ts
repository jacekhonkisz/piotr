import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';

/**
 * Admin endpoint to manually trigger monthly data collection for a specific client
 * This is useful for backfilling historical data for past months
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { client_id } = body;
    
    if (!client_id) {
      return NextResponse.json({
        success: false,
        error: 'client_id is required'
      }, { status: 400 });
    }
    
    logger.info(`📊 Manual monthly data collection triggered for client ${client_id}`);
    
    const collector = BackgroundDataCollector.getInstance();
    
    // Trigger collection in background (don't await to avoid timeout)
    collector.collectMonthlySummariesForSingleClient(client_id)
      .then(() => {
        logger.info(`✅ Monthly data collection completed for client ${client_id}`);
      })
      .catch(error => {
        logger.error(`❌ Monthly data collection failed for client ${client_id}:`, error);
      });
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'Monthly data collection started in background (will collect last 12 months)',
      client_id,
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ Failed to trigger monthly data collection:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    }, { status: 500 });
  }
}

