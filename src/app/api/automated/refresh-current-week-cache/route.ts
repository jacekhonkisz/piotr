import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';
import { getCurrentWeekInfo } from '../../../../lib/week-utils';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    logger.info('Automated weekly cache refresh started', { endpoint: '/api/automated/refresh-current-week-cache' });
    
    // Get current week info
    const currentWeek = getCurrentWeekInfo();
    
    // Get all active clients that need cache refresh
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, api_status')
      .eq('api_status', 'valid'); // Include ALL valid clients
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      logger.info('No active clients found for weekly cache refresh');
      return NextResponse.json({
        success: true,
        message: 'No active clients found for weekly cache refresh',
        processed: 0
      });
    }
    
    console.log(`🔄 Starting automated weekly cache refresh for ${clients.length} active clients`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const results: any[] = [];
    
    // Process clients in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (client) => {
        // Skip clients without required Meta credentials
        if (!client.meta_access_token || !client.ad_account_id) {
          console.log(`⏭️ Skipping ${client.name} - missing Meta credentials`);
          skippedCount++;
          return {
            clientId: client.id,
            clientName: client.name,
            status: 'skipped',
            reason: 'missing-credentials'
          };
        }
        
        // Add retry logic for each client
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📊 Refreshing weekly cache for client: ${client.name} (${client.id}) - attempt ${attempt}`);
            
            // Check if cache needs refresh (older than 2.5 hours to be safe)
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
              console.log(`⏭️ Skipping ${client.name} - cache is still fresh (${ageHours.toFixed(1)}h old)`);
              skippedCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'skipped',
                reason: 'cache-fresh'
              };
            }
            
            // Call smart weekly cache API to refresh
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')
              : 'http://localhost:3000';
            
            const response = await fetch(`${baseUrl}/api/smart-weekly-cache`, {
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
                  campaignCount: data.data?.campaigns?.length || 0
                };
              } else {
                throw new Error(data.error || 'Unknown error');
              }
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
          } catch (error) {
            console.error(`❌ Attempt ${attempt} failed for ${client.name}:`, error);
            
            if (attempt === maxRetries) {
              errorCount++;
              return {
                clientId: client.id,
                clientName: client.name,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                attempts: maxRetries
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
      message: `Weekly cache refresh completed for ${clients.length} active clients`,
      summary: {
        totalClients: clients.length,
        successCount,
        errorCount,
        skippedCount
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