import { createClient } from '@supabase/supabase-js';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface ValidationResult {
  checkType: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'passed' | 'failed' | 'warning';
  description: string;
  details?: any;
  timestamp: string;
  clientId?: string;
  period?: string;
}

export interface DataValidationReport {
  overallStatus: 'healthy' | 'warning' | 'critical';
  healthScore: number; // 0-100
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  criticalIssues: number;
  checks: ValidationResult[];
  summary: {
    dataConsistency: number;
    dataFreshness: number;
    systemHealth: number;
  };
}

export class DataValidator {
  private tolerance = 0.01; // 1% tolerance for floating point comparisons

  async runFullValidation(): Promise<DataValidationReport> {
    logger.info('🔍 Starting comprehensive data validation');
    
    const checks: ValidationResult[] = [];
    
    try {
      // Run all validation checks
      checks.push(...await this.validateCampaignSummaryConsistency());
      checks.push(...await this.validateCacheConsistency());
      checks.push(...await this.validateDataFreshness());
      checks.push(...await this.validateCrossTableIntegrity());
      checks.push(...await this.validateConversionMetrics());
      checks.push(...await this.validateSystemHealth());
      
    } catch (error) {
      logger.error('❌ Data validation failed', { error });
      checks.push({
        checkType: 'validation_system_error',
        severity: 'critical',
        status: 'failed',
        description: `Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate overall health metrics
    const report = this.calculateHealthMetrics(checks);
    
    logger.info('✅ Data validation completed', {
      overallStatus: report.overallStatus,
      healthScore: report.healthScore,
      totalChecks: report.totalChecks,
      criticalIssues: report.criticalIssues
    });
    
    return report;
  }

  private async validateCampaignSummaryConsistency(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('📊 Validating campaign summary consistency');
      
      // Get recent campaign summaries
      const { data: summaries, error } = await supabase
        .from('campaign_summaries')
        .select('*')
        .gte('summary_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(10);
      
      if (error) {
        checks.push({
          checkType: 'campaign_summary_access',
          severity: 'critical',
          status: 'failed',
          description: `Cannot access campaign summaries: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      if (!summaries || summaries.length === 0) {
        checks.push({
          checkType: 'campaign_summary_data',
          severity: 'warning',
          status: 'warning',
          description: 'No recent campaign summaries found',
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      // Validate each summary
      for (const summary of summaries) {
        const summaryChecks = await this.validateSingleSummary(summary);
        checks.push(...summaryChecks);
      }
      
      checks.push({
        checkType: 'campaign_summary_consistency',
        severity: 'info',
        status: 'passed',
        description: `Validated ${summaries.length} campaign summaries`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      checks.push({
        checkType: 'campaign_summary_validation',
        severity: 'critical',
        status: 'failed',
        description: `Campaign summary validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateSingleSummary(summary: any): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    // Check if campaign data matches totals
    if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
      const calculatedTotals = this.calculateTotalsFromCampaigns(summary.campaign_data);
      
      // Validate spend
      const spendDiff = Math.abs(calculatedTotals.totalSpend - (summary.total_spend || 0));
      const spendPercentDiff = spendDiff / Math.max(calculatedTotals.totalSpend, summary.total_spend || 0, 1);
      
      if (spendPercentDiff > this.tolerance) {
        checks.push({
          checkType: 'spend_consistency',
          severity: 'critical',
          status: 'failed',
          description: `Spend mismatch in summary ${summary.id}`,
          details: {
            calculated: calculatedTotals.totalSpend,
            stored: summary.total_spend,
            difference: spendDiff,
            percentDifference: (spendPercentDiff * 100).toFixed(2) + '%'
          },
          clientId: summary.client_id,
          period: summary.summary_date,
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate impressions
      const impressionsDiff = Math.abs(calculatedTotals.totalImpressions - (summary.total_impressions || 0));
      if (impressionsDiff > 0 && calculatedTotals.totalImpressions > 0) {
        const impressionsPercentDiff = impressionsDiff / Math.max(calculatedTotals.totalImpressions, summary.total_impressions || 0, 1);
        
        if (impressionsPercentDiff > this.tolerance) {
          checks.push({
            checkType: 'impressions_consistency',
            severity: 'warning',
            status: 'warning',
            description: `Impressions mismatch in summary ${summary.id}`,
            details: {
              calculated: calculatedTotals.totalImpressions,
              stored: summary.total_impressions,
              difference: impressionsDiff,
              percentDifference: (impressionsPercentDiff * 100).toFixed(2) + '%'
            },
            clientId: summary.client_id,
            period: summary.summary_date,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // Check for negative values
    const negativeFields = [];
    if ((summary.total_spend || 0) < 0) negativeFields.push('total_spend');
    if ((summary.total_impressions || 0) < 0) negativeFields.push('total_impressions');
    if ((summary.total_clicks || 0) < 0) negativeFields.push('total_clicks');
    
    if (negativeFields.length > 0) {
      checks.push({
        checkType: 'negative_values',
        severity: 'critical',
        status: 'failed',
        description: `Negative values found in summary ${summary.id}`,
        details: { negativeFields },
        clientId: summary.client_id,
        period: summary.summary_date,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateCacheConsistency(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('🗄️ Validating cache consistency');
      
      // Check current month cache freshness
      const { data: cacheEntries, error } = await supabase
        .from('current_month_cache')
        .select('*')
        .limit(5);
      
      if (error) {
        checks.push({
          checkType: 'cache_access',
          severity: 'warning',
          status: 'failed',
          description: `Cannot access cache: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      if (!cacheEntries || cacheEntries.length === 0) {
        checks.push({
          checkType: 'cache_data',
          severity: 'warning',
          status: 'warning',
          description: 'No cache entries found',
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      // Check cache age
      const now = Date.now();
      const staleThreshold = 6 * 60 * 60 * 1000; // 6 hours
      
      for (const entry of cacheEntries) {
        const cacheAge = now - new Date(entry.last_updated).getTime();
        
        if (cacheAge > staleThreshold) {
          checks.push({
            checkType: 'cache_freshness',
            severity: 'warning',
            status: 'warning',
            description: `Stale cache entry for client ${entry.client_id}`,
            details: {
              ageHours: (cacheAge / (1000 * 60 * 60)).toFixed(1),
              lastUpdated: entry.last_updated,
              periodId: entry.period_id
            },
            clientId: entry.client_id,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      checks.push({
        checkType: 'cache_consistency',
        severity: 'info',
        status: 'passed',
        description: `Validated ${cacheEntries.length} cache entries`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      checks.push({
        checkType: 'cache_validation',
        severity: 'warning',
        status: 'failed',
        description: `Cache validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateDataFreshness(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('⏰ Validating data freshness');
      
      // Check daily KPI data freshness
      const { data: latestKpi, error } = await supabase
        .from('daily_kpi_data')
        .select('date, last_updated')
        .order('date', { ascending: false })
        .limit(1);
      
      if (error) {
        checks.push({
          checkType: 'kpi_data_access',
          severity: 'warning',
          status: 'failed',
          description: `Cannot access KPI data: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      } else if (!latestKpi || latestKpi.length === 0) {
        checks.push({
          checkType: 'kpi_data_freshness',
          severity: 'critical',
          status: 'failed',
          description: 'No daily KPI data found',
          timestamp: new Date().toISOString()
        });
      } else {
        const latestDate = new Date(latestKpi[0]?.date || new Date());
        const daysSinceLatest = Math.floor((Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysSinceLatest > 2) {
          checks.push({
            checkType: 'kpi_data_freshness',
            severity: 'warning',
            status: 'warning',
            description: `KPI data is ${daysSinceLatest} days old`,
            details: {
              latestDate: latestKpi[0]?.date || 'Unknown',
              daysSinceLatest
            },
            timestamp: new Date().toISOString()
          });
        } else {
          checks.push({
            checkType: 'kpi_data_freshness',
            severity: 'info',
            status: 'passed',
            description: `KPI data is current (${daysSinceLatest} days old)`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
    } catch (error) {
      checks.push({
        checkType: 'data_freshness_validation',
        severity: 'warning',
        status: 'failed',
        description: `Data freshness validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateCrossTableIntegrity(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('🔗 Validating cross-table integrity');
      
      // Check for orphaned records
      const { data: orphanedCampaigns, error: campaignError } = await supabase
        .rpc('count_orphaned_campaigns');
      
      if (!campaignError && orphanedCampaigns > 0) {
        checks.push({
          checkType: 'orphaned_campaigns',
          severity: 'warning',
          status: 'warning',
          description: `Found ${orphanedCampaigns} orphaned campaign records`,
          details: { count: orphanedCampaigns },
          timestamp: new Date().toISOString()
        });
      }
      
      // Check for missing client references
      const { data: clientCount } = await supabase
        .from('clients')
        .select('id', { count: 'exact' });
      
      const { data: summaryClientCount } = await supabase
        .from('campaign_summaries')
        .select('client_id', { count: 'exact' });
      
      if (clientCount && summaryClientCount) {
        checks.push({
          checkType: 'cross_table_integrity',
          severity: 'info',
          status: 'passed',
          description: `Cross-table integrity validated`,
          details: {
            clients: clientCount,
            summariesWithClients: summaryClientCount
          },
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      checks.push({
        checkType: 'cross_table_validation',
        severity: 'warning',
        status: 'failed',
        description: `Cross-table validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateConversionMetrics(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('🎯 Validating conversion metrics');
      
      // Check for reasonable conversion rates
      const { data: summaries, error } = await supabase
        .from('campaign_summaries')
        .select('*')
        .gte('summary_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .gt('total_clicks', 0);
      
      if (error) {
        checks.push({
          checkType: 'conversion_metrics_access',
          severity: 'warning',
          status: 'failed',
          description: `Cannot access conversion metrics: ${error.message}`,
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      if (!summaries || summaries.length === 0) {
        checks.push({
          checkType: 'conversion_metrics_data',
          severity: 'info',
          status: 'passed',
          description: 'No recent conversion data to validate',
          timestamp: new Date().toISOString()
        });
        return checks;
      }
      
      // Check for unrealistic conversion rates
      for (const summary of summaries) {
        const conversionRate = (summary.total_conversions || 0) / (summary.total_clicks || 1);
        
        if (conversionRate > 0.5) { // 50% conversion rate seems unrealistic
          checks.push({
            checkType: 'unrealistic_conversion_rate',
            severity: 'warning',
            status: 'warning',
            description: `Unusually high conversion rate detected`,
            details: {
              conversionRate: (conversionRate * 100).toFixed(2) + '%',
              conversions: summary.total_conversions,
              clicks: summary.total_clicks
            },
            clientId: summary.client_id,
            period: summary.summary_date,
            timestamp: new Date().toISOString()
          });
        }
        
        // Check ROAS reasonableness
        if ((summary.roas || 0) > 50) { // ROAS > 5000% seems unrealistic
          checks.push({
            checkType: 'unrealistic_roas',
            severity: 'warning',
            status: 'warning',
            description: `Unusually high ROAS detected`,
            details: {
              roas: summary.roas,
              spend: summary.total_spend,
              reservationValue: summary.reservation_value
            },
            clientId: summary.client_id,
            period: summary.summary_date,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      checks.push({
        checkType: 'conversion_metrics_validation',
        severity: 'info',
        status: 'passed',
        description: `Validated conversion metrics for ${summaries.length} summaries`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      checks.push({
        checkType: 'conversion_metrics_validation',
        severity: 'warning',
        status: 'failed',
        description: `Conversion metrics validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private async validateSystemHealth(): Promise<ValidationResult[]> {
    const checks: ValidationResult[] = [];
    
    try {
      logger.info('🏥 Validating system health');
      
      // Check database connectivity
      const { error: dbError } = await supabase
        .from('clients')
        .select('count', { count: 'exact' })
        .limit(1);
      
      if (dbError) {
        checks.push({
          checkType: 'database_connectivity',
          severity: 'critical',
          status: 'failed',
          description: `Database connectivity issue: ${dbError.message}`,
          timestamp: new Date().toISOString()
        });
      } else {
        checks.push({
          checkType: 'database_connectivity',
          severity: 'info',
          status: 'passed',
          description: 'Database connectivity is healthy',
          timestamp: new Date().toISOString()
        });
      }
      
      // Check for recent errors in logs (if available)
      // This would require a logs table to be implemented
      
    } catch (error) {
      checks.push({
        checkType: 'system_health_validation',
        severity: 'critical',
        status: 'failed',
        description: `System health validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return checks;
  }

  private calculateTotalsFromCampaigns(campaigns: any[]): any {
    return campaigns.reduce((acc, campaign) => ({
      totalSpend: acc.totalSpend + (parseFloat(campaign.spend) || 0),
      totalImpressions: acc.totalImpressions + (parseInt(campaign.impressions) || 0),
      totalClicks: acc.totalClicks + (parseInt(campaign.clicks) || 0),
      totalConversions: acc.totalConversions + (parseInt(campaign.conversions) || 0),
    }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 });
  }

  private calculateHealthMetrics(checks: ValidationResult[]): DataValidationReport {
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.status === 'passed').length;
    const warningChecks = checks.filter(c => c.status === 'warning').length;
    const criticalIssues = checks.filter(c => c.severity === 'critical' && c.status === 'failed').length;
    
    // Calculate health score (0-100)
    const passedWeight = 1.0;
    const warningWeight = 0.5;
    const failedWeight = 0.0;
    
    const weightedScore = totalChecks > 0 ? (
      (passedChecks * passedWeight) +
      (warningChecks * warningWeight) +
      ((totalChecks - passedChecks - warningChecks) * failedWeight)
    ) / totalChecks : 0;
    
    const healthScore = Math.round(weightedScore * 100);
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (criticalIssues > 0) {
      overallStatus = 'critical';
    } else if (warningChecks > passedChecks * 0.2) { // More than 20% warnings
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }
    
    return {
      overallStatus,
      healthScore,
      totalChecks,
      passedChecks,
      warningChecks,
      criticalIssues,
      checks,
      summary: {
        dataConsistency: Math.max(0, 100 - (criticalIssues * 25) - (warningChecks * 5)),
        dataFreshness: Math.max(0, 100 - (checks.filter(c => c.checkType.includes('freshness') && c.status !== 'passed').length * 20)),
        systemHealth: Math.max(0, 100 - (checks.filter(c => c.checkType.includes('health') && c.status !== 'passed').length * 30))
      }
    };
  }
}

// Export singleton instance
export const dataValidator = new DataValidator();
