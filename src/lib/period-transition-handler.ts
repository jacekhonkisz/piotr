/**
 * Period Transition Handler
 * 
 * Automatically handles cache transitions when months or weeks end:
 * - Archives expired cache data to permanent storage
 * - Removes expired cache entries
 * - Prevents stale data being shown as "current"
 * 
 * Should run at midnight on period boundaries (1st of month, every Monday)
 */

import { DataLifecycleManager } from './data-lifecycle-manager';
import { supabase } from './supabase';
import logger from './logger';

export class PeriodTransitionHandler {
  
  /**
   * Handle automatic period transitions (month/week changes)
   */
  static async handleTransition(): Promise<{
    monthTransition: { archived: number; errors: number };
    weekTransition: { archived: number; errors: number };
  }> {
    logger.info('🔄 Checking for period transitions...');
    
    const results = {
      monthTransition: await this.handleMonthTransition(),
      weekTransition: await this.handleWeekTransition()
    };
    
    logger.info('✅ Period transition check completed', results);
    return results;
  }
  
  /**
   * Handle monthly period transitions
   */
  private static async handleMonthTransition(): Promise<{ archived: number; errors: number }> {
    logger.info('📅 Checking for monthly period transitions...');
    
    const now = new Date();
    const currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      // Find expired monthly caches (not matching current month)
      const { data: expiredCaches, error: queryError } = await supabase
        .from('current_month_cache')
        .select('*')
        .neq('period_id', currentPeriodId);
        
      if (queryError) {
        logger.error('❌ Failed to query expired monthly caches:', queryError);
        return { archived: 0, errors: 1 };
      }
      
      if (!expiredCaches || expiredCaches.length === 0) {
        logger.info('✅ No expired monthly caches found');
        return { archived: 0, errors: 0 };
      }
      
      logger.info(`📦 Found ${expiredCaches.length} expired monthly cache(s) to archive`);
      
      const lifecycle = DataLifecycleManager.getInstance();
      let archived = 0;
      let errors = 0;
      
      // Archive each expired cache
      for (const cache of expiredCaches) {
        try {
          logger.info(`📥 Archiving monthly cache for client ${cache.client_id}, period ${cache.period_id}`);
          
          // Archive to campaign_summaries
          await this.archiveMonthlyCache(cache);
          
          // Delete from current_month_cache
          const { error: deleteError } = await supabase
            .from('current_month_cache')
            .delete()
            .eq('id', cache.id);
            
          if (deleteError) {
            logger.error(`❌ Failed to delete archived monthly cache for client ${cache.client_id}:`, deleteError);
            errors++;
          } else {
            archived++;
            logger.info(`✅ Successfully archived and removed monthly cache for client ${cache.client_id}`);
          }
          
        } catch (error) {
          logger.error(`❌ Failed to archive monthly cache for client ${cache.client_id}:`, error);
          errors++;
        }
      }
      
      logger.info(`📊 Monthly transition complete: ${archived} archived, ${errors} errors`);
      return { archived, errors };
      
    } catch (error) {
      logger.error('❌ Monthly transition handler failed:', error);
      return { archived: 0, errors: 1 };
    }
  }
  
  /**
   * Handle weekly period transitions
   */
  private static async handleWeekTransition(): Promise<{ archived: number; errors: number }> {
    logger.info('📅 Checking for weekly period transitions...');
    
    const currentPeriodId = this.getCurrentWeekPeriodId();
    
    try {
      // Find expired weekly caches (not matching current week)
      const { data: expiredCaches, error: queryError } = await supabase
        .from('current_week_cache')
        .select('*')
        .neq('period_id', currentPeriodId);
        
      if (queryError) {
        logger.error('❌ Failed to query expired weekly caches:', queryError);
        return { archived: 0, errors: 1 };
      }
      
      if (!expiredCaches || expiredCaches.length === 0) {
        logger.info('✅ No expired weekly caches found');
        return { archived: 0, errors: 0 };
      }
      
      logger.info(`📦 Found ${expiredCaches.length} expired weekly cache(s) to archive`);
      
      const lifecycle = DataLifecycleManager.getInstance();
      let archived = 0;
      let errors = 0;
      
      // Archive each expired cache
      for (const cache of expiredCaches) {
        try {
          logger.info(`📥 Archiving weekly cache for client ${cache.client_id}, period ${cache.period_id}`);
          
          // Archive to campaign_summaries
          await this.archiveWeeklyCache(cache);
          
          // Delete from current_week_cache
          const { error: deleteError } = await supabase
            .from('current_week_cache')
            .delete()
            .eq('id', cache.id);
            
          if (deleteError) {
            logger.error(`❌ Failed to delete archived weekly cache for client ${cache.client_id}:`, deleteError);
            errors++;
          } else {
            archived++;
            logger.info(`✅ Successfully archived and removed weekly cache for client ${cache.client_id}`);
          }
          
        } catch (error) {
          logger.error(`❌ Failed to archive weekly cache for client ${cache.client_id}:`, error);
          errors++;
        }
      }
      
      logger.info(`📊 Weekly transition complete: ${archived} archived, ${errors} errors`);
      return { archived, errors };
      
    } catch (error) {
      logger.error('❌ Weekly transition handler failed:', error);
      return { archived: 0, errors: 1 };
    }
  }
  
  /**
   * Get current ISO week period ID (e.g., "2025-W40")
   */
  private static getCurrentWeekPeriodId(): string {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday of current week
    
    // Calculate ISO week number
    const date = new Date(currentWeekStart);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }
  
  /**
   * Archive monthly cache to campaign_summaries
   */
  private static async archiveMonthlyCache(cache: any): Promise<void> {
    const cacheData = cache.cache_data;
    const summaryDate = `${cache.period_id}-01`; // e.g., "2025-09-01"
    
    const summary = {
      client_id: cache.client_id,
      summary_type: 'monthly',
      summary_date: summaryDate,
      platform: cache.platform || 'meta',
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
      // Conversion metrics
      click_to_call: cacheData?.conversionMetrics?.click_to_call || 0,
      email_contacts: cacheData?.conversionMetrics?.email_contacts || 0,
      booking_step_1: cacheData?.conversionMetrics?.booking_step_1 || 0,
      booking_step_2: cacheData?.conversionMetrics?.booking_step_2 || 0,
      booking_step_3: cacheData?.conversionMetrics?.booking_step_3 || 0,
      reservations: cacheData?.conversionMetrics?.reservations || 0,
      reservation_value: cacheData?.conversionMetrics?.reservation_value || 0,
      roas: cacheData?.conversionMetrics?.roas || 0,
      cost_per_reservation: cacheData?.conversionMetrics?.cost_per_reservation || 0,
      data_source: 'period_transition_archive',
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      throw new Error(`Failed to archive monthly summary: ${error.message}`);
    }

    logger.info(`💾 Archived monthly data: client ${cache.client_id}, period ${cache.period_id}`);
  }
  
  /**
   * Archive weekly cache to campaign_summaries
   */
  private static async archiveWeeklyCache(cache: any): Promise<void> {
    const cacheData = cache.cache_data;
    
    // Use period_start from cache or calculate from period_id
    const summaryDate = cache.period_start || this.getWeekStartDate(cache.period_id);
    
    // Calculate conversion metrics from campaign data
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

    const roas = conversionTotals.total_spend > 0 && conversionTotals.reservation_value > 0 
      ? conversionTotals.reservation_value / conversionTotals.total_spend 
      : 0;
    
    const cost_per_reservation = conversionTotals.reservations > 0 
      ? conversionTotals.total_spend / conversionTotals.reservations 
      : 0;
    
    const summary = {
      client_id: cache.client_id,
      summary_type: 'weekly',
      summary_date: summaryDate,
      platform: cache.platform || 'meta',
      total_spend: cacheData?.stats?.totalSpend || 0,
      total_impressions: cacheData?.stats?.totalImpressions || 0,
      total_clicks: cacheData?.stats?.totalClicks || 0,
      total_conversions: cacheData?.stats?.totalConversions || 0,
      average_ctr: cacheData?.stats?.averageCtr || 0,
      average_cpc: cacheData?.stats?.averageCpc || 0,
      average_cpa: cost_per_reservation,
      active_campaigns: campaigns.filter((c: any) => c.status === 'ACTIVE').length,
      total_campaigns: campaigns.length,
      campaign_data: campaigns,
      meta_tables: cacheData?.metaTables || null,
      // Conversion metrics
      click_to_call: conversionTotals.click_to_call,
      email_contacts: conversionTotals.email_contacts,
      booking_step_1: conversionTotals.booking_step_1,
      booking_step_2: conversionTotals.booking_step_2,
      booking_step_3: conversionTotals.booking_step_3,
      reservations: conversionTotals.reservations,
      reservation_value: conversionTotals.reservation_value,
      roas: roas,
      cost_per_reservation: cost_per_reservation,
      data_source: 'period_transition_archive',
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (error) {
      throw new Error(`Failed to archive weekly summary: ${error.message}`);
    }

    logger.info(`💾 Archived weekly data: client ${cache.client_id}, period ${cache.period_id}`);
  }
  
  /**
   * Get week start date from ISO week format (e.g., "2025-W33" -> "2025-08-10")
   */
  private static getWeekStartDate(periodId: string): string {
    const [year, weekStr] = periodId.split('-W');
    if (!year || !weekStr) {
      throw new Error(`Invalid period ID format: ${periodId}`);
    }
    
    const weekNumber = parseInt(weekStr, 10);
    const yearNum = parseInt(year, 10);
    
    // Use proper ISO week calculation
    const jan4 = new Date(yearNum, 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    const targetWeekStart = new Date(startOfWeek1);
    targetWeekStart.setDate(startOfWeek1.getDate() + (weekNumber - 1) * 7);
    
    return targetWeekStart.toISOString().split('T')[0];
  }
}

