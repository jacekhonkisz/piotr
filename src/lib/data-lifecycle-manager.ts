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
   * NOW SUPPORTS BOTH META AND GOOGLE ADS
   */
  async archiveCompletedMonths(): Promise<void> {
    logger.info('📅 Starting monthly data archival process for both Meta and Google Ads...');
    
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
      
      let totalArchived = 0;
      let totalErrors = 0;
      
      // ============================================
      // ARCHIVE META ADS CACHE
      // ============================================
      logger.info('📱 Archiving Meta Ads monthly cache...');
      const { data: metaCacheData, error: metaCacheError } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('period_id', prevMonthPeriodId);
      
      if (metaCacheError) {
        logger.error(`❌ Failed to fetch Meta month cache data: ${metaCacheError.message}`);
      } else if (!metaCacheData || metaCacheData.length === 0) {
        logger.info('📝 No Meta monthly cache data found to archive');
      } else {
        logger.info(`📦 Found ${metaCacheData.length} Meta monthly cache entries to archive`);
        
        for (const cacheEntry of metaCacheData) {
          try {
            await this.archiveMonthlyData(cacheEntry, 'meta');
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Meta monthly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Meta cache
        if (metaCacheData.length > 0) {
          await this.cleanupArchivedMonthlyCache(prevMonthPeriodId);
        }
      }
      
      // ============================================
      // ARCHIVE GOOGLE ADS CACHE (NEW)
      // ============================================
      logger.info('🔍 Archiving Google Ads monthly cache...');
      const { data: googleCacheData, error: googleCacheError } = await supabase
        .from('google_ads_current_month_cache')
        .select('*')
        .eq('period_id', prevMonthPeriodId);
      
      if (googleCacheError) {
        logger.error(`❌ Failed to fetch Google Ads month cache data: ${googleCacheError.message}`);
      } else if (!googleCacheData || googleCacheData.length === 0) {
        logger.info('📝 No Google Ads monthly cache data found to archive');
      } else {
        logger.info(`📦 Found ${googleCacheData.length} Google Ads monthly cache entries to archive`);
        
        for (const cacheEntry of googleCacheData) {
          try {
            await this.archiveGoogleAdsMonthlyData(cacheEntry);
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Google Ads monthly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Google Ads cache
        if (googleCacheData.length > 0) {
          await this.cleanupArchivedGoogleAdsMonthlyCache(prevMonthPeriodId);
        }
      }
      
      logger.info(`✅ Monthly archival completed: ${totalArchived} total archived (Meta + Google), ${totalErrors} errors`);
      
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
   * NOW SUPPORTS BOTH META AND GOOGLE ADS
   */
  async archiveCompletedWeeks(): Promise<void> {
    logger.info('📅 Starting weekly data archival process for both Meta and Google Ads...');
    
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
      
      let totalArchived = 0;
      let totalErrors = 0;
      
      // ============================================
      // ARCHIVE META ADS CACHE
      // ============================================
      logger.info('📱 Archiving Meta Ads weekly cache...');
      const { data: metaCacheData, error: metaCacheError } = await supabase
        .from('current_week_cache')
        .select('*')
        .eq('period_id', prevWeekPeriodId);
      
      if (metaCacheError) {
        logger.error(`❌ Failed to fetch Meta week cache data: ${metaCacheError.message}`);
      } else if (!metaCacheData || metaCacheData.length === 0) {
        logger.info('📝 No Meta weekly cache data found to archive');
      } else {
        logger.info(`📦 Found ${metaCacheData.length} Meta weekly cache entries to archive`);
        
        for (const cacheEntry of metaCacheData) {
          try {
            await this.archiveWeeklyData(cacheEntry, 'meta');
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Meta weekly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Meta cache
        if (metaCacheData.length > 0) {
          await this.cleanupArchivedWeeklyCache(prevWeekPeriodId);
        }
      }
      
      // ============================================
      // ARCHIVE GOOGLE ADS CACHE (NEW)
      // ============================================
      logger.info('🔍 Archiving Google Ads weekly cache...');
      const { data: googleCacheData, error: googleCacheError } = await supabase
        .from('google_ads_current_week_cache')
        .select('*')
        .eq('period_id', prevWeekPeriodId);
      
      if (googleCacheError) {
        logger.error(`❌ Failed to fetch Google Ads week cache data: ${googleCacheError.message}`);
      } else if (!googleCacheData || googleCacheData.length === 0) {
        logger.info('📝 No Google Ads weekly cache data found to archive');
      } else {
        logger.info(`📦 Found ${googleCacheData.length} Google Ads weekly cache entries to archive`);
        
        for (const cacheEntry of googleCacheData) {
          try {
            await this.archiveGoogleAdsWeeklyData(cacheEntry);
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Google Ads weekly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Google Ads cache
        if (googleCacheData.length > 0) {
          await this.cleanupArchivedGoogleAdsWeeklyCache(prevWeekPeriodId);
        }
      }
      
      logger.info(`✅ Weekly archival completed: ${totalArchived} total archived (Meta + Google), ${totalErrors} errors`);
      
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
   * Archive monthly cache data to campaign_summaries (Meta Ads)
   */
  private async archiveMonthlyData(cacheEntry: any, platform: 'meta' | 'google'): Promise<void> {
    const cacheData = cacheEntry.cache_data;
    
    // Calculate the first day of the month from period_id (e.g., "2025-08" -> "2025-08-01")
    const summaryDate = `${cacheEntry.period_id}-01`;
    
    const summary = {
      client_id: cacheEntry.client_id,
      summary_type: 'monthly',
      summary_date: summaryDate,
      platform: platform,  // ✅ NOW INCLUDES PLATFORM
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
        onConflict: 'client_id,summary_type,summary_date,platform'  // ✅ UPDATED CONFLICT RESOLUTION
      });

    if (error) {
      throw new Error(`Failed to archive monthly summary: ${error.message}`);
    }

    logger.info(`💾 Archived ${platform} monthly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}`);
  }

  /**
   * Archive weekly cache data to campaign_summaries (Meta Ads)
   */
  private async archiveWeeklyData(cacheEntry: any, platform: 'meta' | 'google'): Promise<void> {
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
      platform,
      conversionTotals,
      roas,
      cost_per_reservation
    });
    
    const summary = {
      client_id: cacheEntry.client_id,
      summary_type: 'weekly',
      summary_date: summaryDate,
      platform: platform,  // ✅ NOW INCLUDES PLATFORM
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
        onConflict: 'client_id,summary_type,summary_date,platform'  // ✅ UPDATED CONFLICT RESOLUTION
      });

    if (error) {
      throw new Error(`Failed to archive weekly summary: ${error.message}`);
    }

    logger.info(`💾 Archived ${platform} weekly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}`);
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
   * Archive Google Ads monthly cache data to campaign_summaries
   * NEW METHOD - handles Google Ads specific data structure
   * ✅ ENHANCED: Automatically falls back to google_ads_campaigns table if cache has zeros
   */
  private async archiveGoogleAdsMonthlyData(cacheEntry: any): Promise<void> {
    const cacheData = cacheEntry.cache_data;
    const summaryDate = `${cacheEntry.period_id}-01`;
    
    // 🔍 DATA QUALITY CHECK: Detect if cache has zeros but campaigns exist
    const cacheSpend = cacheData?.stats?.totalSpend || 0;
    const cacheCampaigns = cacheData?.campaigns || [];
    const hasCampaigns = cacheCampaigns.length > 0;
    const cacheHasZeros = cacheSpend === 0 && hasCampaigns;
    
    let summary: any;
    let dataSource = 'google_ads_smart_cache_archive';
    
    // ✅ FALLBACK: If cache has zeros, try to get data from google_ads_campaigns table
    if (cacheHasZeros) {
      logger.warn(`⚠️ Cache has zeros for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}. Attempting fallback to google_ads_campaigns table...`);
      
      try {
        const fallbackData = await this.getGoogleAdsDataFromCampaignsTable(
          cacheEntry.client_id,
          summaryDate,
          'monthly'
        );
        
        if (fallbackData && fallbackData.total_spend > 0) {
          logger.info(`✅ Fallback successful: Found ${fallbackData.total_spend} spend in google_ads_campaigns table`);
          summary = fallbackData;
          dataSource = 'google_ads_campaigns_fallback_archive';
        } else {
          logger.warn(`⚠️ Fallback found no data in google_ads_campaigns table, using cache data (zeros)`);
          // Continue with cache data (zeros)
          summary = this.buildGoogleAdsMonthlySummary(cacheEntry, cacheData, summaryDate, dataSource);
        }
      } catch (fallbackError) {
        logger.error(`❌ Fallback failed:`, fallbackError);
        // Continue with cache data (zeros)
        summary = this.buildGoogleAdsMonthlySummary(cacheEntry, cacheData, summaryDate, dataSource);
      }
    } else {
      // ✅ Cache has real data, use it
      summary = this.buildGoogleAdsMonthlySummary(cacheEntry, cacheData, summaryDate, dataSource);
    }

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      throw new Error(`Failed to archive Google Ads monthly summary: ${error.message}`);
    }

    logger.info(`💾 Archived Google Ads monthly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id} (source: ${dataSource})`);
  }

  /**
   * Build Google Ads monthly summary from cache data
   */
  private buildGoogleAdsMonthlySummary(cacheEntry: any, cacheData: any, summaryDate: string, dataSource: string): any {
    return {
      client_id: cacheEntry.client_id,
      summary_type: 'monthly',
      summary_date: summaryDate,
      platform: 'google',
      total_spend: cacheData?.stats?.totalSpend || 0,
      total_impressions: cacheData?.stats?.totalImpressions || 0,
      total_clicks: cacheData?.stats?.totalClicks || 0,
      total_conversions: cacheData?.stats?.totalConversions || 0,
      average_ctr: cacheData?.stats?.averageCtr || 0,
      average_cpc: cacheData?.stats?.averageCpc || 0,
      click_to_call: cacheData?.conversionMetrics?.click_to_call || 0,
      email_contacts: cacheData?.conversionMetrics?.email_contacts || 0,
      booking_step_1: cacheData?.conversionMetrics?.booking_step_1 || 0,
      booking_step_2: cacheData?.conversionMetrics?.booking_step_2 || 0,
      booking_step_3: cacheData?.conversionMetrics?.booking_step_3 || 0,
      reservations: cacheData?.conversionMetrics?.reservations || 0,
      reservation_value: cacheData?.conversionMetrics?.reservation_value || 0,
      average_cpa: cacheData?.conversionMetrics?.reservations > 0 
        ? (cacheData?.stats?.totalSpend || 0) / cacheData.conversionMetrics.reservations 
        : 0,
      roas: (cacheData?.stats?.totalSpend || 0) > 0 
        ? (cacheData?.conversionMetrics?.reservation_value || 0) / cacheData.stats.totalSpend 
        : 0,
      active_campaigns: cacheData?.campaigns?.filter((c: any) => c.status === 'ENABLED').length || 0,
      total_campaigns: cacheData?.campaigns?.length || 0,
      campaign_data: cacheData?.campaigns || [],
      google_ads_tables: cacheData?.googleAdsTables || null,
      data_source: dataSource,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Get Google Ads data from google_ads_campaigns table as fallback
   * Used when cache has zeros but campaigns exist
   */
  private async getGoogleAdsDataFromCampaignsTable(
    clientId: string,
    summaryDate: string,
    summaryType: 'monthly' | 'weekly'
  ): Promise<any | null> {
    // Calculate date range from summary date
    const startDate = summaryDate; // e.g., '2025-12-01' for monthly, '2025-12-01' for weekly start
    let endDate: string;
    
    if (summaryType === 'monthly') {
      // Get last day of month
      const date = new Date(startDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // For weekly, calculate week end date (6 days after start)
      const date = new Date(startDate);
      date.setDate(date.getDate() + 6);
      endDate = date.toISOString().split('T')[0];
    }

    // Query google_ads_campaigns table for spend/impressions/clicks
    const { data: campaigns, error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', startDate)
      .lte('date_range_start', endDate);

    if (campaignsError) {
      logger.error(`❌ Failed to query google_ads_campaigns table:`, campaignsError);
      return null;
    }

    if (!campaigns || campaigns.length === 0) {
      logger.info(`📝 No campaigns found in google_ads_campaigns table for period ${startDate} to ${endDate}`);
      return null;
    }

    // Query daily_kpi_data for conversion metrics (more reliable source)
    const { data: dailyKpiData, error: kpiError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'google')
      .gte('date', startDate)
      .lte('date', endDate);

    if (kpiError) {
      logger.warn(`⚠️ Failed to query daily_kpi_data table:`, kpiError);
    }

    // Aggregate data from campaigns (for spend, impressions, clicks)
    const aggregated = campaigns.reduce((acc, campaign: any) => {
      acc.total_spend += parseFloat(campaign.spend || 0);
      acc.total_impressions += parseInt(campaign.impressions || 0);
      acc.total_clicks += parseInt(campaign.clicks || 0);
      acc.total_conversions += parseInt(campaign.form_submissions || 0) + parseInt(campaign.phone_calls || 0);
      // Use campaign conversions as fallback if daily_kpi_data not available
      acc.booking_step_1_campaigns += parseInt(campaign.booking_step_1 || 0);
      acc.booking_step_2_campaigns += parseInt(campaign.booking_step_2 || 0);
      acc.booking_step_3_campaigns += parseInt(campaign.booking_step_3 || 0);
      acc.reservations_campaigns += parseInt(campaign.reservations || 0);
      acc.reservation_value_campaigns += parseFloat(campaign.reservation_value || 0);
      return acc;
    }, {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      booking_step_1_campaigns: 0,
      booking_step_2_campaigns: 0,
      booking_step_3_campaigns: 0,
      reservations_campaigns: 0,
      reservation_value_campaigns: 0
    });

    // ✅ CRITICAL FIX FOR GOOGLE ADS: Booking steps MUST come ONLY from API (campaigns), NOT daily_kpi_data
    // For Google Ads, we ALWAYS use campaign data (which comes from API) for booking steps
    // daily_kpi_data is only used for other metrics (click_to_call, email_contacts) if available
    let conversionMetrics = null;
    
    if (dailyKpiData && dailyKpiData.length > 0) {
      // For Google Ads, only use daily_kpi_data for non-booking-step metrics
      // Booking steps MUST come from campaigns (API data)
      conversionMetrics = dailyKpiData.reduce((acc, day: any) => {
        // ✅ DO NOT use daily_kpi_data for booking steps for Google Ads
        // acc.booking_step_1 += parseInt(day.booking_step_1 || 0);  // ❌ REMOVED
        // acc.booking_step_2 += parseInt(day.booking_step_2 || 0);  // ❌ REMOVED
        // acc.booking_step_3 += parseInt(day.booking_step_3 || 0);  // ❌ REMOVED
        // acc.reservations += parseInt(day.reservations || 0);  // ❌ REMOVED
        // acc.reservation_value += parseFloat(day.reservation_value || 0);  // ❌ REMOVED
        
        // Only use daily_kpi_data for other metrics
        acc.click_to_call += parseInt(day.click_to_call || 0);
        acc.email_contacts += parseInt(day.email_contacts || 0);
        return acc;
      }, {
        booking_step_1: 0,  // Will be set from campaigns
        booking_step_2: 0,  // Will be set from campaigns
        booking_step_3: 0,  // Will be set from campaigns
        reservations: 0,  // Will be set from campaigns
        reservation_value: 0,  // Will be set from campaigns
        click_to_call: 0,
        email_contacts: 0
      });
    }

    // ✅ CRITICAL: For Google Ads, ALWAYS use campaign data (API) for booking steps
    // Campaign data comes directly from Google Ads API via getCampaignData()
    const finalConversions = {
      booking_step_1: aggregated.booking_step_1_campaigns,  // ✅ ALWAYS from API
      booking_step_2: aggregated.booking_step_2_campaigns,  // ✅ ALWAYS from API
      booking_step_3: aggregated.booking_step_3_campaigns,  // ✅ ALWAYS from API
      reservations: aggregated.reservations_campaigns,  // ✅ ALWAYS from API
      reservation_value: aggregated.reservation_value_campaigns,  // ✅ ALWAYS from API
      click_to_call: conversionMetrics?.click_to_call || 0,  // Can use daily_kpi_data if available
      email_contacts: conversionMetrics?.email_contacts || 0  // Can use daily_kpi_data if available
    };

    // Calculate derived metrics
    const average_ctr = aggregated.total_impressions > 0 
      ? (aggregated.total_clicks / aggregated.total_impressions) * 100 
      : 0;
    const average_cpc = aggregated.total_clicks > 0 
      ? aggregated.total_spend / aggregated.total_clicks 
      : 0;
    const average_cpa = finalConversions.reservations > 0 
      ? aggregated.total_spend / finalConversions.reservations 
      : 0;
    const roas = aggregated.total_spend > 0 && finalConversions.reservation_value > 0
      ? finalConversions.reservation_value / aggregated.total_spend
      : 0;

    // Build campaign data array
    const campaign_data = campaigns.map((campaign: any) => ({
      campaignId: campaign.campaign_id,
      campaignName: campaign.campaign_name,
      status: campaign.status,
      spend: parseFloat(campaign.spend || 0),
      impressions: parseInt(campaign.impressions || 0),
      clicks: parseInt(campaign.clicks || 0),
      cpc: parseFloat(campaign.cpc || 0),
      ctr: parseFloat(campaign.ctr || 0),
      booking_step_1: parseInt(campaign.booking_step_1 || 0),
      booking_step_2: parseInt(campaign.booking_step_2 || 0),
      booking_step_3: parseInt(campaign.booking_step_3 || 0),
      reservations: parseInt(campaign.reservations || 0),
      reservation_value: parseFloat(campaign.reservation_value || 0),
      roas: parseFloat(campaign.roas || 0)
    }));

    return {
      client_id: clientId,
      summary_type: summaryType,
      summary_date: summaryDate,
      platform: 'google',
      total_spend: aggregated.total_spend,
      total_impressions: aggregated.total_impressions,
      total_clicks: aggregated.total_clicks,
      total_conversions: aggregated.total_conversions,
      average_ctr,
      average_cpc,
      average_cpa,
      booking_step_1: finalConversions.booking_step_1,
      booking_step_2: finalConversions.booking_step_2,
      booking_step_3: finalConversions.booking_step_3,
      reservations: finalConversions.reservations,
      reservation_value: finalConversions.reservation_value,
      click_to_call: finalConversions.click_to_call,
      email_contacts: finalConversions.email_contacts,
      roas,
      active_campaigns: campaigns.filter((c: any) => c.status === 'ENABLED').length,
      total_campaigns: campaigns.length,
      campaign_data,
      data_source: 'google_ads_campaigns_fallback_archive',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Archive Google Ads weekly cache data to campaign_summaries
   * NEW METHOD - handles Google Ads specific data structure
   * ✅ ENHANCED: Automatically falls back to google_ads_campaigns table if cache has zeros
   */
  private async archiveGoogleAdsWeeklyData(cacheEntry: any): Promise<void> {
    const cacheData = cacheEntry.cache_data;
    
    // Use the start date of the week from the cached data
    const cachedStartDate = cacheData?.period?.startDate;
    const summaryDate: string = typeof cachedStartDate === 'string' ? cachedStartDate : this.getWeekStartDate(cacheEntry.period_id);
    
    // 🔍 DATA QUALITY CHECK: Detect if cache has zeros but campaigns exist
    const cacheSpend = cacheData?.stats?.totalSpend || 0;
    const cacheCampaigns = cacheData?.campaigns || [];
    const hasCampaigns = cacheCampaigns.length > 0;
    const cacheHasZeros = cacheSpend === 0 && hasCampaigns;
    
    let summary: any;
    let dataSource = 'google_ads_smart_cache_archive';
    
    // ✅ FALLBACK: If cache has zeros, try to get data from google_ads_campaigns table
    if (cacheHasZeros) {
      logger.warn(`⚠️ Cache has zeros for client ${cacheEntry.client_id}, period ${cacheEntry.period_id}. Attempting fallback to google_ads_campaigns table...`);
      
      try {
        const fallbackData = await this.getGoogleAdsDataFromCampaignsTable(
          cacheEntry.client_id,
          summaryDate,
          'weekly'
        );
        
        if (fallbackData && fallbackData.total_spend > 0) {
          logger.info(`✅ Fallback successful: Found ${fallbackData.total_spend} spend in google_ads_campaigns table`);
          summary = fallbackData;
          dataSource = 'google_ads_campaigns_fallback_archive';
        } else {
          logger.warn(`⚠️ Fallback found no data in google_ads_campaigns table, using cache data (zeros)`);
          // Continue with cache data (zeros)
          summary = this.buildGoogleAdsWeeklySummary(cacheEntry, cacheData, summaryDate, dataSource);
        }
      } catch (fallbackError) {
        logger.error(`❌ Fallback failed:`, fallbackError);
        // Continue with cache data (zeros)
        summary = this.buildGoogleAdsWeeklySummary(cacheEntry, cacheData, summaryDate, dataSource);
      }
    } else {
      // ✅ Cache has real data, use it
      summary = this.buildGoogleAdsWeeklySummary(cacheEntry, cacheData, summaryDate, dataSource);
    }

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      throw new Error(`Failed to archive Google Ads weekly summary: ${error.message}`);
    }

    logger.info(`💾 Archived Google Ads weekly data for client ${cacheEntry.client_id}, period ${cacheEntry.period_id} (source: ${dataSource})`);
  }

  /**
   * Build Google Ads weekly summary from cache data
   */
  private buildGoogleAdsWeeklySummary(cacheEntry: any, cacheData: any, summaryDate: string, dataSource: string): any {
    // Calculate conversion metrics from Google Ads campaign data
    const campaigns = cacheData?.campaigns || [];
    const conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      total_spend: acc.total_spend + (campaign.spend || 0)
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      total_spend: 0
    });

    // Calculate derived conversion metrics
    const roas = conversionTotals.total_spend > 0 && conversionTotals.reservation_value > 0 
      ? conversionTotals.reservation_value / conversionTotals.total_spend 
      : 0;
    
    const cost_per_reservation = conversionTotals.reservations > 0 
      ? conversionTotals.total_spend / conversionTotals.reservations 
      : 0;

    return {
      client_id: cacheEntry.client_id,
      summary_type: 'weekly',
      summary_date: summaryDate,
      platform: 'google',
      total_spend: cacheData?.stats?.totalSpend || 0,
      total_impressions: cacheData?.stats?.totalImpressions || 0,
      total_clicks: cacheData?.stats?.totalClicks || 0,
      total_conversions: cacheData?.stats?.totalConversions || 0,
      average_ctr: cacheData?.stats?.averageCtr || 0,
      average_cpc: cacheData?.stats?.averageCpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: cacheData?.campaigns?.filter((c: any) => c.status === 'ENABLED').length || 0,
      total_campaigns: cacheData?.campaigns?.length || 0,
      campaign_data: cacheData?.campaigns || [],
      google_ads_tables: cacheData?.googleAdsTables || null,
      data_source: dataSource,
      click_to_call: conversionTotals.click_to_call,
      email_contacts: conversionTotals.email_contacts,
      booking_step_1: conversionTotals.booking_step_1,
      booking_step_2: conversionTotals.booking_step_2,
      booking_step_3: conversionTotals.booking_step_3,
      reservations: conversionTotals.reservations,
      reservation_value: conversionTotals.reservation_value,
      roas: roas,
      cost_per_reservation: cost_per_reservation,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Clean up archived Google Ads monthly cache entries
   * NEW METHOD - for Google Ads cache cleanup
   */
  private async cleanupArchivedGoogleAdsMonthlyCache(periodId: string): Promise<void> {
    const { error } = await supabase
      .from('google_ads_current_month_cache')
      .delete()
      .eq('period_id', periodId);

    if (error) {
      logger.error(`⚠️ Failed to cleanup Google Ads monthly cache for ${periodId}:`, error.message);
    } else {
      logger.info(`🧹 Cleaned up Google Ads monthly cache for period ${periodId}`);
    }
  }

  /**
   * Clean up archived Google Ads weekly cache entries
   * NEW METHOD - for Google Ads cache cleanup
   */
  private async cleanupArchivedGoogleAdsWeeklyCache(periodId: string): Promise<void> {
    const { error } = await supabase
      .from('google_ads_current_week_cache')
      .delete()
      .eq('period_id', periodId);

    if (error) {
      logger.error(`⚠️ Failed to cleanup Google Ads weekly cache for ${periodId}:`, error.message);
    } else {
      logger.info(`🧹 Cleaned up Google Ads weekly cache for period ${periodId}`);
    }
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