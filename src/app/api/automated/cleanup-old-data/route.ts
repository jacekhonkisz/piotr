import { NextResponse } from 'next/server';
import { DataLifecycleManager } from '../../../../lib/data-lifecycle-manager';
import logger from '../../../../lib/logger';

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('Automated old data cleanup started', { endpoint: '/api/automated/cleanup-old-data' });
    
    const lifecycleManager = DataLifecycleManager.getInstance();
    await lifecycleManager.cleanupOldData();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Automated old data cleanup completed', { responseTime });
    
    return NextResponse.json({
      success: true,
      message: 'Old data cleanup completed successfully',
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Automated old data cleanup failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Automated old data cleanup failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      success: false,
      error: 'Old data cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 