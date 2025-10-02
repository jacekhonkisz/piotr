/**
 * Data Health Monitoring Endpoint
 * 
 * Provides comprehensive health checks for data storage system:
 * - Checks for legacy table usage
 * - Detects expired caches not yet archived
 * - Verifies data retention policy compliance
 * - Monitors storage efficiency
 * 
 * Can be called:
 * - Manually for health checks
 * - Via monitoring systems (DataDog, New Relic, etc.)
 * - Via cron for daily health reports
 */

import { supabase } from '@/lib/supabase';
import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

interface HealthIssue {
  type: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  action?: string;
  count?: number;
}

interface HealthWarning {
  type: string;
  message: string;
  severity: 'medium' | 'low';
  action?: string;
  count?: number;
}

interface HealthStats {
  total_summaries: number;
  monthly_summaries: number;
  weekly_summaries: number;
  current_month_caches: number;
  current_week_caches: number;
  total_storage_entries: number;
  platforms: {
    meta: number;
    google: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('🏥 Starting data health check...');
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      healthy: true,
      issues: [] as HealthIssue[],
      warnings: [] as HealthWarning[],
      stats: {} as HealthStats
    };
    
    // ============================================================================
    // 1. Check for Legacy Table Usage
    // ============================================================================
    try {
      const { data: legacyCampaigns, count: legacyMetaCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true });
        
      if (legacyMetaCount && legacyMetaCount > 0) {
        healthReport.warnings.push({
          type: 'DEPRECATED_TABLE_USAGE',
          message: `Legacy "campaigns" table has ${legacyMetaCount} records. Should migrate to campaign_summaries with platform=meta.`,
          severity: 'medium',
          action: 'Run data migration script to move to campaign_summaries',
          count: legacyMetaCount
        });
      }
      
      const { data: legacyGoogleCampaigns, count: legacyGoogleCount } = await supabase
        .from('google_ads_campaigns')
        .select('*', { count: 'exact', head: true });
        
