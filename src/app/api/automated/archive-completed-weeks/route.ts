import { NextResponse } from 'next/server';
import { DataLifecycleManager } from '../../../../lib/data-lifecycle-manager';
import logger from '../../../../lib/logger';

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('Automated weekly archival started', { endpoint: '/api/automated/archive-completed-weeks' });
    
    const lifecycleManager = DataLifecycleManager.getInstance();
    await lifecycleManager.archiveCompletedWeeks();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Automated weekly archival completed', { responseTime });
    
    return NextResponse.json({
      success: true,
      message: 'Weekly data archival completed successfully',
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Automated weekly archival failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Automated weekly archival failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      success: false,
      error: 'Weekly archival failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 