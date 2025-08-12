import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get current week info
function getCurrentWeekInfo() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Get ISO week number (Monday = start of week)
  const date = new Date(now.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1
  const week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count weeks from there
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  
  return {
    year,
    week: weekNumber,
    periodId: `${year}-W${String(weekNumber).padStart(2, '0')}`
  };
}

export async function POST() {
  const startTime = Date.now();
  
  try {
    logger.info('Automated weekly cache refresh started', { endpoint: '/api/automated/refresh-current-week-cache' });
    
    // Get current week info
    const currentWeek = getCurrentWeekInfo();
    
    // Get all active clients that need weekly cache refresh
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No clients found for weekly cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No clients found for weekly cache refresh',
        processed: 0
      });
    }
    
    console.log(`🔄 Starting automated weekly cache refresh for ${clients.length} clients`);
    
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    
    // Process clients in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (client) => {
        try {
          console.log(`📊 Refreshing weekly cache for client: ${client.name} (${client.id})`);
          
          // Check if weekly cache needs refresh (older than 2.5 hours to be safe)
          const { data: cachedData } = await supabase
            .from('current_week_cache')
            .select('last_updated')
            .eq('client_id', client.id)
            .eq('period_id', currentWeek.periodId)
            .single();
          
          const now = new Date().getTime();
          const cacheTime = cachedData ? new Date(cachedData.last_updated).getTime() : 0;
          const ageHours = (now - cacheTime) / (1000 * 60 * 60);
          
          if (cachedData && ageHours < 2.5) {
            console.log(`⏭️ Skipping ${client.name} - weekly cache is still fresh (${ageHours.toFixed(1)}h old)`);
            return {
              clientId: client.id,
              clientName: client.name,
              status: 'skipped',
              reason: 'weekly-cache-fresh'
            };
          }
          
          // Call weekly smart cache API to refresh
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')}/api/smart-weekly-cache`, {
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
              console.log(`✅ Successfully refreshed weekly cache for ${client.name}`);
              successCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'success',
                campaignCount: data.data?.campaigns?.length || 0,
                period: 'weekly'
              };
            } else {
              throw new Error(data.error || 'Unknown error');
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to refresh weekly cache for ${client.name}:`, error);
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
    
    logger.info('Automated weekly cache refresh completed', {
      totalClients: clients.length,
      successCount,
      errorCount,
      responseTime,
      period: 'weekly'
    });
    
    return NextResponse.json({
      success: true,
      message: `Weekly cache refresh completed for ${clients.length} clients`,
      summary: {
        totalClients: clients.length,
        successCount,
        errorCount,
        skippedCount: results.filter(r => r.status === 'skipped').length,
        period: 'weekly'
      },
      results,
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Automated weekly cache refresh failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Automated weekly cache refresh failed', { 
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