      if (legacyGoogleCount && legacyGoogleCount > 0) {
        healthReport.warnings.push({
          type: 'DEPRECATED_TABLE_USAGE',
          message: `Legacy "google_ads_campaigns" table has ${legacyGoogleCount} records. Should migrate to campaign_summaries with platform=google.`,
          severity: 'medium',
          action: 'Run data migration script to move to campaign_summaries',
          count: legacyGoogleCount
        });
      }
    } catch (error) {
      logger.warn('⚠️ Could not check legacy tables (may not exist):', error);
    }
    
    // ============================================================================
    // 2. Check for Expired Caches Not Archived
    // ============================================================================
    
    // Check monthly caches
    const now = new Date();
    const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: staleMonthCaches, count: staleMonthCount } = await supabase
      .from('current_month_cache')
      .select('*', { count: 'exact' })
      .neq('period_id', currentMonthId);
      
    if (staleMonthCount && staleMonthCount > 0) {
      healthReport.issues.push({
        type: 'STALE_MONTHLY_CACHE',
        message: `Found ${staleMonthCount} expired monthly cache(s) not yet archived.`,
        severity: 'high',
        action: 'Run period transition handler: /api/cron/period-transition',
        count: staleMonthCount
      });
      healthReport.healthy = false;
    }
    
    // Check weekly caches
    const currentWeekId = getCurrentWeekPeriodId();
    
    const { data: staleWeekCaches, count: staleWeekCount } = await supabase
      .from('current_week_cache')
      .select('*', { count: 'exact' })
      .neq('period_id', currentWeekId);
      
    if (staleWeekCount && staleWeekCount > 0) {
      healthReport.issues.push({
        type: 'STALE_WEEKLY_CACHE',
        message: `Found ${staleWeekCount} expired weekly cache(s) not yet archived.`,
        severity: 'high',
        action: 'Run period transition handler: /api/cron/period-transition',
        count: staleWeekCount
      });
      healthReport.healthy = false;
    }
    
    // ============================================================================
    // 3. Check Data Retention Policy Compliance
    // ============================================================================
    
    // Check for data older than 14 months (should be cleaned up)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 14);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const { data: oldMonthlyData, count: oldMonthlyCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_type', 'monthly')
      .lt('summary_date', cutoffStr);
      
    if (oldMonthlyCount && oldMonthlyCount > 0) {
      healthReport.warnings.push({
        type: 'RETENTION_POLICY_VIOLATION',
        message: `Found ${oldMonthlyCount} monthly record(s) older than 14 months. Should be cleaned up.`,
        severity: 'medium',
        action: 'Run cleanup job: /api/cron/archive-periods',
        count: oldMonthlyCount
      });
    }
    
    // Check for weekly data older than 54 weeks
    const weekCutoffDate = new Date();
    weekCutoffDate.setDate(weekCutoffDate.getDate() - (54 * 7));
    const weekCutoffStr = weekCutoffDate.toISOString().split('T')[0];
    
    const { data: oldWeeklyData, count: oldWeeklyCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_type', 'weekly')
      .lt('summary_date', weekCutoffStr);
      
    if (oldWeeklyCount && oldWeeklyCount > 0) {
      healthReport.warnings.push({
        type: 'RETENTION_POLICY_VIOLATION',
        message: `Found ${oldWeeklyCount} weekly record(s) older than 54 weeks. Should be cleaned up.`,
        severity: 'medium',
        action: 'Run cleanup job: /api/cron/archive-periods',
        count: oldWeeklyCount
      });
    }
    
    // ============================================================================
    // 4. Check for Missing Platform Values
    // ============================================================================
    
    const { data: missingPlatform, count: missingPlatformCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .or('platform.is.null,platform.eq.');
      
    if (missingPlatformCount && missingPlatformCount > 0) {
      healthReport.warnings.push({
        type: 'MISSING_PLATFORM_DATA',
        message: `Found ${missingPlatformCount} record(s) with missing platform value.`,
        severity: 'medium',
        action: 'Run data fix script to populate platform values',
        count: missingPlatformCount
      });
    }
    
    // ============================================================================
    // 5. Collect Overall Statistics
    // ============================================================================
    
    const [summariesCount, monthCacheCount, weekCacheCount] = await Promise.all([
      supabase.from('campaign_summaries').select('*', { count: 'exact', head: true }),
      supabase.from('current_month_cache').select('*', { count: 'exact', head: true }),
      supabase.from('current_week_cache').select('*', { count: 'exact', head: true })
    ]);
    
    // Get summary type breakdown
    const { data: monthlySummaries, count: monthlyCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_type', 'monthly');
      
    const { data: weeklySummaries, count: weeklyCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_type', 'weekly');
    
    // Get platform breakdown
    const { data: metaSummaries, count: metaCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'meta');
      
    const { data: googleSummaries, count: googleCount } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'google');
    
    healthReport.stats = {
      total_summaries: summariesCount.count || 0,
      monthly_summaries: monthlyCount || 0,
      weekly_summaries: weeklyCount || 0,
      current_month_caches: monthCacheCount.count || 0,
      current_week_caches: weekCacheCount.count || 0,
      total_storage_entries: (summariesCount.count || 0) + (monthCacheCount.count || 0) + (weekCacheCount.count || 0),
      platforms: {
        meta: metaCount || 0,
        google: googleCount || 0
      }
    };
    
    // ============================================================================
    // 6. Generate Health Score
    // ============================================================================
    
    let healthScore = 100;
    
    // Deduct points for issues
    healthReport.issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': healthScore -= 25; break;
        case 'high': healthScore -= 15; break;
        case 'medium': healthScore -= 10; break;
        case 'low': healthScore -= 5; break;
      }
    });
    
    // Deduct points for warnings
    healthReport.warnings.forEach(warning => {
      switch (warning.severity) {
        case 'medium': healthScore -= 5; break;
        case 'low': healthScore -= 2; break;
      }
    });
    
    healthScore = Math.max(0, healthScore);
    
    const executionTime = Date.now() - startTime;
    
    logger.info('✅ Data health check completed', {
      executionTime: `${executionTime}ms`,
      healthy: healthReport.healthy,
      healthScore,
      issueCount: healthReport.issues.length,
      warningCount: healthReport.warnings.length
    });
    
    return Response.json({
      ...healthReport,
      healthScore,
      executionTime,
      recommendation: healthScore >= 90 
        ? '✅ System is healthy' 
        : healthScore >= 70 
        ? '⚠️ Minor issues detected - investigate warnings'
        : healthScore >= 50
        ? '⚠️ Issues detected - action required'
        : '🚨 Critical issues - immediate action required'
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Data health check failed:', error);
    
    return Response.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      executionTime
    }, { status: 500 });
  }
}

/**
 * Get current ISO week period ID (e.g., "2025-W40")
 */
function getCurrentWeekPeriodId(): string {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay() + 1);
  
  const date = new Date(currentWeekStart);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// Export runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

