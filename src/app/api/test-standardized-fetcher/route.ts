import { NextRequest, NextResponse } from 'next/server';
import { StandardizedDataFetcher } from '../../../lib/standardized-data-fetcher';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🧪 Testing StandardizedDataFetcher for Belmonte September 2025...\n');
    
    // Belmonte client ID from database
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    // September 2025 date range
    const dateRange = {
      start: '2025-09-01',
      end: '2025-09-30'
    };
    
    console.log('📊 Test Parameters:');
    console.log(`  Client ID: ${clientId}`);
    console.log(`  Date Range: ${dateRange.start} to ${dateRange.end}`);
    console.log(`  Platform: meta`);
    console.log(`  Reason: audit-test\n`);
    
    // Test Meta platform
    console.log('🎯 Testing Meta platform...');
    const metaResult = await StandardizedDataFetcher.fetchData({
      clientId,
      dateRange,
      platform: 'meta',
      reason: 'audit-test'
    });
    
    console.log('📈 Meta Results:');
    console.log(`  Success: ${metaResult.success}`);
    console.log(`  Source: ${metaResult.debug?.source}`);
    console.log(`  Cache Policy: ${metaResult.debug?.cachePolicy}`);
    console.log(`  Response Time: ${metaResult.debug?.responseTime}ms`);
    console.log(`  Period Type: ${metaResult.debug?.periodType}`);
    console.log(`  Data Source Priority: ${metaResult.debug?.dataSourcePriority?.join(' → ')}`);
    console.log(`  Validation: ${metaResult.validation?.isConsistent ? '✅ Consistent' : '❌ Inconsistent'}`);
    console.log(`  Expected Source: ${metaResult.validation?.expectedSource}`);
    console.log(`  Actual Source: ${metaResult.validation?.actualSource}\n`);
    
    let analysis = '';
    if (metaResult.success) {
      const spend = metaResult.data.stats?.totalSpend || 0;
      if (spend > 5000) {
        analysis += '✅ GOOD: Meta spend is above 5k PLN - smart cache working properly\n';
      } else if (spend > 0) {
        analysis += '⚠️  WARNING: Meta spend is low - may be using fallback data\n';
      } else {
        analysis += '❌ ERROR: No Meta spend data - smart cache failed\n';
      }
    } else {
      analysis += '❌ ERROR: Meta data fetch failed completely\n';
    }
    
    if (metaResult.debug?.source === 'smart-cache-system') {
      analysis += '✅ Smart cache is being used correctly\n';
    } else if (metaResult.debug?.source === 'campaign-summaries-database') {
      analysis += '⚠️  Using database fallback instead of smart cache\n';
    } else if (metaResult.debug?.source === 'live-api-with-cache-storage') {
      analysis += '⚠️  Using live API fallback - smart cache may be failing\n';
    } else {
      analysis += '❌ Unknown data source - investigate further\n';
    }
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      testResults: {
        meta: {
          success: metaResult.success,
          source: metaResult.debug?.source,
          cachePolicy: metaResult.debug?.cachePolicy,
          responseTime: metaResult.debug?.responseTime,
          periodType: metaResult.debug?.periodType,
          dataSourcePriority: metaResult.debug?.dataSourcePriority,
          validation: metaResult.validation,
          stats: metaResult.data?.stats,
          conversionMetrics: metaResult.data?.conversionMetrics,
          campaignsCount: metaResult.data?.campaigns?.length || 0
        },
        analysis,
        totalResponseTime: responseTime
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}
