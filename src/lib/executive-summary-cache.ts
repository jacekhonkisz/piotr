import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ExecutiveSummaryCache = Database['public']['Tables']['executive_summaries']['Row'];

export class ExecutiveSummaryCacheService {
  private static instance: ExecutiveSummaryCacheService;

  public static getInstance(): ExecutiveSummaryCacheService {
    if (!ExecutiveSummaryCacheService.instance) {
      ExecutiveSummaryCacheService.instance = new ExecutiveSummaryCacheService();
    }
    return ExecutiveSummaryCacheService.instance;
  }

  /**
   * Sprawdź czy executive summary istnieje w cache dla danego klienta i okresu
   */
  async getCachedSummary(
    clientId: string, 
    dateRange: { start: string; end: string }
  ): Promise<ExecutiveSummaryCache | null> {
    try {
      console.log(`🔍 Checking cache for executive summary: ${clientId} ${dateRange.start}-${dateRange.end}`);
      
      const { data, error } = await supabase
        .from('executive_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('date_range_start', dateRange.start)
        .eq('date_range_end', dateRange.end)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - summary not found
          console.log('❌ No cached executive summary found');
          return null;
        }
        throw error;
      }

      console.log('✅ Found cached executive summary');
      return data;
    } catch (error) {
      console.error('❌ Error checking executive summary cache:', error);
      return null;
    }
  }

  /**
   * Zapisz executive summary do cache
   */
  async saveSummary(
    clientId: string,
    dateRange: { start: string; end: string },
    content: string,
    isAiGenerated: boolean = true
  ): Promise<ExecutiveSummaryCache | null> {
    try {
      console.log(`💾 Saving executive summary to cache: ${clientId} ${dateRange.start}-${dateRange.end}`);
      
      const summaryData = {
        client_id: clientId,
        date_range_start: dateRange.start,
        date_range_end: dateRange.end,
        content,
        is_ai_generated: isAiGenerated,
        generated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('executive_summaries')
        .upsert(summaryData, {
          onConflict: 'client_id,date_range_start,date_range_end'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving executive summary to cache:', error);
        return null;
      }

      console.log('✅ Executive summary saved to cache');
      return data;
    } catch (error) {
      console.error('❌ Error saving executive summary to cache:', error);
      return null;
    }
  }

  /**
   * Usuń executive summary starsze niż 12 miesięcy
   */
  async cleanupOldSummaries(): Promise<void> {
    try {
      console.log('🧹 Cleaning up old executive summaries (older than 12 months)...');
      
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { error } = await supabase
        .from('executive_summaries')
        .delete()
        .lt('date_range_start', twelveMonthsAgo.toISOString().split('T')[0]);

      if (error) {
        console.error('❌ Error cleaning up old executive summaries:', error);
        return;
      }

      console.log('✅ Old executive summaries cleaned up');
    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }

  /**
   * Sprawdź czy data jest w zakresie ostatnich 12 miesięcy
   */
  isWithinRetentionPeriod(dateRange: { start: string; end: string }): boolean {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const startDate = new Date(dateRange.start);
    return startDate >= twelveMonthsAgo;
  }

  /**
   * Pobierz statystyki cache
   */
  async getCacheStats(): Promise<{
    totalSummaries: number;
    oldestDate: string | null;
    newestDate: string | null;
    summariesInRetention: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('executive_summaries')
        .select('date_range_start, date_range_end');

      if (error) {
        console.error('❌ Error getting cache stats:', error);
        return {
          totalSummaries: 0,
          oldestDate: null,
          newestDate: null,
          summariesInRetention: 0
        };
      }

      if (!data || data.length === 0) {
        return {
          totalSummaries: 0,
          oldestDate: null,
          newestDate: null,
          summariesInRetention: 0
        };
      }

      const dates = data.map(s => s.date_range_start).sort();
      const oldestDate = dates[0] || null;
      const newestDate = dates[dates.length - 1] || null;
      
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const summariesInRetention = data.filter(s => 
        new Date(s.date_range_start) >= twelveMonthsAgo
      ).length;

      return {
        totalSummaries: data.length,
        oldestDate,
        newestDate,
        summariesInRetention
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return {
        totalSummaries: 0,
        oldestDate: null,
        newestDate: null,
        summariesInRetention: 0
      };
    }
  }

  /**
   * Usuń executive summary dla konkretnego klienta i okresu
   */
  async deleteSummary(
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting executive summary: ${clientId} ${dateRange.start}-${dateRange.end}`);
      
      const { error } = await supabase
        .from('executive_summaries')
        .delete()
        .eq('client_id', clientId)
        .eq('date_range_start', dateRange.start)
        .eq('date_range_end', dateRange.end);

      if (error) {
        console.error('❌ Error deleting executive summary:', error);
        return false;
      }

      console.log('✅ Executive summary deleted');
      return true;
    } catch (error) {
      console.error('❌ Error deleting executive summary:', error);
      return false;
    }
  }

  /**
   * Usuń wszystkie executive summaries (tylko dla development/testing)
   */
  async clearAllSummaries(): Promise<boolean> {
    try {
      console.log('🧹 Clearing all executive summaries (development mode)...');
      
      const { error } = await supabase
        .from('executive_summaries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error('❌ Error clearing all executive summaries:', error);
        return false;
      }

      console.log('✅ All executive summaries cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing all executive summaries:', error);
      return false;
    }
  }
} 