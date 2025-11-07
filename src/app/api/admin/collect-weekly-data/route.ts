import { NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Client ID is required' }, { status: 400 });
    }

    logger.info(`Manual weekly data collection triggered for client: ${clientId}`);

    const collector = BackgroundDataCollector.getInstance();
    // Trigger historical collection in background (don't await to avoid timeout)
    collector.collectWeeklySummariesForSingleClient(clientId).catch(error => {
      logger.error(`Failed to manually collect weekly data for ${clientId}:`, error);
    });

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Weekly data collection started in background (will collect last 53 weeks = 1 year + 1 week for both Meta & Google Ads)',
      client_id: clientId,
      responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Manual weekly data collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger weekly data collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

