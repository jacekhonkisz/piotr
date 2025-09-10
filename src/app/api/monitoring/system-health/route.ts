import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface SystemHealthMetrics {
  database: {
    status: 'healthy' | 'warning' | 'critical';
    responseTime: number;
    activeConnections?: number;
  };
  dataFreshness: {
    status: 'healthy' | 'warning' | 'critical';
    lastKpiUpdate: string;
    hoursSinceUpdate: number;
  };
  cacheHealth: {
    status: 'healthy' | 'warning' | 'critical';
    entriesCount: number;
    staleEntriesCount: number;
    averageAge: number;
  };
  systemLoad: {
    status: 'healthy' | 'warning' | 'critical';
    activeClients: number;
    recentReports: number;
    errorRate: number;
  };
  overallHealth: {
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    lastCheck: string;
  };
}

/**
 * System Health Monitoring API
 * 
 * GET - Get current system health metrics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('🏥 System health check requested');
    
    const healthMetrics: SystemHealthMetrics = await collectSystemHealthMetrics();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ System health check completed', {
      overallStatus: healthMetrics.overallHealth.status,
      healthScore: healthMetrics.overallHealth.score,
      responseTime
    });
    
    return NextResponse.json({
      success: true,
      data: healthMetrics,
      meta: {
        responseTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('❌ System health check failed', { 
      error: errorMessage,
      responseTime 
    });
    
    return NextResponse.json({
      success: false,
      error: 'System health check failed',
      details: errorMessage,
      meta: {
        responseTime,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

async function collectSystemHealthMetrics(): Promise<SystemHealthMetrics> {
  const dbStartTime = Date.now();
  
  // 1. Database Health Check
  let databaseHealth: SystemHealthMetrics['database'];
  try {
    const { data: clientCount, error: dbError } = await supabase
      .from('clients')
      .select('count', { count: 'exact' })
      .limit(1);
    
    const dbResponseTime = Date.now() - dbStartTime;
    
    if (dbError) {
      databaseHealth = {
        status: 'critical',
        responseTime: dbResponseTime
      };
    } else {
      databaseHealth = {
        status: dbResponseTime > 1000 ? 'warning' : 'healthy',
        responseTime: dbResponseTime
      };
    }
  } catch (error) {
    databaseHealth = {
      status: 'critical',
      responseTime: Date.now() - dbStartTime
    };
  }
  
  // 2. Data Freshness Check
  let dataFreshness: SystemHealthMetrics['dataFreshness'];
  try {
    const { data: latestKpi, error: kpiError } = await supabase
      .from('daily_kpi_data')
      .select('date, last_updated')
      .order('date', { ascending: false })
      .limit(1);
    
    if (kpiError || !latestKpi || latestKpi.length === 0) {
      dataFreshness = {
        status: 'critical',
        lastKpiUpdate: 'Never',
        hoursSinceUpdate: 999
      };
    } else {
      const lastUpdate = new Date(latestKpi[0]?.last_updated || latestKpi[0]?.date || new Date());
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      dataFreshness = {
        status: hoursSinceUpdate > 48 ? 'critical' : hoursSinceUpdate > 24 ? 'warning' : 'healthy',
        lastKpiUpdate: lastUpdate.toISOString(),
        hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10
      };
    }
  } catch (error) {
    dataFreshness = {
      status: 'critical',
      lastKpiUpdate: 'Error',
      hoursSinceUpdate: 999
    };
  }
  
  // 3. Cache Health Check
  let cacheHealth: SystemHealthMetrics['cacheHealth'];
  try {
    const { data: cacheEntries, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('last_updated');
    
    if (cacheError || !cacheEntries) {
      cacheHealth = {
        status: 'warning',
        entriesCount: 0,
        staleEntriesCount: 0,
        averageAge: 0
      };
    } else {
      const now = Date.now();
      const staleThreshold = 6 * 60 * 60 * 1000; // 6 hours
      
      let totalAge = 0;
      let staleCount = 0;
      
      for (const entry of cacheEntries) {
        const age = now - new Date(entry.last_updated).getTime();
        totalAge += age;
        if (age > staleThreshold) staleCount++;
      }
      
      const averageAge = cacheEntries.length > 0 ? totalAge / cacheEntries.length : 0;
      const stalePercentage = cacheEntries.length > 0 ? staleCount / cacheEntries.length : 0;
      
      cacheHealth = {
        status: stalePercentage > 0.5 ? 'warning' : 'healthy',
        entriesCount: cacheEntries.length,
        staleEntriesCount: staleCount,
        averageAge: Math.round(averageAge / (1000 * 60 * 60) * 10) / 10 // hours
      };
    }
  } catch (error) {
    cacheHealth = {
      status: 'warning',
      entriesCount: 0,
      staleEntriesCount: 0,
      averageAge: 0
    };
  }
  
  // 4. System Load Check
  let systemLoad: SystemHealthMetrics['systemLoad'];
  try {
    // Count active clients (with recent activity)
    const { data: activeClients, error: clientError } = await supabase
      .from('clients')
      .select('count', { count: 'exact' })
      .or('meta_access_token.not.is.null,google_ads_enabled.eq.true');
    
    // Count recent reports (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReports, error: reportError } = await supabase
      .from('reports')
      .select('count', { count: 'exact' })
      .gte('generated_at', yesterday);
    
    systemLoad = {
      status: 'healthy', // Could be enhanced with actual load metrics
      activeClients: Array.isArray(activeClients) ? activeClients.length : (activeClients || 0),
      recentReports: Array.isArray(recentReports) ? recentReports.length : (recentReports || 0),
      errorRate: 0 // Would need error logging to calculate this
    };
  } catch (error) {
    systemLoad = {
      status: 'warning',
      activeClients: 0,
      recentReports: 0,
      errorRate: 0
    };
  }
  
  // 5. Calculate Overall Health
  const healthScores = {
    database: databaseHealth.status === 'healthy' ? 100 : databaseHealth.status === 'warning' ? 70 : 30,
    dataFreshness: dataFreshness.status === 'healthy' ? 100 : dataFreshness.status === 'warning' ? 60 : 20,
    cache: cacheHealth.status === 'healthy' ? 100 : cacheHealth.status === 'warning' ? 80 : 40,
    system: systemLoad.status === 'healthy' ? 100 : systemLoad.status === 'warning' ? 75 : 35
  };
  
  const overallScore = Math.round(
    (healthScores.database * 0.3 + 
     healthScores.dataFreshness * 0.3 + 
     healthScores.cache * 0.2 + 
     healthScores.system * 0.2)
  );
  
  const overallStatus: 'healthy' | 'warning' | 'critical' = 
    overallScore >= 85 ? 'healthy' : 
    overallScore >= 60 ? 'warning' : 'critical';
  
  return {
    database: databaseHealth,
    dataFreshness,
    cacheHealth,
    systemLoad,
    overallHealth: {
      status: overallStatus,
      score: overallScore,
      lastCheck: new Date().toISOString()
    }
  };
}
