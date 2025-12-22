import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';
import { getCurrentWeekInfo } from '../../../../lib/week-utils';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

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

// Using centralized getCurrentWeekInfo from week-utils.ts

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  // For Vercel cron jobs - they only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
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
    // ✅ FIX: Select BOTH meta_access_token AND system_user_token
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, system_user_token, ad_account_id, api_status')
      .eq('api_status', 'valid'); // Include ALL valid clients
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No active clients found for 3-hour cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No active clients found for 3-hour cache refresh',
        processed: 0,
        responseTime: Date.now() - startTime
      });
    }
    
    console.log(`🔄 Starting 3-hour automated refresh for ${clients.length} active clients`);
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
        
        // ✅ FIX: Check for EITHER system_user_token OR meta_access_token
        const metaToken = (client as any).system_user_token || client.meta_access_token;
        
        // Skip clients without required Meta credentials
        if (!metaToken || !client.ad_account_id) {
          console.log(`⏭️ Skipping ${client.name} - missing Meta credentials`);
          skippedCount++;
          return {
            clientId: client.id,
            clientName: client.name,
            status: 'skipped',
            reason: 'missing-credentials',
            responseTime: Date.now() - clientStartTime
          };
        }
        
        // Add retry logic for each client
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📊 Processing 3-hour refresh for: ${client.name} (${client.id}) - attempt ${attempt}`);
            
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
            const monthlyAge = monthlyCache ? (now - new Date(monthlyCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
            const weeklyAge = weeklyCache ? (now - new Date(weeklyCache.last_updated).getTime()) / (1000 * 60 * 60) : 999;
            
            // Skip if both caches are fresh (less than 2.5 hours old)
            if (monthlyAge < 2.5 && weeklyAge < 2.5) {
              console.log(`⏭️ Skipping ${client.name} - caches are fresh (monthly: ${monthlyAge.toFixed(1)}h, weekly: ${weeklyAge.toFixed(1)}h)`);
              skippedCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'skipped',
                reason: 'cache-fresh',
                monthlyAge: monthlyAge.toFixed(1),
                weeklyAge: weeklyAge.toFixed(1),
                responseTime: Date.now() - clientStartTime
              };
            }
            
            // Refresh monthly cache if needed
            if (monthlyAge >= 2.5) {
              console.log(`🔄 Refreshing monthly cache for ${client.name} (${monthlyAge.toFixed(1)}h old)`);
              
              const baseUrl = process.env.NODE_ENV === 'production' 
                ? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')
                : 'http://localhost:3000';
              
              const monthlyResponse = await fetch(`${baseUrl}/api/smart-cache`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // ✅ FIX: Use CRON_SECRET for internal cron calls
                  'Authorization': `Bearer ${process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ 
                  clientId: client.id,
                  forceRefresh: true 
                })
              });
              
              if (!monthlyResponse.ok) {
                throw new Error(`Monthly cache refresh failed: HTTP ${monthlyResponse.status}`);
              }
            }
            
            // Refresh weekly cache if needed
            if (weeklyAge >= 2.5) {
              console.log(`🔄 Refreshing weekly cache for ${client.name} (${weeklyAge.toFixed(1)}h old)`);
              
              const baseUrl = process.env.NODE_ENV === 'production' 
                ? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')
                : 'http://localhost:3000';
              
              const weeklyResponse = await fetch(`${baseUrl}/api/smart-weekly-cache`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // ✅ FIX: Use CRON_SECRET for internal cron calls
                  'Authorization': `Bearer ${process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ 
                  clientId: client.id,
                  forceRefresh: true 
                })
              });
              
              if (!weeklyResponse.ok) {
                throw new Error(`Weekly cache refresh failed: HTTP ${weeklyResponse.status}`);
              }
            }
            
            console.log(`✅ Successfully refreshed caches for ${client.name}`);
            successCount++;
            return {
              clientId: client.id,
              clientName: client.name,
              status: 'success',
              monthlyAge: monthlyAge.toFixed(1),
              weeklyAge: weeklyAge.toFixed(1),
              responseTime: Date.now() - clientStartTime
            };
            
          } catch (error) {
            console.error(`❌ Attempt ${attempt} failed for ${client.name}:`, error);
            
            if (attempt === maxRetries) {
              errorCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                attempts: maxRetries,
                responseTime: Date.now() - clientStartTime
              };
            } else {
              // Wait before retry with exponential backoff
              const delayMs = Math.pow(2, attempt) * 1000;
              console.log(`⏳ Waiting ${delayMs}ms before retry for ${client.name}`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }
        
        // This should never be reached, but TypeScript requires it
        throw new Error(`Unexpected end of retry loop for ${client.name}`);
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be gentle on Meta API
      if (i + batchSize < clients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
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
      message: `3-hour cache refresh completed for ${clients.length} active clients`,
      summary: {
        totalClients: clients.length,
        successCount,
        errorCount,
        skippedCount
      },
      results,
      responseTime: Date.now() - startTime
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