/**
 * Daily Metrics Cache Statistics API
 * 
 * Week 3 Enhancement: Provides cache statistics for admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { DailyMetricsCache } from '../../../../lib/daily-metrics-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin: Getting daily metrics cache statistics');
    
    // Get cache statistics from DailyMetricsCache
    const stats = DailyMetricsCache.getCacheStats();
    
    console.log('✅ Cache stats retrieved:', stats);
    
    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        size: 0,
        keys: []
      },
      { status: 500 }
    );
  }
}
