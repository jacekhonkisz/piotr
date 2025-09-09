/**
 * PRODUCTION DATA MANAGER
 * 
 * Handles the complete data lifecycle for production:
 * 1. Daily data collection and storage
 * 2. Monthly aggregation and summarization  
 * 3. Historical data preservation
 * 4. Intelligent data retrieval
 */

import { supabase } from './supabase';
import logger from './logger';

export interface ProductionDataConfig {
  dailyRetentionDays: number;    // How long to keep daily data (90 days)
  monthlyRetentionMonths: number; // How long to keep monthly summaries (24 months)
  aggregationSchedule: string;    // When to run monthly aggregation
}

export const PRODUCTION_CONFIG: ProductionDataConfig = {
  dailyRetentionDays: 90,        // Keep 90 days of daily data
  monthlyRetentionMonths: 24,    // Keep 24 months of summaries
  aggregationSchedule: '0 2 1 * *' // Run at 2 AM on 1st of each month
};

export class ProductionDataManager {
  
  /**
   * STEP 1: Enhanced Daily Data Collection
   * Stores raw daily metrics with proper retention
   */
  static async storeDailyMetrics(params: {
    clientId: string;
    date: string;
    platform: 'meta' | 'google';
    metrics: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      // Conversion funnel
      click_to_call: number;
      email_contacts: number;
      booking_step_1: number;
      booking_step_2: number;
      booking_step_3: number;
      reservations: number;
      reservation_value: number;
      reach: number;
    };
    campaigns: any[];
  }) {
    
    const { clientId, date, platform, metrics, campaigns } = params;
    
    logger.info('📊 Storing daily metrics for production:', {
      clientId,
      date,
      platform,
      spend: metrics.totalSpend,
      campaigns: campaigns.length
    });
    
    // Calculate derived metrics
    const averageCtr = metrics.totalImpressions > 0 
      ? (metrics.totalClicks / metrics.totalImpressions) * 100 
      : 0;
    const averageCpc = metrics.totalClicks > 0 
      ? metrics.totalSpend / metrics.totalClicks 
      : 0;
    const roas = metrics.totalSpend > 0 && metrics.reservation_value > 0
      ? metrics.reservation_value / metrics.totalSpend
      : 0;
    const cost_per_reservation = metrics.reservations > 0 && metrics.totalSpend > 0
      ? metrics.totalSpend / metrics.reservations
      : 0;
    
    // Store in daily_kpi_data with upsert
    const { data, error } = await supabase
      .from('daily_kpi_data')
      .upsert({
        client_id: clientId,
        date,
        data_source: platform === 'meta' ? 'meta_api' : 'google_ads_api',
        
        // Core metrics
        total_spend: metrics.totalSpend,
        total_impressions: metrics.totalImpressions,
        total_clicks: metrics.totalClicks,
        total_conversions: metrics.totalConversions,
        
        // Conversion funnel
        click_to_call: metrics.click_to_call,
        email_contacts: metrics.email_contacts,
        booking_step_1: metrics.booking_step_1,
        booking_step_2: metrics.booking_step_2,
        booking_step_3: metrics.booking_step_3,
        reservations: metrics.reservations,
        reservation_value: metrics.reservation_value,
        reach: metrics.reach,
        
        // Calculated metrics
        average_ctr: averageCtr,
        average_cpc: averageCpc,
        roas,
        cost_per_reservation,
        
        // Metadata
        campaigns_count: campaigns.length,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,date,data_source'
      });
    
    if (error) {
      logger.error('❌ Failed to store daily metrics:', error);
      throw error;
    }
    
    logger.info('✅ Daily metrics stored successfully');
    return data;
  }
  
  /**
   * STEP 2: Monthly Data Aggregation
   * Creates monthly summaries from daily data before cleanup
   */
  static async generateMonthlySummary(params: {
    clientId: string;
    year: number;
    month: number;
    platform: 'meta' | 'google';
  }) {
    
    const { clientId, year, month, platform } = params;
    
    // Calculate date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
    
    logger.info('📊 Generating monthly summary:', {
      clientId,
      year,
      month,
      platform,
      dateRange: `${startDate} to ${endDate}`
    });
    
    // Get all daily records for the month
    const dataSource = platform === 'meta' ? 'meta_api' : 'google_ads_api';
    
    const { data: dailyRecords, error } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('data_source', dataSource)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    
    if (error) {
      logger.error('❌ Failed to fetch daily records:', error);
      throw error;
    }
    
    if (!dailyRecords || dailyRecords.length === 0) {
      logger.warn('⚠️ No daily records found for monthly summary');
      return null;
    }
    
    logger.info(`📊 Aggregating ${dailyRecords.length} daily records`);
    
    // Aggregate all metrics
    const totals = dailyRecords.reduce((acc, record) => ({
      total_spend: acc.total_spend + (record.total_spend || 0),
      total_impressions: acc.total_impressions + (record.total_impressions || 0),
      total_clicks: acc.total_clicks + (record.total_clicks || 0),
      total_conversions: acc.total_conversions + (record.total_conversions || 0),
      click_to_call: acc.click_to_call + (record.click_to_call || 0),
      email_contacts: acc.email_contacts + (record.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + ((record as any).booking_step_3 || 0),
      reservations: acc.reservations + ((record as any).reservations || 0),
      reservation_value: acc.reservation_value + ((record as any).reservation_value || 0),
      reach: acc.reach + ((record as any).reach || 0),
      campaigns_count: Math.max(acc.campaigns_count, record.campaigns_count || 0)
    }), {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      reach: 0,
      campaigns_count: 0
    });
    
    // Calculate averages and derived metrics
    const average_ctr = totals.total_impressions > 0 
      ? (totals.total_clicks / totals.total_impressions) * 100 
      : 0;
    const average_cpc = totals.total_clicks > 0 
      ? totals.total_spend / totals.total_clicks 
      : 0;
    const roas = totals.total_spend > 0 && totals.reservation_value > 0
      ? totals.reservation_value / totals.total_spend
      : 0;
    const cost_per_reservation = totals.reservations > 0 && totals.total_spend > 0
      ? totals.total_spend / totals.reservations
      : 0;
    
    // Create conversion metrics object
    const conversionMetrics = {
      click_to_call: totals.click_to_call,
      email_contacts: totals.email_contacts,
      booking_step_1: totals.booking_step_1,
      booking_step_2: totals.booking_step_2,
      booking_step_3: totals.booking_step_3,
      reservations: totals.reservations,
      reservation_value: totals.reservation_value,
      roas,
      cost_per_reservation,
      reach: totals.reach
    };
    
    // Store monthly summary
    const { data: summary, error: summaryError } = await supabase
      .from('campaign_summaries')
      .upsert({
        client_id: clientId,
        summary_type: 'monthly',
        summary_date: startDate,
        platform,
        
        // Aggregated metrics
        total_spend: totals.total_spend,
        total_impressions: totals.total_impressions,
        total_clicks: totals.total_clicks,
        total_conversions: totals.total_conversions,
        average_ctr,
        average_cpc,
        
        // Conversion metrics
        click_to_call: totals.click_to_call,
        email_contacts: totals.email_contacts,
        booking_step_1: totals.booking_step_1,
        booking_step_2: totals.booking_step_2,
        booking_step_3: totals.booking_step_3,
        reservations: totals.reservations,
        reservation_value: totals.reservation_value,
        roas,
        cost_per_reservation,
        reach: totals.reach,
        
        // Metadata
        active_campaigns: totals.campaigns_count,
        total_campaigns: totals.campaigns_count,
        data_source: `${platform}_api`,
        
        // Store detailed conversion metrics as JSON
        conversion_metrics: conversionMetrics,
        
        // Store daily breakdown for detailed analysis
        campaign_data: dailyRecords,
        
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });
    
    if (summaryError) {
      logger.error('❌ Failed to store monthly summary:', summaryError);
      throw summaryError;
    }
    
    logger.info('✅ Monthly summary generated successfully:', {
      spend: totals.total_spend,
      impressions: totals.total_impressions,
      reservations: totals.reservations,
      daysIncluded: dailyRecords.length
    });
    
    return summary;
  }
  
  /**
   * STEP 3: Intelligent Data Cleanup
   * Removes old daily data while preserving monthly summaries
   */
  static async cleanupOldData() {
    logger.info('🧹 Starting production data cleanup...');
    
    // Calculate cutoff dates
    const now = new Date();
    const dailyCutoff = new Date(now);
    dailyCutoff.setDate(dailyCutoff.getDate() - PRODUCTION_CONFIG.dailyRetentionDays);
    
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - PRODUCTION_CONFIG.monthlyRetentionMonths);
    
    const dailyCutoffStr = dailyCutoff.toISOString().split('T')[0];
    const monthlyCutoffStr = monthlyCutoff.toISOString().split('T')[0];
    
    logger.info('🗑️ Cleanup cutoff dates:', {
      dailyCutoff: dailyCutoffStr,
      monthlyCutoff: monthlyCutoffStr
    });
    
    // 1. Clean up old daily data (keep last 90 days)
    const { data: deletedDaily, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .delete()
      .lt('date', dailyCutoffStr)
      .select('date, client_id');
    
    if (dailyError) {
      logger.error('❌ Failed to cleanup daily data:', dailyError);
    } else {
      const deletedDailyCount = deletedDaily?.length || 0;
      logger.info(`✅ Cleaned up ${deletedDailyCount} old daily records`);
    }
    
    // 2. Clean up old monthly summaries (keep last 24 months)
    const { data: deletedMonthly, error: monthlyError } = await supabase
      .from('campaign_summaries')
      .delete()
      .eq('summary_type', 'monthly')
      .lt('summary_date', monthlyCutoffStr)
      .select('summary_date, client_id');
    
    if (monthlyError) {
      logger.error('❌ Failed to cleanup monthly data:', monthlyError);
    } else {
      const deletedMonthlyCount = deletedMonthly?.length || 0;
      logger.info(`✅ Cleaned up ${deletedMonthlyCount} old monthly summaries`);
    }
    
    return {
      dailyDeleted: deletedDaily?.length || 0,
      monthlyDeleted: deletedMonthly?.length || 0
    };
  }
  
  /**
   * STEP 4: Production Data Retrieval
   * Intelligent data fetching with proper fallbacks
   */
  static async getProductionData(params: {
    clientId: string;
    dateRange: { start: string; end: string };
    platform: 'meta' | 'google';
  }) {
    
    const { clientId, dateRange, platform } = params;
    
    logger.info('📊 Production data retrieval:', {
      clientId,
      dateRange,
      platform
    });
    
    // Determine data strategy based on date range
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const now = new Date();
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const isRecent = start >= new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // Within 90 days
    const isMonthly = daysDiff > 7;
    
    logger.info('📊 Data strategy:', {
      daysDiff,
      isRecent,
      isMonthly,
      strategy: isRecent ? 'DAILY_DATA' : 'MONTHLY_SUMMARIES'
    });
    
    if (isRecent && daysDiff <= 7) {
      // Use daily data for recent periods
      return await this.getFromDailyData(clientId, dateRange, platform);
    } else if (isMonthly) {
      // Use monthly summaries for longer periods
      return await this.getFromMonthlySummaries(clientId, dateRange, platform);
    } else {
      // Use daily data for recent weekly periods
      return await this.getFromDailyData(clientId, dateRange, platform);
    }
  }
  
  private static async getFromDailyData(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: 'meta' | 'google'
  ) {
    const dataSource = platform === 'meta' ? 'meta_api' : 'google_ads_api';
    
    const { data: dailyRecords, error } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('data_source', dataSource)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });
    
    if (error || !dailyRecords || dailyRecords.length === 0) {
      logger.warn('⚠️ No daily data found');
      return { success: false, source: 'daily_data' };
    }
    
    logger.info(`📊 Aggregating ${dailyRecords.length} daily records`);
    
    // Aggregate daily records
    const totals = dailyRecords.reduce((acc, record) => ({
      totalSpend: acc.totalSpend + (record.total_spend || 0),
      totalImpressions: acc.totalImpressions + (record.total_impressions || 0),
      totalClicks: acc.totalClicks + (record.total_clicks || 0),
      totalConversions: acc.totalConversions + (record.total_conversions || 0),
      click_to_call: acc.click_to_call + (record.click_to_call || 0),
      email_contacts: acc.email_contacts + (record.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + ((record as any).booking_step_3 || 0),
      reservations: acc.reservations + ((record as any).reservations || 0),
      reservation_value: acc.reservation_value + ((record as any).reservation_value || 0),
      reach: acc.reach + ((record as any).reach || 0)
    }), {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      reach: 0
    });
    
    // Calculate derived metrics
    const averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
    const averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
    const roas = totals.totalSpend > 0 && totals.reservation_value > 0 ? totals.reservation_value / totals.totalSpend : 0;
    const cost_per_reservation = totals.reservations > 0 && totals.totalSpend > 0 ? totals.totalSpend / totals.reservations : 0;
    
    // Create synthetic campaigns from daily data
    const syntheticCampaigns = dailyRecords.map((record, index) => ({
      id: `daily-${record.client_id}-${record.date}-${index}`,
      campaign_id: `daily-campaign-${record.date}`,
      campaign_name: `Daily Data ${record.date}`,
      spend: record.total_spend || 0,
      impressions: record.total_impressions || 0,
      clicks: record.total_clicks || 0,
      conversions: record.total_conversions || 0,
      ctr: record.total_impressions > 0 ? ((record.total_clicks || 0) / record.total_impressions) * 100 : 0,
      cpc: record.total_clicks > 0 ? (record.total_spend || 0) / record.total_clicks : 0,
      date_start: record.date,
      date_stop: record.date,
      // Conversion metrics
      click_to_call: record.click_to_call || 0,
      email_contacts: record.email_contacts || 0,
      booking_step_1: record.booking_step_1 || 0,
      booking_step_2: record.booking_step_2 || 0,
      booking_step_3: (record as any).booking_step_3 || 0,
      reservations: (record as any).reservations || 0,
      reservation_value: (record as any).reservation_value || 0,
      reach: (record as any).reach || 0
    }));
    
    return {
      success: true,
      source: 'daily_data',
      data: {
        stats: {
          ...totals,
          averageCtr,
          averageCpc
        },
        conversionMetrics: {
          click_to_call: totals.click_to_call,
          email_contacts: totals.email_contacts,
          booking_step_1: totals.booking_step_1,
          booking_step_2: totals.booking_step_2,
          booking_step_3: totals.booking_step_3,
          reservations: totals.reservations,
          reservation_value: totals.reservation_value,
          roas,
          cost_per_reservation,
          reach: totals.reach
        },
        campaigns: syntheticCampaigns
      }
    };
  }
  
  private static async getFromMonthlySummaries(
    clientId: string,
    dateRange: { start: string; end: string },
    platform: 'meta' | 'google'
  ) {
    // Get monthly summary for the period
    const { data: summary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', platform)
      .eq('summary_date', dateRange.start)
      .single();
    
    if (error || !summary) {
      logger.warn('⚠️ No monthly summary found');
      return { success: false, source: 'monthly_summaries' };
    }
    
    return {
      success: true,
      source: 'monthly_summaries',
      data: {
        stats: {
          totalSpend: summary.total_spend || 0,
          totalImpressions: summary.total_impressions || 0,
          totalClicks: summary.total_clicks || 0,
          totalConversions: summary.total_conversions || 0,
          averageCtr: summary.average_ctr || 0,
          averageCpc: summary.average_cpc || 0
        },
        conversionMetrics: (summary as any).conversion_metrics || {},
        campaigns: summary.campaign_data || []
      }
    };
  }
}
