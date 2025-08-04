import { NextResponse } from 'next/server'
import { performanceMonitor } from '../../../lib/performance'
import logger from '../../../lib/logger'

export async function GET() {
  try {
    logger.info('Metrics request received')
    
    const metrics = performanceMonitor.getMetrics()
    
    logger.info('Metrics retrieved successfully', { metricCount: Object.keys(metrics).length })
    
    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to retrieve metrics', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json({ 
      error: 'Failed to retrieve metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 