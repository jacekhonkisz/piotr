/**
 * AI Summary Cost Tracker
 * 
 * Tracks and monitors AI summary generation costs to prevent budget overruns
 */

import logger from './logger';

interface CostEntry {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface DailyCostSummary {
  date: string;
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
}

class AISummaryCostTracker {
  private static instance: AISummaryCostTracker;
  private costs: Map<string, CostEntry> = new Map();
  private readonly costPerToken = 0.0015 / 1000; // $0.0015 per 1K tokens for GPT-3.5-turbo
  
  // Cost limits
  private readonly maxDailyCost = 10.0; // $10 per day
  private readonly maxMonthlyCost = 300.0; // $300 per month
  
  private constructor() {}
  
  static getInstance(): AISummaryCostTracker {
    if (!AISummaryCostTracker.instance) {
      AISummaryCostTracker.instance = new AISummaryCostTracker();
    }
    return AISummaryCostTracker.instance;
  }
  
  /**
   * Record a cost for AI summary generation
   * @param tokens - Number of tokens used
   * @param date - Date of the request (defaults to today)
   */
  recordCost(tokens: number, date?: string): void {
    const requestDate = date || new Date().toISOString().split('T')[0];
    const cost = tokens * this.costPerToken;
    
    const existingEntry = this.costs.get(requestDate);
    if (existingEntry) {
      existingEntry.tokens += tokens;
      existingEntry.cost += cost;
      existingEntry.requests += 1;
    } else {
      this.costs.set(requestDate, {
        date: requestDate,
        tokens,
        cost,
        requests: 1
      });
    }
    
    logger.info('💰 AI Summary cost recorded:', {
      date: requestDate,
      tokens,
      cost: cost.toFixed(4),
      totalDailyCost: this.getDailyCost(requestDate).toFixed(4)
    });
  }
  
  /**
   * Get daily cost for a specific date
   * @param date - Date to check (defaults to today)
   * @returns Daily cost in USD
   */
  getDailyCost(date?: string): number {
    const requestDate = date || new Date().toISOString().split('T')[0];
    const entry = this.costs.get(requestDate);
    return entry ? entry.cost : 0;
  }
  
  /**
   * Get monthly cost for a specific month
   * @param year - Year to check
   * @param month - Month to check (1-12)
   * @returns Monthly cost in USD
   */
  getMonthlyCost(year: number, month: number): number {
    const monthStr = month.toString().padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    
    let totalCost = 0;
    for (const [date, entry] of this.costs.entries()) {
      if (date.startsWith(prefix)) {
        totalCost += entry.cost;
      }
    }
    
    return totalCost;
  }
  
  /**
   * Check if daily cost limit is exceeded
   * @param date - Date to check (defaults to today)
   * @returns Object with limit status
   */
  checkDailyLimit(date?: string): { exceeded: boolean; current: number; limit: number } {
    const current = this.getDailyCost(date);
    return {
      exceeded: current > this.maxDailyCost,
      current,
      limit: this.maxDailyCost
    };
  }
  
  /**
   * Check if monthly cost limit is exceeded
   * @param year - Year to check
   * @param month - Month to check (1-12)
   * @returns Object with limit status
   */
  checkMonthlyLimit(year: number, month: number): { exceeded: boolean; current: number; limit: number } {
    const current = this.getMonthlyCost(year, month);
    return {
      exceeded: current > this.maxMonthlyCost,
      current,
      limit: this.maxMonthlyCost
    };
  }
  
  /**
   * Get cost summary for a date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Array of daily cost summaries
   */
  getCostSummary(startDate: string, endDate: string): DailyCostSummary[] {
    const summaries: DailyCostSummary[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const entry = this.costs.get(dateStr);
      
      if (entry) {
        summaries.push({
          date: dateStr,
          totalTokens: entry.tokens,
          totalCost: entry.cost,
          totalRequests: entry.requests,
          averageCostPerRequest: entry.cost / entry.requests
        });
      }
    }
    
    return summaries;
  }
  
  /**
   * Get total cost for all recorded data
   * @returns Total cost in USD
   */
  getTotalCost(): number {
    let total = 0;
    for (const entry of this.costs.values()) {
      total += entry.cost;
    }
    return total;
  }
  
  /**
   * Get cost statistics
   * @returns Object with cost statistics
   */
  getCostStats(): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    averageCostPerRequest: number;
    averageTokensPerRequest: number;
    dailyAverage: number;
    monthlyAverage: number;
  } {
    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;
    let days = 0;
    
    for (const entry of this.costs.values()) {
      totalCost += entry.cost;
      totalTokens += entry.tokens;
      totalRequests += entry.requests;
      days++;
    }
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthlyCost = this.getMonthlyCost(currentYear, currentMonth);
    
    return {
      totalCost,
      totalTokens,
      totalRequests,
      averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
      dailyAverage: days > 0 ? totalCost / days : 0,
      monthlyAverage: monthlyCost
    };
  }
  
  /**
   * Clear old cost data (older than specified days)
   * @param daysToKeep - Number of days to keep (defaults to 90)
   */
  clearOldData(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    let removedCount = 0;
    for (const [date, entry] of this.costs.entries()) {
      if (date < cutoffStr) {
        this.costs.delete(date);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.info(`🧹 Cleared ${removedCount} old cost entries (older than ${daysToKeep} days)`);
    }
  }
  
  /**
   * Export cost data for analysis
   * @returns Array of all cost entries
   */
  exportCostData(): CostEntry[] {
    return Array.from(this.costs.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export default AISummaryCostTracker;
