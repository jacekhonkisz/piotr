import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';

/**
 * 🏥 Data Health Check API
 * 
 * Monitors data integrity and completeness
 * Used by: Monitoring dashboard, automated health checks
 * 
 * Checks:
 * 1. Daily collection completeness
 * 2. Split data detection
 * 3. Missing days in last 7 days
 * 4. Cache freshness
 */

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  checks: {
    todayCollection: HealthCheck;
    splitData: HealthCheck;
    missingDays: HealthCheck;
    cacheFreshness: HealthCheck;
  };
  issues: Array<{
    severity: 'warning' | 'critical';
    message: string;
    affectedClients?: string[];
  }>;
  lastCheck: string;
  summary: {
    totalClients: number;
    healthyClients: number;
    issuesFound: number;
  };
}

interface HealthCheck {
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: any;
}

export async function GET(request: NextRequest) {
  try {
    logger.info('🏥 Starting data health check...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get all active clients
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('api_status', 'valid');

    if (clientError) {
      logger.error('Error fetching clients:', clientError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    const totalClients = clients?.length || 0;
    const issues: HealthCheckResult['issues'] = [];

    // -------------------------------------------------------------------------
    // CHECK 1: Today's Collection Completeness
    // -------------------------------------------------------------------------
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayData, error: todayError } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('client_id, total_spend, click_to_call')
      .eq('date', today);

    const todayClientCount = todayData?.length || 0;
    
    let todayCollectionCheck: HealthCheck;
    if (todayClientCount === 0) {
      todayCollectionCheck = {
        status: 'warning',
        message: 'No data collected for today yet',
        details: { expected: totalClients, actual: 0 }
      };
      issues.push({
        severity: 'warning',
        message: 'Daily collection not yet run for today'
      });
    } else if (todayClientCount < totalClients) {
      todayCollectionCheck = {
        status: 'warning',
        message: `Incomplete collection: ${todayClientCount}/${totalClients} clients`,
        details: { expected: totalClients, actual: todayClientCount }
      };
      issues.push({
        severity: 'warning',
        message: `${totalClients - todayClientCount} clients missing today's data`
      });
    } else {
      todayCollectionCheck = {
        status: 'pass',
        message: `All ${totalClients} clients collected`,
        details: { expected: totalClients, actual: todayClientCount }
      };
    }

    // -------------------------------------------------------------------------
    // CHECK 2: Split Data Detection
    // -------------------------------------------------------------------------
    
    // Check last 7 days for split data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentData } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('client_id, date, total_spend, total_impressions, click_to_call, email_contacts, reservations')
      .gte('date', sevenDaysAgoStr)
      .order('date', { ascending: false });

    const splitDataIssues: Array<{clientId: string; date: string; type: string}> = [];
    
    recentData?.forEach(record => {
      const hasCampaigns = (record.total_spend || 0) > 0 || (record.total_impressions || 0) > 0;
      const hasConversions = (record.click_to_call || 0) > 0 || 
                             (record.email_contacts || 0) > 0 || 
                             (record.reservations || 0) > 0;
      
      if (hasCampaigns && !hasConversions) {
        splitDataIssues.push({
          clientId: record.client_id,
          date: record.date,
          type: 'campaigns_without_conversions'
        });
      } else if (!hasCampaigns && hasConversions) {
        splitDataIssues.push({
          clientId: record.client_id,
          date: record.date,
          type: 'conversions_without_campaigns'
        });
      }
    });

    let splitDataCheck: HealthCheck;
    if (splitDataIssues.length > 0) {
      splitDataCheck = {
        status: 'fail',
        message: `${splitDataIssues.length} split data records detected`,
        details: { issues: splitDataIssues.slice(0, 10) } // First 10
      };
      issues.push({
        severity: 'critical',
        message: `Split data detected in ${splitDataIssues.length} records (last 7 days)`,
        affectedClients: Array.from(new Set(splitDataIssues.map(i => i.clientId)))
      });
    } else {
      splitDataCheck = {
        status: 'pass',
        message: 'No split data detected in last 7 days'
      };
    }

    // -------------------------------------------------------------------------
    // CHECK 3: Missing Days Detection
    // -------------------------------------------------------------------------
    
    const expectedDays = 7;
    const { data: distinctDays } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('date')
      .gte('date', sevenDaysAgoStr)
      .lte('date', today);
    
    const uniqueDays = new Set(distinctDays?.map(d => d.date)).size;
    
    let missingDaysCheck: HealthCheck;
    if (uniqueDays < expectedDays) {
      missingDaysCheck = {
        status: 'warning',
        message: `${expectedDays - uniqueDays} days missing in last week`,
        details: { expected: expectedDays, actual: uniqueDays }
      };
      issues.push({
        severity: 'warning',
        message: `Data gaps detected in last 7 days`
      });
    } else {
      missingDaysCheck = {
        status: 'pass',
        message: 'All 7 days have data'
      };
    }

    // -------------------------------------------------------------------------
    // CHECK 4: Cache Freshness
    // -------------------------------------------------------------------------
    
    const { data: cacheData } = await supabaseAdmin
      .from('current_month_cache')
      .select('client_id, last_updated')
      .order('last_updated', { ascending: true })
      .limit(1);

    let cacheFreshnessCheck: HealthCheck;
    
    if (cacheData && cacheData.length > 0) {
      const oldestUpdate = new Date(cacheData[0].last_updated);
      const hoursOld = (Date.now() - oldestUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursOld > 6) {
        cacheFreshnessCheck = {
          status: 'warning',
          message: `Cache stale: ${Math.round(hoursOld)} hours old`,
          details: { hoursOld: Math.round(hoursOld) }
        };
        issues.push({
          severity: 'warning',
          message: 'Cache not refreshed in over 6 hours'
        });
      } else {
        cacheFreshnessCheck = {
          status: 'pass',
          message: `Cache fresh: ${Math.round(hoursOld)} hours old`
        };
      }
    } else {
      cacheFreshnessCheck = {
        status: 'warning',
        message: 'No cache data found',
        details: { reason: 'Empty cache' }
      };
    }

    // -------------------------------------------------------------------------
    // CALCULATE OVERALL HEALTH
    // -------------------------------------------------------------------------
    
    const checks = [
      todayCollectionCheck,
      splitDataCheck,
      missingDaysCheck,
      cacheFreshnessCheck
    ];

    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    // Score: 100 for pass, 50 for warning, 0 for fail
    const score = Math.round(
      (passCount * 100 + warningCount * 50 + failCount * 0) / checks.length
    );

    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (failCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 1) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      score,
      checks: {
        todayCollection: todayCollectionCheck,
        splitData: splitDataCheck,
        missingDays: missingDaysCheck,
        cacheFreshness: cacheFreshnessCheck
      },
      issues,
      lastCheck: new Date().toISOString(),
      summary: {
        totalClients,
        healthyClients: todayClientCount,
        issuesFound: issues.length
      }
    };

    logger.info('✅ Data health check completed', {
      status: overallStatus,
      score,
      issues: issues.length
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('❌ Data health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

