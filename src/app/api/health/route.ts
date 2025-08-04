import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import logger from '../../../lib/logger'

export async function GET() {
  const startTime = Date.now()
  
  try {
    logger.info('Health check started')
    
    // Check database connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (dbError) {
      logger.error('Database health check failed', { error: dbError.message })
      throw new Error(`Database error: ${dbError.message}`)
    }
    
    logger.info('Database health check passed')
    
    // Check Meta API connectivity (optional)
    const metaApiHealthy = await checkMetaAPIHealth()
    
    const responseTime = Date.now() - startTime
    
    logger.info('Health check completed', { 
      responseTime, 
      metaApiHealthy 
    })
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: 'healthy',
        metaApi: metaApiHealthy ? 'healthy' : 'degraded'
      }
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    })
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}

async function checkMetaAPIHealth(): Promise<boolean> {
  try {
    // Simple health check for Meta API
    const response = await fetch('https://graph.facebook.com/v18.0/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`
      }
    })
    return response.ok
  } catch (error) {
    logger.warn('Meta API health check failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    return false
  }
} 