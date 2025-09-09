/**
 * Clear Daily Metrics Cache API
 * 
 * Week 3 Enhancement: Allows admin to clear daily metrics cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { DailyMetricsCache } from '../../../../lib/daily-metrics-cache';

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ Admin: Clearing daily metrics cache');
    
    // Get clientId from query params if provided
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    if (clientId) {
      console.log(`🗑️ Clearing cache for specific client: ${clientId}`);
      DailyMetricsCache.clearCache(clientId);
    } else {
      console.log('🗑️ Clearing all daily metrics cache');
      DailyMetricsCache.clearCache();
    }
    
    // Get updated stats after clearing
    const updatedStats = DailyMetricsCache.getCacheStats();
    
    console.log('✅ Cache cleared successfully, new stats:', updatedStats);
    
    return NextResponse.json({
      success: true,
      message: clientId 
        ? `Cache cleared for client ${clientId}` 
        : 'All daily metrics cache cleared',
      newStats: updatedStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
