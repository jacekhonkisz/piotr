import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/cache-monitoring/refresh-all
 * 
 * Manually trigger cache refresh for all cache systems (Meta and Google Ads)
 * Works in both development and production environments
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual cache refresh triggered');
    
    // Get the base URL for the current environment
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    console.log(`🌐 Using base URL: ${baseUrl}`);
    
    // Prepare all refresh endpoints
    const refreshEndpoints = [
      { name: 'Meta Monthly Cache', path: '/api/automated/refresh-current-month-cache' },
      { name: 'Meta Weekly Cache', path: '/api/automated/refresh-current-week-cache' },
      { name: 'Google Ads Monthly Cache', path: '/api/automated/refresh-google-ads-current-month-cache' },
      { name: 'Google Ads Weekly Cache', path: '/api/automated/refresh-google-ads-current-week-cache' }
    ];
    
    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`📋 Refreshing ${refreshEndpoints.length} cache systems...`);
    
    // Execute refreshes sequentially to avoid overwhelming the system
    for (const endpoint of refreshEndpoints) {
      const startTime = Date.now();
      try {
        console.log(`🔄 Refreshing ${endpoint.name}...`);
        
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CacheMonitoring/ManualRefresh'
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint.name} refreshed successfully in ${responseTime}ms`);
          
          successCount++;
          results.push({
            name: endpoint.name,
            status: 'success',
            responseTime,
            details: data.summary || data
          });
        } else {
          const errorText = await response.text();
          console.error(`❌ ${endpoint.name} failed with status ${response.status}`);
          
          errorCount++;
          results.push({
            name: endpoint.name,
            status: 'error',
            responseTime,
            error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`
          });
        }
        
        // Add a small delay between requests to be gentle on the system
        if (endpoint !== refreshEndpoints[refreshEndpoints.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ ${endpoint.name} refresh failed:`, error);
        
        errorCount++;
        results.push({
          name: endpoint.name,
          status: 'error',
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`✅ Manual cache refresh completed: ${successCount} successful, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Cache refresh completed`,
      summary: {
        total: refreshEndpoints.length,
        successful: successCount,
        errors: errorCount
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual cache refresh failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger cache refresh',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Support GET for testing
export async function GET(request: NextRequest) {
  return POST(request);
}

