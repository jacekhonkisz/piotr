import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  return {
    year,
    month,
    periodId: `${year}-${String(month).padStart(2, '0')}`
  };
}

function getCurrentWeekInfo() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Calculate week number (ISO week)
  const startOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  
  return {
    year,
    weekNumber,
    periodId: `${year}-W${String(weekNumber).padStart(2, '0')}`
  };
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('3-hour automated cache refresh started', { 
      endpoint: '/api/automated/refresh-3hour-cache',
      timestamp: new Date().toISOString()
    });
    
    // Get current period info
    const currentMonth = getCurrentMonthInfo();
    const currentWeek = getCurrentWeekInfo();
    
    // Get all active clients with valid Meta tokens
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No clients found for 3-hour cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No clients found for 3-hour cache refresh',
        processed: 0,
        responseTime: Date.now() - startTime
      });
    }
    
    console.log(`🔄 Starting 3-hour automated refresh for ${clients.length} clients`);
    console.log(`📅 Current Month: ${currentMonth.periodId}`);
    console.log(`📅 Current Week: ${currentWeek.periodId}`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const results: any[] = [];
    
    // Process clients in batches to avoid overwhelming the system
    const batchSize = 2; // Smaller batches for 3-hour refresh
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(clients.length/batchSize)}`);
      
      const batchPromises = batch.map(async (client) => {
        const clientStartTime = Date.now();
        
        try {
          console.log(`📊 Processing 3-hour refresh for: ${client.name} (${client.id})`);
          
          // Check monthly cache age
          const { data: monthlyCache } = await supabase
            .from('current_month_cache')
            .select('last_updated')
            .eq('client_id', client.id)
            .eq('period_id', currentMonth.periodId)
            .maybeSingle();
          
          // Check weekly cache age
          const { data: weeklyCache } = await supabase
            .from('current_week_cache')
            .select('last_updated')
            .eq('client_id', client.id)
            .eq('period_id', currentWeek.periodId)
            .maybeSingle();
          
          const now = new Date().getTime();
          
          // Calculate ages
          const monthlyAge = monthlyCache ? 
            (now - new Date(monthlyCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
          const weeklyAge = weeklyCache ? 
            (now - new Date(weeklyCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
          
          // Determine if refresh is needed (3+ hours old or missing)
          const needsMonthlyRefresh = monthlyAge >= 3;
          const needsWeeklyRefresh = weeklyAge >= 3;
          
          console.log(`📊 ${client.name} cache status:`, {
            monthlyAge: monthlyAge.toFixed(1) + 'h',
            weeklyAge: weeklyAge.toFixed(1) + 'h',
            needsMonthlyRefresh,
            needsWeeklyRefresh
          });
          
                     let monthlyResult: any = { status: 'skipped', reason: 'fresh' };
           let weeklyResult: any = { status: 'skipped', reason: 'fresh' };
          
                     // Refresh monthly cache if needed
           if (needsMonthlyRefresh) {
             try {
               console.log(`🔄 Refreshing monthly cache for ${client.name}...`);
               
               // Use getSmartCacheData directly instead of HTTP call
               const { getSmartCacheData } = await import('../../../../lib/smart-cache-helper');
               const cacheResult = await getSmartCacheData(client.id, true); // force refresh
               
               if (cacheResult.success) {
                 monthlyResult = { 
                   status: 'success', 
                   campaigns: cacheResult.data?.campaigns?.length || 0,
                   spend: cacheResult.data?.stats?.totalSpend || 0
                 };
                 console.log(`✅ Monthly refresh completed for ${client.name}`);
               } else {
                 monthlyResult = { 
                   status: 'error', 
                   error: 'Smart cache refresh failed' 
                 };
                 console.log(`❌ Monthly refresh failed for ${client.name}`);
               }
             } catch (refreshError) {
               monthlyResult = { 
                 status: 'error', 
                 error: refreshError instanceof Error ? refreshError.message : 'Unknown error' 
               };
               console.log(`❌ Monthly refresh error for ${client.name}:`, refreshError);
             }
           }
          
          // Small delay between monthly and weekly refresh
          if (needsMonthlyRefresh && needsWeeklyRefresh) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
                                // Refresh weekly cache if needed
           if (needsWeeklyRefresh) {
             try {
               console.log(`🔄 Refreshing weekly cache for ${client.name}...`);
               
               // Use getSmartWeekCacheData directly instead of HTTP call
               const { getSmartWeekCacheData } = await import('../../../../lib/smart-cache-helper');
               const weeklyCacheResult = await getSmartWeekCacheData(client.id, true); // force refresh
               
               if (weeklyCacheResult.success) {
                 weeklyResult = { 
                   status: 'success',
                   campaigns: weeklyCacheResult.data?.campaigns?.length || 0
                 };
                 console.log(`✅ Weekly refresh completed for ${client.name}`);
               } else {
                 weeklyResult = { 
                   status: 'error', 
                   error: 'Smart weekly cache refresh failed' 
                 };
                 console.log(`❌ Weekly refresh failed for ${client.name}`);
               }
             } catch (refreshError) {
               weeklyResult = { 
                 status: 'error', 
                 error: refreshError instanceof Error ? refreshError.message : 'Unknown error' 
               };
               console.log(`❌ Weekly refresh error for ${client.name}:`, refreshError);
             }
           }
          
          const clientResponseTime = Date.now() - clientStartTime;
          
          // Determine overall status
          let overallStatus = 'skipped';
          if ((needsMonthlyRefresh && monthlyResult.status === 'success') || 
              (needsWeeklyRefresh && weeklyResult.status === 'success')) {
            overallStatus = 'success';
            successCount++;
          } else if ((needsMonthlyRefresh && monthlyResult.status === 'error') || 
                     (needsWeeklyRefresh && weeklyResult.status === 'error')) {
            overallStatus = 'error';
            errorCount++;
          } else {
            overallStatus = 'skipped';
            skippedCount++;
          }
          
          return {
            clientId: client.id,
            clientName: client.name,
            status: overallStatus,
            monthlyCache: monthlyResult,
            weeklyCache: weeklyResult,
            responseTime: clientResponseTime,
            refreshedAt: new Date().toISOString()
          };
          
        } catch (error) {
          errorCount++;
          console.error(`❌ 3-hour refresh failed for ${client.name}:`, error);
          
          return {
            clientId: client.id,
            clientName: client.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - clientStartTime
          };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < clients.length) {
        console.log('⏸️ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    const totalResponseTime = Date.now() - startTime;
    
    // Log summary
    console.log(`✅ 3-hour refresh completed:`, {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      skipped: skippedCount,
      totalTime: `${(totalResponseTime / 1000).toFixed(1)}s`
    });
    
    logger.info('3-hour automated cache refresh completed', {
      totalClients: clients.length,
      successful: successCount,
      errors: errorCount,
      skipped: skippedCount,
      responseTime: totalResponseTime
    });
    
    return NextResponse.json({
      success: true,
      message: '3-hour automated cache refresh completed',
      summary: {
        totalClients: clients.length,
        successful: successCount,
        errors: errorCount,
        skipped: skippedCount,
        responseTime: totalResponseTime
      },
      results: results
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ 3-hour automated refresh failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('3-hour automated cache refresh failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      success: false,
      error: '3-hour automated refresh failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 