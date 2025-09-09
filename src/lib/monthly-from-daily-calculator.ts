/**
 * Monthly Totals from Daily Data Calculator
 * 
 * Calculates monthly totals by summing daily_kpi_data records
 * This ensures consistency between monthly totals and daily metrics
 */

import { supabase } from './supabase';

export interface MonthlyTotals {
  totalClicks: number;
  totalSpend: number;
  totalImpressions: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  // Conversion metrics
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  booking_step_2: number;
  reservations: number;
  reservation_value: number;
  // Metadata
  dataSource: string;
  daysIncluded: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export class MonthlyFromDailyCalculator {
  
  /**
   * Calculate monthly totals from daily_kpi_data records
   * This ensures consistency with daily metrics shown in carousel
   * 
   * STALE DATA STRATEGY: If no data for requested period, returns most recent available data
   * to provide the most accurate possible values instead of zeros
   */
  static async calculateMonthlyTotals(
    clientId: string,
    startDate: string,
    endDate: string,
    platform: 'meta' | 'google' = 'meta'
  ): Promise<MonthlyTotals> {
    
    console.log('📊 Calculating monthly totals from daily data:', {
      clientId, startDate, endDate, platform
    });
    
    try {
      // Get all daily records for the date range
      const { data: dailyRecords, error } = await supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', clientId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
        
      if (error) {
        console.error('❌ Error fetching daily records:', error);
        throw error;
      }
      
      if (!dailyRecords || dailyRecords.length === 0) {
        console.log('⚠️ No daily records found for requested period, trying to get most recent data...');
        
        // STALE DATA STRATEGY: Get most recent available data for this client
        const { data: recentRecords, error: recentError } = await supabase
          .from('daily_kpi_data')
          .select('*')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
          .limit(7); // Get last 7 days of available data
          
        if (recentError || !recentRecords || recentRecords.length === 0) {
          console.log('⚠️ No recent data available either, returning zero totals');
          return this.getZeroTotals(startDate, endDate);
        }
        
        console.log(`✅ Found ${recentRecords.length} recent records as stale fallback`);
        if (recentRecords.length > 0) {
          const firstRecord = recentRecords[0];
          const lastRecord = recentRecords[recentRecords.length - 1];
          console.log(`📅 Most recent data from: ${firstRecord?.date} to ${lastRecord?.date}`);
        }
        
        // Use recent records but mark as stale
        const staleResult = this.aggregateDailyRecords(recentRecords, startDate, endDate);
        staleResult.dataSource = 'daily-aggregated-stale';
        
        console.log('📊 Using stale data as fallback:', {
          totalClicks: staleResult.totalClicks,
          totalSpend: staleResult.totalSpend,
          daysIncluded: staleResult.daysIncluded,
          dataSource: staleResult.dataSource,
          mostRecentDate: recentRecords.length > 0 ? recentRecords[0]?.date : 'unknown'
        });
        
        return staleResult;
      }
      
      console.log(`✅ Found ${dailyRecords.length} daily records to aggregate`);
      
      // Use helper method to aggregate records
      const result = this.aggregateDailyRecords(dailyRecords, startDate, endDate);
      result.dataSource = 'daily-aggregated';
      
      console.log('📊 Monthly totals calculated from daily data:', {
        totalClicks: result.totalClicks,
        totalSpend: result.totalSpend,
        daysIncluded: result.daysIncluded,
        averageCtr: result.averageCtr.toFixed(2) + '%',
        averageCpc: result.averageCpc.toFixed(2),
        dataSource: result.dataSource
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Error calculating monthly totals from daily data:', error);
      return this.getZeroTotals(startDate, endDate);
    }
  }
  
  /**
   * Aggregate daily records into monthly totals
   */
  private static aggregateDailyRecords(
    dailyRecords: any[], 
    startDate: string, 
    endDate: string
  ): MonthlyTotals {
    // Sum all daily records
    const totals = dailyRecords.reduce((acc, record) => {
      return {
        totalClicks: acc.totalClicks + (record.total_clicks || 0),
        totalSpend: acc.totalSpend + (record.total_spend || 0),
        totalImpressions: acc.totalImpressions + (record.total_impressions || 0),
        totalConversions: acc.totalConversions + (record.total_conversions || 0),
        click_to_call: acc.click_to_call + (record.click_to_call || 0),
        email_contacts: acc.email_contacts + (record.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
        reservations: acc.reservations + (record.reservations || 0),
        reservation_value: acc.reservation_value + (record.reservation_value || 0)
      };
    }, {
      totalClicks: 0,
      totalSpend: 0,
      totalImpressions: 0,
      totalConversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      reservations: 0,
      reservation_value: 0
    });
    
    // Calculate derived metrics
    const averageCtr = totals.totalImpressions > 0 
      ? (totals.totalClicks / totals.totalImpressions) * 100 
      : 0;
    const averageCpc = totals.totalClicks > 0 
      ? totals.totalSpend / totals.totalClicks 
      : 0;
    
    return {
      ...totals,
      averageCtr,
      averageCpc,
      dataSource: 'daily-aggregated', // Will be overridden by caller
      daysIncluded: dailyRecords.length,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  }

  /**
   * Get zero totals as fallback
   */
  private static getZeroTotals(startDate: string, endDate: string): MonthlyTotals {
    return {
      totalClicks: 0,
      totalSpend: 0,
      totalImpressions: 0,
      totalConversions: 0,
      averageCtr: 0,
      averageCpc: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      reservations: 0,
      reservation_value: 0,
      dataSource: 'daily-aggregated-zero',
      daysIncluded: 0,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  }
  
  /**
   * Compare monthly totals with daily sum for validation
   */
  static async validateConsistency(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    isConsistent: boolean;
    monthlyTotal: number;
    dailySum: number;
    difference: number;
    percentageDiff: number;
  }> {
    
    const monthlyTotals = await this.calculateMonthlyTotals(clientId, startDate, endDate);
    
    // Get individual daily records for comparison
    const { data: dailyRecords } = await supabase
      .from('daily_kpi_data')
      .select('total_clicks, date')
      .eq('client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate);
    
    const dailySum = dailyRecords?.reduce((sum, record) => sum + (record.total_clicks || 0), 0) || 0;
    const monthlyTotal = monthlyTotals.totalClicks;
    const difference = Math.abs(monthlyTotal - dailySum);
    const percentageDiff = monthlyTotal > 0 ? (difference / monthlyTotal) * 100 : 0;
    
    console.log('🔍 Consistency validation:', {
      monthlyTotal,
      dailySum,
      difference,
      percentageDiff: percentageDiff.toFixed(2) + '%',
      isConsistent: difference === 0
    });
    
    return {
      isConsistent: difference === 0,
      monthlyTotal,
      dailySum,
      difference,
      percentageDiff
    };
  }
}
