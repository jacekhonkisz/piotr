import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get current month info
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

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('Automated cache refresh started', { endpoint: '/api/automated/refresh-current-month-cache' });
    
    // Get current month info
    const currentMonth = getCurrentMonthInfo();
    
    // Get all active clients that need cache refresh
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No clients found for cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No clients found for cache refresh',
        processed: 0
      });
    }
    
    console.log(`🔄 Starting automated cache refresh for ${clients.length} clients`);
    
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    
    // Process clients in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (client) => {
        try {
          console.log(`📊 Refreshing cache for client: ${client.name} (${client.id})`);
          
          // Check if cache needs refresh (older than 2.5 hours to be safe)
          const { data: cachedData } = await supabase
            .from('current_month_cache')
            .select('last_updated')
            .eq('client_id', client.id)
            .eq('period_id', currentMonth.periodId)
            .single();
          
          const now = new Date().getTime();
          const cacheTime = cachedData ? new Date(cachedData.last_updated).getTime() : 0;
          const ageHours = (now - cacheTime) / (1000 * 60 * 60);
          
          if (cachedData && ageHours < 2.5) {
            console.log(`⏭️ Skipping ${client.name} - cache is still fresh (${ageHours.toFixed(1)}h old)`);
            return {
              clientId: client.id,
              clientName: client.name,
              status: 'skipped',
              reason: 'cache-fresh'
            };
          }
          
          // Call smart cache API to refresh
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')}/api/smart-cache`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
              clientId: client.id,
              forceRefresh: true 
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              console.log(`✅ Successfully refreshed cache for ${client.name}`);
              successCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'success',
                campaignCount: data.data?.campaigns?.length || 0
              };
            } else {
              throw new Error(data.error || 'Unknown error');
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to refresh cache for ${client.name}:`, error);
          errorCount++;
          return {
            clientId: client.id,
            clientName: client.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be gentle on Meta API
      if (i + batchSize < clients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Automated cache refresh completed', {
      totalClients: clients.length,
      successCount,
      errorCount,
      responseTime
    });
    
    return NextResponse.json({
      success: true,
      message: `Cache refresh completed for ${clients.length} clients`,
      summary: {
        totalClients: clients.length,
        successCount,
        errorCount,
        skippedCount: results.filter(r => r.status === 'skipped').length
      },
      results,
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Automated cache refresh failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Automated cache refresh failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 