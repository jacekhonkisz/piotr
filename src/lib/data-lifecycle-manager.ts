import { createClient } from '@supabase/supabase-js';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DataLifecycleManager {
  private static instance: DataLifecycleManager;

  public static getInstance(): DataLifecycleManager {
    if (!DataLifecycleManager.instance) {
      DataLifecycleManager.instance = new DataLifecycleManager();
    }
    return DataLifecycleManager.instance;
  }

  /**
   * Archive completed current month data to permanent storage
   * This runs when a month ends to preserve the cached data
   */
  async archiveCompletedMonths(): Promise<void> {
    logger.info('📅 Starting monthly data archival process...');
    
    try {
      // Get current date info
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Get previous month info
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const prevMonthPeriodId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      
      logger.info(`📊 Archiving completed month: ${prevMonthPeriodId}`);
      
      // Get all clients with cache data for the previous month
      const { data: cacheData, error: cacheError } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('period_id', prevMonthPeriodId);
      
      if (cacheError) {
        throw new Error(`Failed to fetch month cache data: ${cacheError.message}`);
      }
      
      if (!cacheData || cacheData.length === 0) {
        logger.info('📝 No monthly cache data found to archive');
        return;
      }
      
      logger.info(`📦 Found ${cacheData.length} monthly cache entries to archive`);
      
      // Archive each cache entry to campaign_summaries
      let archivedCount = 0;
      let errorCount = 0;
      
      for (const cacheEntry of cacheData) {
        try {
          await this.archiveMonthlyData(cacheEntry);
          archivedCount++;
        } catch (error) {
          logger.error(`❌ Failed to archive monthly data for client ${cacheEntry.client_id}:`, error);
          errorCount++;
        }
      }
      
      logger.info(`✅ Monthly archival completed: ${archivedCount} archived, ${errorCount} errors`);
      
      // Clean up archived cache entries
      if (archivedCount > 0) {
        await this.cleanupArchivedMonthlyCache(prevMonthPeriodId);
      }
      
    } catch (error) {
      logger.error('❌ Monthly data archival failed:', error);
      logger.error('Monthly data archival failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Archive completed current week data to permanent storage
   * This runs when a week ends to preserve the cached data
   */
  async archiveCompletedWeeks(): Promise<void> {
    logger.info('📅 Starting weekly data archival process...');
    
    try {
      // Get previous week info
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Calculate previous week boundaries
      const dayOfWeek = lastWeek.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      const startOfWeek = new Date(lastWeek);
      startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Get ISO week number for previous week
      const date = new Date(lastWeek.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
      const week1 = new Date(date.getFullYear(), 0, 4);
      const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      
      const prevWeekPeriodId = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      
      logger.info(`📊 Archiving completed week: ${prevWeekPeriodId}`);
      
      // Get all clients with cache data for the previous week
      const { data: cacheData, error: cacheError } = await supabase
        .from('current_week_cache')
        .select('*')
        .eq('period_id', prevWeekPeriodId);
      
      if (cacheError) {
        throw new Error(`Failed to fetch week cache data: ${cacheError.message}`);
      }
      
      if (!cacheData || cacheData.length === 0) {
        logger.info('📝 No weekly cache data found to archive');
        return;
      }
      
      logger.info(`📦 Found ${cacheData.length} weekly cache entries to archive`);
      
      // Archive each cache entry to campaign_summaries
      let archivedCount = 0;
      let errorCount = 0;
      
      for (const cacheEntry of cacheData) {
        try {
          await this.archiveWeeklyData(cacheEntry);
          archivedCount++;
        } catch (error) {
          logger.error(`❌ Failed to archive weekly data for client ${cacheEntry.client_id}:`, error);
          errorCount++;
        }
      }
      
      logger.info(`✅ Weekly archival completed: ${archivedCount} archived, ${errorCount} errors`);
      
      // Clean up archived cache entries
      if (archivedCount > 0) {
        await this.cleanupArchivedWeeklyCache(prevWeekPeriodId);
      }
      
    } catch (error) {
      logger.error('❌ Weekly data archival failed:', error);
      logger.error('Weekly data archival failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Clean up data older than 14 months from campaign_summaries table
   * Note: Keeps 14 months total (13 past + 1 current) to ensure year-over-year comparisons always have required data
   * When in current month, we need data from 13 months back for comparison
   */
  async cleanupOldData(): Promise<void> {
    logger.info('🧹 Starting old data cleanup process...');
    
    try {
      // Calculate cutoff date (14 months ago = 13 past months + 1 current month)
      // This ensures we always have at least 14 months of data for year-over-year comparisons
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 14);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      logger.info(`🗑️ Removing data older than: ${cutoffDateStr} (14 months total: 13 past + 1 current for year-over-year comparisons)`);
      
      // Remove old monthly summaries
      const { data: deletedMonthly, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .delete()
        .eq('summary_type', 'monthly')
        .lt('summary_date', cutoffDateStr)
        .select('id');
      
      if (monthlyError) {
        throw new Error(`Failed to delete old monthly data: ${monthlyError.message}`);
      }
      
      // Remove old weekly summaries
      const { data: deletedWeekly, error: weeklyError } = await supabase
        .from('campaign_summaries')
        .delete()
        .eq('summary_type', 'weekly')
        .lt('summary_date', cutoffDateStr)
        .select('id');
      
      if (weeklyError) {
        throw new Error(`Failed to delete old weekly data: ${weeklyError.message}`);
      }
      
      const monthlyCount = deletedMonthly?.length || 0;
      const weeklyCount = deletedWeekly?.length || 0;
      const totalDeleted = monthlyCount + weeklyCount;
      
      logger.info(`✅ Old data cleanup completed:`);
      logger.info(`   Monthly records deleted: ${monthlyCount}`);
      logger.info(`   Weekly records deleted: ${weeklyCount}`);
      logger.info(`   Total records deleted: ${totalDeleted}`);
      
      logger.info('Old data cleanup completed', {
        monthlyDeleted: monthlyCount,
        weeklyDeleted: weeklyCount,
        totalDeleted,
        cutoffDate: cutoffDateStr
      });
      
    } catch (error) {
      logger.error('❌ Old data cleanup failed:', error);
      logger.error('Old data cleanup failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Archive monthly cache data to campaign_summaries
   */
  private async archiveMonthlyData(cacheEntry: any): Promise<void> {
    const cacheData = cacheEntry.cache_data;
    
    // Calculate the first day of the month from period_id (e.g., "2025-08" -> "2025-08-01")
    const summaryDate = `${cacheEntry.period_id}-01`;
    
    const summary = {
      client_id: cacheEntry.client_id,
      summary_type: 'monthly',
      summary_date: summaryDate,
      total_spend: cacheData?.stats?.totalSpend || 0,
      total_impressions: cacheData?.stats?.totalImpressions || 0,
      total_clicks: cacheData?.stats?.totalClicks || 0,
      total_conversions: cacheData?.stats?.totalConversions || 0,
      average_ctr: cacheData?.stats?.averageCtr || 0,
      average_cpc: cacheData?.stats?.averageCpc || 0,
      average_cpa: cacheData?.conversionMetrics?.cost_per_reservation || 0,
      active_campaigns: cacheData?.campaigns?.filter((c: any) => c.status === 'ACTIVE').length || 0,
      total_campaigns: cacheData?.campaigns?.length || 0,
      campaign_data: cacheData?.campaigns || [],
      meta_tables: cacheData?.metaTables || null,
      data_source: 'smart_cache_archive',
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date'
      });

    if (error) {
      throw new Error(`Failed to archive monthly summary: ${error.message}`);
    }

    logger.info(`💾 Archived monthly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}`);
  }

  /**
   * Archive weekly cache data to campaign_summaries
   */
  private async archiveWeeklyData(cacheEntry: any): Promise<void> {
    const cacheData = cacheEntry.cache_data;
    
    // Use the start date of the week from the cached data
    const cachedStartDate = cacheData?.period?.startDate;
    const summaryDate: string = typeof cachedStartDate === 'string' ? cachedStartDate : this.getWeekStartDate(cacheEntry.period_id);
    
    // Calculate conversion metrics from campaign data
    const campaigns = cacheData?.campaigns || [];
    const conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      total_spend: acc.total_spend + (campaign.spend || 0)
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0,
      total_spend: 0
    });

    // Calculate derived conversion metrics
    const roas = conversionTotals.total_spend > 0 && conversionTotals.reservation_value > 0 
      ? conversionTotals.reservation_value / conversionTotals.total_spend 
      : 0;
    
    const cost_per_reservation = conversionTotals.reservations > 0 
      ? conversionTotals.total_spend / conversionTotals.reservations 
      : 0;

    logger.info(`📊 Weekly archive conversion metrics calculated:`, {
      client_id: cacheEntry.client_id,
      period: cacheEntry.period_id,
      conversionTotals,
      roas,
      cost_per_reservation
    });
    
    const summary = {
      client_id: cacheEntry.client_id,
      summary_type: 'weekly',
      summary_date: summaryDate,
      total_spend: cacheData?.stats?.totalSpend || 0,
      total_impressions: cacheData?.stats?.totalImpressions || 0,
      total_clicks: cacheData?.stats?.totalClicks || 0,
      total_conversions: cacheData?.stats?.totalConversions || 0,
      average_ctr: cacheData?.stats?.averageCtr || 0,
      average_cpc: cacheData?.stats?.averageCpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: cacheData?.campaigns?.filter((c: any) => c.status === 'ACTIVE').length || 0,
      total_campaigns: cacheData?.campaigns?.length || 0,
      campaign_data: cacheData?.campaigns || [],
      meta_tables: cacheData?.metaTables || null,
      data_source: 'smart_cache_archive',
      // Add aggregated conversion metrics
      click_to_call: conversionTotals.click_to_call,
      email_contacts: conversionTotals.email_contacts,
      booking_step_1: conversionTotals.booking_step_1,
      reservations: conversionTotals.reservations,
      reservation_value: conversionTotals.reservation_value,
      booking_step_2: conversionTotals.booking_step_2,
      booking_step_3: conversionTotals.booking_step_3,
      roas: roas,
      cost_per_reservation: cost_per_reservation,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date'
      });

    if (error) {
      throw new Error(`Failed to archive weekly summary: ${error.message}`);
    }

    logger.info(`💾 Archived weekly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}`);
    logger.info(`💾 Conversion metrics: ${conversionTotals.reservations} reservations, ${conversionTotals.reservation_value} value, ${roas.toFixed(2)} ROAS`);
  }

  /**
   * Clean up archived monthly cache entries
   */
  private async cleanupArchivedMonthlyCache(periodId: string): Promise<void> {
    const { error } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('period_id', periodId);

    if (error) {
      logger.error(`⚠️ Failed to cleanup monthly cache for ${periodId}:`, error.message);
    } else {
      logger.info(`🧹 Cleaned up monthly cache for period ${periodId}`);
    }
  }

  /**
   * Clean up archived weekly cache entries
   */
  private async cleanupArchivedWeeklyCache(periodId: string): Promise<void> {
    const { error } = await supabase
      .from('current_week_cache')
      .delete()
      .eq('period_id', periodId);

    if (error) {
      logger.error(`⚠️ Failed to cleanup weekly cache for ${periodId}:`, error.message);
    } else {
      logger.info(`🧹 Cleaned up weekly cache for period ${periodId}`);
    }
  }

  /**
   * Get week start date from ISO week format (e.g., "2025-W33" -> "2025-08-10")
   * FIXED: Now uses proper ISO week calculation instead of simple Monday-based calculation
   */
  private getWeekStartDate(periodId: string): string {
    const [year, weekStr] = periodId.split('-W');
    if (!year || !weekStr) {
      throw new Error(`Invalid period ID format: ${periodId}`);
    }
    
    const weekNumber = parseInt(weekStr, 10);
    const yearNum = parseInt(year, 10);
    
    // ✅ FIXED: Use proper ISO week calculation (same as other parts of the system)
    // January 4th is always in week 1 of the ISO year
    const jan4 = new Date(yearNum, 0, 4);
    
    // Find the Monday of week 1
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    // Calculate the start date of the target week
    const targetWeekStart = new Date(startOfWeek1);
    targetWeekStart.setDate(startOfWeek1.getDate() + (weekNumber - 1) * 7);
    
    return targetWeekStart.toISOString().split('T')[0] as string;
  }

  /**
   * Get status of data lifecycle operations
   */
  async getLifecycleStatus(): Promise<any> {
    try {
      // Count current cache entries
      const [monthlyCache, weeklyCache, storedSummaries] = await Promise.all([
        supabase.from('current_month_cache').select('count', { count: 'exact' }),
        supabase.from('current_week_cache').select('count', { count: 'exact' }),
        supabase.from('campaign_summaries').select('count', { count: 'exact' })
      ]);

      // Get oldest and newest summary dates
      const { data: oldestSummary } = await supabase
        .from('campaign_summaries')
        .select('summary_date')
        .order('summary_date', { ascending: true })
        .limit(1);

      const { data: newestSummary } = await supabase
        .from('campaign_summaries')
        .select('summary_date')
        .order('summary_date', { ascending: false })
        .limit(1);

      return {
        currentMonthCacheEntries: monthlyCache.count || 0,
        currentWeekCacheEntries: weeklyCache.count || 0,
        storedSummaries: storedSummaries.count || 0,
        oldestData: oldestSummary?.[0]?.summary_date || 'None',
        newestData: newestSummary?.[0]?.summary_date || 'None',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Failed to get lifecycle status:', error);
      return { error: 'Failed to get status' };
    }
  }
} 