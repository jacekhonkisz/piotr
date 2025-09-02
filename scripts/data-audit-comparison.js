#!/usr/bin/env node

/**
 * DATA AUDIT & COMPARISON SCRIPT
 * 
 * This script audits and compares data between reports and database storage
 * to ensure data consistency and identify any discrepancies.
 * 
 * The reports are considered the "source of truth" as specified.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class DataAuditComparison {
  constructor() {
    this.auditResults = {
      summary: {
        totalClientsAudited: 0,
        totalPeriodsChecked: 0,
        discrepanciesFound: 0,
        criticalIssues: 0,
        warningIssues: 0,
        passedChecks: 0
      },
      clientResults: [],
      systemIssues: [],
      recommendations: []
    };
  }

  async runFullAudit() {
    console.log('🔍 Starting comprehensive data audit...\n');
    
    try {
      // 1. Get all active clients
      const clients = await this.getActiveClients();
      console.log(`📊 Found ${clients.length} active clients to audit\n`);
      
      // 2. Audit each client's data
      for (const client of clients) {
        console.log(`🔍 Auditing client: ${client.name} (${client.email})`);
        await this.auditClientData(client);
      }
      
      // 3. Check system-wide data integrity
      await this.checkSystemIntegrity();
      
      // 4. Generate final report
      await this.generateAuditReport();
      
    } catch (error) {
      console.error('❌ Audit failed:', error);
      throw error;
    }
  }

  async getActiveClients() {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token, google_ads_enabled')
      .neq('meta_access_token', null)
      .limit(50); // Limit for performance
    
    if (error) throw error;
    return clients || [];
  }

  async auditClientData(client) {
    const clientResult = {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      periodsChecked: 0,
      discrepancies: [],
      warnings: [],
      passed: [],
      summary: {
        totalDiscrepancies: 0,
        criticalIssues: 0,
        warningIssues: 0,
        dataConsistency: 'UNKNOWN'
      }
    };

    try {
      // Check last 6 months of data
      const periods = this.generatePeriods(6);
      
      for (const period of periods) {
        console.log(`  📅 Checking period: ${period.start} to ${period.end}`);
        
        const periodAudit = await this.auditPeriodData(client, period);
        clientResult.periodsChecked++;
        
        if (periodAudit.discrepancies.length > 0) {
          clientResult.discrepancies.push(...periodAudit.discrepancies);
        }
        
        if (periodAudit.warnings.length > 0) {
          clientResult.warnings.push(...periodAudit.warnings);
        }
        
        if (periodAudit.passed.length > 0) {
          clientResult.passed.push(...periodAudit.passed);
        }
      }
      
      // Calculate client summary
      clientResult.summary.totalDiscrepancies = clientResult.discrepancies.length;
      clientResult.summary.criticalIssues = clientResult.discrepancies.filter(d => d.severity === 'CRITICAL').length;
      clientResult.summary.warningIssues = clientResult.warnings.length;
      
      // Determine data consistency rating
      if (clientResult.summary.criticalIssues > 0) {
        clientResult.summary.dataConsistency = 'POOR';
      } else if (clientResult.summary.warningIssues > 3) {
        clientResult.summary.dataConsistency = 'FAIR';
      } else if (clientResult.summary.warningIssues > 0) {
        clientResult.summary.dataConsistency = 'GOOD';
      } else {
        clientResult.summary.dataConsistency = 'EXCELLENT';
      }
      
      console.log(`  ✅ Client audit complete: ${clientResult.summary.dataConsistency} consistency\n`);
      
    } catch (error) {
      console.error(`  ❌ Error auditing client ${client.name}:`, error);
      clientResult.discrepancies.push({
        type: 'AUDIT_ERROR',
        severity: 'CRITICAL',
        description: `Failed to audit client data: ${error.message}`,
        period: 'ALL',
        timestamp: new Date().toISOString()
      });
    }

    this.auditResults.clientResults.push(clientResult);
    this.updateGlobalSummary(clientResult);
  }

  async auditPeriodData(client, period) {
    const result = {
      period: `${period.start} to ${period.end}`,
      discrepancies: [],
      warnings: [],
      passed: []
    };

    try {
      // 1. Get report data (source of truth)
      const reportData = await this.getReportData(client.id, period);
      
      // 2. Get database stored data
      const dbData = await this.getDatabaseData(client.id, period);
      
      // 3. Get cache data if available
      const cacheData = await this.getCacheData(client.id, period);
      
      // 4. Compare all data sources
      await this.compareDataSources(result, reportData, dbData, cacheData, period);
      
    } catch (error) {
      result.discrepancies.push({
        type: 'DATA_FETCH_ERROR',
        severity: 'CRITICAL',
        description: `Failed to fetch data for comparison: ${error.message}`,
        period: result.period,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  }

  async getReportData(clientId, period) {
    // Check generated_reports table first (new system)
    const { data: generatedReport } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_start', period.start)
      .eq('period_end', period.end)
      .maybeSingle();

    if (generatedReport) {
      return {
        source: 'generated_reports',
        data: {
          totalSpend: generatedReport.total_spend,
          totalImpressions: generatedReport.total_impressions,
          totalClicks: generatedReport.total_clicks,
          totalConversions: generatedReport.total_conversions,
          ctr: generatedReport.ctr,
          cpc: generatedReport.cpc,
          cpm: generatedReport.cpm,
          cpa: generatedReport.cpa
        },
        metadata: {
          generatedAt: generatedReport.generated_at,
          status: generatedReport.status
        }
      };
    }

    // Fallback to reports table (legacy system)
    const { data: legacyReport } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', clientId)
      .eq('date_range_start', period.start)
      .eq('date_range_end', period.end)
      .maybeSingle();

    if (legacyReport) {
      // Get associated campaign data
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientId)
        .eq('date_range_start', period.start)
        .eq('date_range_end', period.end);

      const totals = this.calculateTotalsFromCampaigns(campaigns || []);
      
      return {
        source: 'reports',
        data: totals,
        metadata: {
          generatedAt: legacyReport.generated_at,
          reportId: legacyReport.id,
          campaignCount: campaigns?.length || 0
        }
      };
    }

    return null;
  }

  async getDatabaseData(clientId, period) {
    // Check campaign_summaries table
    const summaryType = this.determineSummaryType(period);
    
    const { data: summary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_date', period.start)
      .eq('summary_type', summaryType)
      .maybeSingle();

    if (summary) {
      return {
        source: 'campaign_summaries',
        data: {
          totalSpend: summary.total_spend,
          totalImpressions: summary.total_impressions,
          totalClicks: summary.total_clicks,
          totalConversions: summary.total_conversions,
          ctr: summary.average_ctr,
          cpc: summary.average_cpc,
          cpa: summary.average_cpa,
          // Conversion metrics
          clickToCall: summary.click_to_call,
          emailContacts: summary.email_contacts,
          bookingStep1: summary.booking_step_1,
          reservations: summary.reservations,
          reservationValue: summary.reservation_value,
          bookingStep2: summary.booking_step_2,
          roas: summary.roas,
          costPerReservation: summary.cost_per_reservation
        },
        metadata: {
          lastUpdated: summary.last_updated,
          dataSource: summary.data_source,
          activeCampaigns: summary.active_campaigns,
          totalCampaigns: summary.total_campaigns
        }
      };
    }

    // Fallback to daily_kpi_data aggregation
    const { data: dailyKpis } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', period.start)
      .lte('date', period.end);

    if (dailyKpis && dailyKpis.length > 0) {
      const aggregated = this.aggregateDailyKpis(dailyKpis);
      return {
        source: 'daily_kpi_data',
        data: aggregated,
        metadata: {
          daysCount: dailyKpis.length,
          lastUpdated: Math.max(...dailyKpis.map(d => new Date(d.last_updated).getTime()))
        }
      };
    }

    return null;
  }

  async getCacheData(clientId, period) {
    // Check current_month_cache for current month data
    if (this.isCurrentMonth(period)) {
      const periodId = `${new Date(period.start).getFullYear()}-${String(new Date(period.start).getMonth() + 1).padStart(2, '0')}`;
      
      const { data: cache } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', periodId)
        .maybeSingle();

      if (cache && cache.cache_data) {
        return {
          source: 'current_month_cache',
          data: {
            totalSpend: cache.cache_data.stats?.totalSpend,
            totalImpressions: cache.cache_data.stats?.totalImpressions,
            totalClicks: cache.cache_data.stats?.totalClicks,
            totalConversions: cache.cache_data.stats?.totalConversions,
            ctr: cache.cache_data.stats?.averageCtr,
            cpc: cache.cache_data.stats?.averageCpc,
            // Conversion metrics
            clickToCall: cache.cache_data.conversionMetrics?.click_to_call,
            emailContacts: cache.cache_data.conversionMetrics?.email_contacts,
            bookingStep1: cache.cache_data.conversionMetrics?.booking_step_1,
            reservations: cache.cache_data.conversionMetrics?.reservations,
            reservationValue: cache.cache_data.conversionMetrics?.reservation_value,
            roas: cache.cache_data.conversionMetrics?.roas,
            costPerReservation: cache.cache_data.conversionMetrics?.cost_per_reservation
          },
          metadata: {
            lastUpdated: cache.last_updated,
            cacheAge: Date.now() - new Date(cache.last_updated).getTime(),
            campaignCount: cache.cache_data.campaigns?.length || 0
          }
        };
      }
    }

    return null;
  }

  async compareDataSources(result, reportData, dbData, cacheData, period) {
    const tolerance = 0.01; // 1% tolerance for floating point comparisons
    
    // If no report data, this is a warning (missing source of truth)
    if (!reportData) {
      result.warnings.push({
        type: 'MISSING_REPORT_DATA',
        description: `No report data found for period ${period.start} to ${period.end}`,
        period: result.period,
        severity: 'WARNING',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Compare report data with database data
    if (dbData) {
      const dbComparison = this.compareMetrics(reportData.data, dbData.data, tolerance);
      
      if (dbComparison.discrepancies.length > 0) {
        result.discrepancies.push({
          type: 'REPORT_DB_MISMATCH',
          severity: 'CRITICAL',
          description: `Report data doesn't match database data`,
          details: dbComparison.discrepancies,
          period: result.period,
          reportSource: reportData.source,
          dbSource: dbData.source,
          timestamp: new Date().toISOString()
        });
      } else {
        result.passed.push({
          type: 'REPORT_DB_MATCH',
          description: `Report and database data match within tolerance`,
          period: result.period,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Compare report data with cache data
    if (cacheData) {
      const cacheComparison = this.compareMetrics(reportData.data, cacheData.data, tolerance);
      
      if (cacheComparison.discrepancies.length > 0) {
        result.discrepancies.push({
          type: 'REPORT_CACHE_MISMATCH',
          severity: 'HIGH',
          description: `Report data doesn't match cache data`,
          details: cacheComparison.discrepancies,
          period: result.period,
          reportSource: reportData.source,
          cacheSource: cacheData.source,
          cacheAge: cacheData.metadata.cacheAge,
          timestamp: new Date().toISOString()
        });
      } else {
        result.passed.push({
          type: 'REPORT_CACHE_MATCH',
          description: `Report and cache data match within tolerance`,
          period: result.period,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Compare database and cache data if both exist
    if (dbData && cacheData) {
      const dbCacheComparison = this.compareMetrics(dbData.data, cacheData.data, tolerance);
      
      if (dbCacheComparison.discrepancies.length > 0) {
        result.warnings.push({
          type: 'DB_CACHE_MISMATCH',
          description: `Database and cache data don't match`,
          details: dbCacheComparison.discrepancies,
          period: result.period,
          severity: 'WARNING',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  compareMetrics(source1, source2, tolerance = 0.01) {
    const discrepancies = [];
    const metricsToCompare = [
      'totalSpend', 'totalImpressions', 'totalClicks', 'totalConversions',
      'ctr', 'cpc', 'cpa', 'clickToCall', 'emailContacts', 'bookingStep1',
      'reservations', 'reservationValue', 'roas', 'costPerReservation'
    ];

    for (const metric of metricsToCompare) {
      const val1 = parseFloat(source1[metric] || 0);
      const val2 = parseFloat(source2[metric] || 0);
      
      if (val1 === 0 && val2 === 0) continue; // Both zero is fine
      
      const percentDiff = Math.abs(val1 - val2) / Math.max(val1, val2, 1);
      
      if (percentDiff > tolerance) {
        discrepancies.push({
          metric,
          source1Value: val1,
          source2Value: val2,
          percentageDifference: (percentDiff * 100).toFixed(2) + '%',
          absoluteDifference: Math.abs(val1 - val2)
        });
      }
    }

    return { discrepancies };
  }

  async checkSystemIntegrity() {
    console.log('🔍 Checking system-wide data integrity...\n');
    
    try {
      // Check for orphaned records
      await this.checkOrphanedRecords();
      
      // Check for data consistency across tables
      await this.checkCrossTableConsistency();
      
      // Check for stale cache entries
      await this.checkStaleCacheEntries();
      
    } catch (error) {
      console.error('❌ System integrity check failed:', error);
      this.auditResults.systemIssues.push({
        type: 'SYSTEM_CHECK_ERROR',
        severity: 'CRITICAL',
        description: `System integrity check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkOrphanedRecords() {
    // Check for campaigns without clients
    const { data: orphanedCampaigns } = await supabase
      .from('campaigns')
      .select('id, client_id')
      .not('client_id', 'in', `(SELECT id FROM clients)`);

    if (orphanedCampaigns && orphanedCampaigns.length > 0) {
      this.auditResults.systemIssues.push({
        type: 'ORPHANED_CAMPAIGNS',
        severity: 'HIGH',
        description: `Found ${orphanedCampaigns.length} orphaned campaign records`,
        count: orphanedCampaigns.length,
        timestamp: new Date().toISOString()
      });
    }

    // Check for reports without clients
    const { data: orphanedReports } = await supabase
      .from('reports')
      .select('id, client_id')
      .not('client_id', 'in', `(SELECT id FROM clients)`);

    if (orphanedReports && orphanedReports.length > 0) {
      this.auditResults.systemIssues.push({
        type: 'ORPHANED_REPORTS',
        severity: 'HIGH',
        description: `Found ${orphanedReports.length} orphaned report records`,
        count: orphanedReports.length,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkStaleCacheEntries() {
    const staleCacheThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    const staleDate = new Date(Date.now() - staleCacheThreshold);

    const { data: staleCache } = await supabase
      .from('current_month_cache')
      .select('id, client_id, last_updated')
      .lt('last_updated', staleDate.toISOString());

    if (staleCache && staleCache.length > 0) {
      this.auditResults.systemIssues.push({
        type: 'STALE_CACHE_ENTRIES',
        severity: 'MEDIUM',
        description: `Found ${staleCache.length} stale cache entries older than 7 days`,
        count: staleCache.length,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkCrossTableConsistency() {
    // Check if campaign_summaries totals match individual campaign records
    const { data: summaries } = await supabase
      .from('campaign_summaries')
      .select('*')
      .limit(10); // Sample check

    for (const summary of summaries || []) {
      if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
        const calculatedTotals = this.calculateTotalsFromCampaigns(summary.campaign_data);
        
        const tolerance = 0.01;
        const spendDiff = Math.abs(calculatedTotals.totalSpend - summary.total_spend) / Math.max(calculatedTotals.totalSpend, summary.total_spend, 1);
        
        if (spendDiff > tolerance) {
          this.auditResults.systemIssues.push({
            type: 'SUMMARY_CALCULATION_ERROR',
            severity: 'HIGH',
            description: `Campaign summary totals don't match calculated values`,
            summaryId: summary.id,
            clientId: summary.client_id,
            calculatedSpend: calculatedTotals.totalSpend,
            storedSpend: summary.total_spend,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  // Helper methods
  generatePeriods(monthsBack) {
    const periods = [];
    const now = new Date();
    
    for (let i = 0; i < monthsBack; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = date.toISOString().split('T')[0];
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      
      periods.push({ start, end, type: 'monthly' });
    }
    
    return periods;
  }

  determineSummaryType(period) {
    const start = new Date(period.start);
    const end = new Date(period.end);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    return daysDiff <= 7 ? 'weekly' : 'monthly';
  }

  isCurrentMonth(period) {
    const now = new Date();
    const periodStart = new Date(period.start);
    
    return periodStart.getFullYear() === now.getFullYear() && 
           periodStart.getMonth() === now.getMonth();
  }

  calculateTotalsFromCampaigns(campaigns) {
    return campaigns.reduce((acc, campaign) => ({
      totalSpend: acc.totalSpend + (parseFloat(campaign.spend) || 0),
      totalImpressions: acc.totalImpressions + (parseInt(campaign.impressions) || 0),
      totalClicks: acc.totalClicks + (parseInt(campaign.clicks) || 0),
      totalConversions: acc.totalConversions + (parseInt(campaign.conversions) || 0),
    }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 });
  }

  aggregateDailyKpis(dailyKpis) {
    return dailyKpis.reduce((acc, day) => ({
      totalSpend: acc.totalSpend + (parseFloat(day.total_spend) || 0),
      totalImpressions: acc.totalImpressions + (parseInt(day.total_impressions) || 0),
      totalClicks: acc.totalClicks + (parseInt(day.total_clicks) || 0),
      totalConversions: acc.totalConversions + (parseInt(day.total_conversions) || 0),
      clickToCall: acc.clickToCall + (parseInt(day.click_to_call) || 0),
      emailContacts: acc.emailContacts + (parseInt(day.email_contacts) || 0),
      bookingStep1: acc.bookingStep1 + (parseInt(day.booking_step_1) || 0),
      reservations: acc.reservations + (parseInt(day.reservations) || 0),
      reservationValue: acc.reservationValue + (parseFloat(day.reservation_value) || 0),
      bookingStep2: acc.bookingStep2 + (parseInt(day.booking_step_2) || 0),
    }), {
      totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0,
      clickToCall: 0, emailContacts: 0, bookingStep1: 0, reservations: 0,
      reservationValue: 0, bookingStep2: 0
    });
  }

  updateGlobalSummary(clientResult) {
    this.auditResults.summary.totalClientsAudited++;
    this.auditResults.summary.totalPeriodsChecked += clientResult.periodsChecked;
    this.auditResults.summary.discrepanciesFound += clientResult.summary.totalDiscrepancies;
    this.auditResults.summary.criticalIssues += clientResult.summary.criticalIssues;
    this.auditResults.summary.warningIssues += clientResult.summary.warningIssues;
    this.auditResults.summary.passedChecks += clientResult.passed.length;
  }

  async generateAuditReport() {
    console.log('\n📋 GENERATING COMPREHENSIVE AUDIT REPORT...\n');
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Create report content
    const reportContent = this.formatAuditReport();
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `DATA_AUDIT_REPORT_${timestamp}.md`;
    
    const fs = require('fs');
    fs.writeFileSync(filename, reportContent);
    
    console.log(`📄 Audit report saved to: ${filename}`);
    console.log('\n🎯 AUDIT SUMMARY:');
    console.log(`   Clients Audited: ${this.auditResults.summary.totalClientsAudited}`);
    console.log(`   Periods Checked: ${this.auditResults.summary.totalPeriodsChecked}`);
    console.log(`   Discrepancies Found: ${this.auditResults.summary.discrepanciesFound}`);
    console.log(`   Critical Issues: ${this.auditResults.summary.criticalIssues}`);
    console.log(`   Warning Issues: ${this.auditResults.summary.warningIssues}`);
    console.log(`   Passed Checks: ${this.auditResults.summary.passedChecks}`);
    
    // Determine overall health
    const healthScore = this.calculateHealthScore();
    console.log(`   Overall Health: ${healthScore.rating} (${healthScore.score}%)\n`);
    
    return {
      filename,
      results: this.auditResults,
      healthScore
    };
  }

  generateRecommendations() {
    const { summary, clientResults, systemIssues } = this.auditResults;
    
    // Critical issues recommendations
    if (summary.criticalIssues > 0) {
      this.auditResults.recommendations.push({
        priority: 'HIGH',
        category: 'DATA_INTEGRITY',
        title: 'Fix Critical Data Discrepancies',
        description: `Found ${summary.criticalIssues} critical data discrepancies that need immediate attention`,
        action: 'Review and fix all CRITICAL severity issues in the detailed results'
      });
    }
    
    // System issues recommendations
    if (systemIssues.length > 0) {
      this.auditResults.recommendations.push({
        priority: 'MEDIUM',
        category: 'SYSTEM_MAINTENANCE',
        title: 'Address System Issues',
        description: `Found ${systemIssues.length} system-level issues`,
        action: 'Review and resolve orphaned records, stale cache entries, and missing indexes'
      });
    }
    
    // Performance recommendations
    if (summary.warningIssues > summary.passedChecks * 0.1) {
      this.auditResults.recommendations.push({
        priority: 'MEDIUM',
        category: 'PERFORMANCE',
        title: 'Improve Data Consistency',
        description: 'High number of warnings indicates potential data consistency issues',
        action: 'Implement automated data validation and cache refresh mechanisms'
      });
    }
    
    // Best practices recommendations
    this.auditResults.recommendations.push({
      priority: 'LOW',
      category: 'BEST_PRACTICES',
      title: 'Implement Regular Audits',
      description: 'Schedule regular data audits to maintain data quality',
      action: 'Set up automated weekly/monthly data audits using this script'
    });
  }

  calculateHealthScore() {
    const { summary } = this.auditResults;
    const totalChecks = summary.passedChecks + summary.discrepanciesFound + summary.warningIssues;
    
    if (totalChecks === 0) return { score: 0, rating: 'UNKNOWN' };
    
    // Calculate weighted score
    const passedWeight = 1.0;
    const warningWeight = 0.5;
    const criticalWeight = 0.0;
    
    const weightedScore = (
      (summary.passedChecks * passedWeight) +
      (summary.warningIssues * warningWeight) +
      (summary.criticalIssues * criticalWeight)
    ) / totalChecks;
    
    const score = Math.round(weightedScore * 100);
    
    let rating;
    if (score >= 95) rating = 'EXCELLENT';
    else if (score >= 85) rating = 'GOOD';
    else if (score >= 70) rating = 'FAIR';
    else if (score >= 50) rating = 'POOR';
    else rating = 'CRITICAL';
    
    return { score, rating };
  }

  formatAuditReport() {
    const timestamp = new Date().toISOString();
    const healthScore = this.calculateHealthScore();
    
    return `# 📊 DATA AUDIT & COMPARISON REPORT

**Generated**: ${timestamp}  
**Overall Health**: ${healthScore.rating} (${healthScore.score}%)  
**Status**: ${healthScore.score >= 85 ? '✅ HEALTHY' : healthScore.score >= 70 ? '⚠️ NEEDS ATTENTION' : '❌ CRITICAL ISSUES'}

---

## 🎯 EXECUTIVE SUMMARY

This audit compared data between reports (source of truth) and database storage to identify discrepancies and ensure data consistency across the system.

### Key Findings:
- **Clients Audited**: ${this.auditResults.summary.totalClientsAudited}
- **Periods Checked**: ${this.auditResults.summary.totalPeriodsChecked}
- **Total Discrepancies**: ${this.auditResults.summary.discrepanciesFound}
- **Critical Issues**: ${this.auditResults.summary.criticalIssues}
- **Warning Issues**: ${this.auditResults.summary.warningIssues}
- **Passed Checks**: ${this.auditResults.summary.passedChecks}

---

## 🔍 DETAILED RESULTS

### Client-Level Results

${this.auditResults.clientResults.map(client => `
#### ${client.clientName} (${client.clientEmail})
- **Data Consistency**: ${client.summary.dataConsistency}
- **Periods Checked**: ${client.periodsChecked}
- **Critical Issues**: ${client.summary.criticalIssues}
- **Warnings**: ${client.summary.warningIssues}
- **Passed Checks**: ${client.passed.length}

${client.discrepancies.length > 0 ? `
**Critical Discrepancies:**
${client.discrepancies.map(d => `- ${d.type}: ${d.description} (${d.period})`).join('\n')}
` : ''}

${client.warnings.length > 0 ? `
**Warnings:**
${client.warnings.map(w => `- ${w.type}: ${w.description} (${w.period})`).join('\n')}
` : ''}
`).join('\n')}

### System-Level Issues

${this.auditResults.systemIssues.length > 0 ? 
  this.auditResults.systemIssues.map(issue => `
- **${issue.type}** (${issue.severity}): ${issue.description}
`).join('\n') : 
  'No system-level issues found ✅'
}

---

## 📋 RECOMMENDATIONS

${this.auditResults.recommendations.map(rec => `
### ${rec.priority} Priority: ${rec.title}
**Category**: ${rec.category}  
**Description**: ${rec.description}  
**Action**: ${rec.action}
`).join('\n')}

---

## 📊 DATA SOURCES ANALYZED

1. **Reports** (Source of Truth)
   - \`generated_reports\` table (new system)
   - \`reports\` + \`campaigns\` tables (legacy system)

2. **Database Storage**
   - \`campaign_summaries\` table (aggregated data)
   - \`daily_kpi_data\` table (daily metrics)

3. **Cache Systems**
   - \`current_month_cache\` table (3-hour cache)

---

## 🔧 TECHNICAL DETAILS

### Comparison Methodology
- **Tolerance**: 1% for floating-point comparisons
- **Metrics Compared**: Spend, Impressions, Clicks, Conversions, CTR, CPC, CPA, Conversion Metrics
- **Period Coverage**: Last 6 months per client
- **Data Sources**: Reports vs Database vs Cache

### Data Integrity Checks
- Orphaned records detection
- Cross-table consistency validation
- Stale cache identification
- Missing index analysis

---

## 📈 NEXT STEPS

1. **Immediate Actions** (Critical Issues)
   ${this.auditResults.summary.criticalIssues > 0 ? 
     '- Review and fix all critical data discrepancies\n   - Investigate root causes of data mismatches' : 
     '- No immediate actions required ✅'
   }

2. **Short-term Improvements** (Warning Issues)
   ${this.auditResults.summary.warningIssues > 0 ? 
     '- Address warning-level discrepancies\n   - Improve data validation processes' : 
     '- Monitor data consistency trends'
   }

3. **Long-term Enhancements**
   - Implement automated data validation
   - Set up regular audit scheduling
   - Enhance monitoring and alerting

---

**Report Generated by**: Data Audit & Comparison Script  
**Script Version**: 1.0.0  
**Timestamp**: ${timestamp}
`;
  }
}

// Main execution
async function main() {
  try {
    const auditor = new DataAuditComparison();
    const result = await auditor.runFullAudit();
    
    console.log('✅ Audit completed successfully!');
    if (result && result.filename) {
      console.log(`📄 Report saved: ${result.filename}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { DataAuditComparison };
