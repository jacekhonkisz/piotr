/**
 * Batch Weekly Collection API
 * 
 * Collects weekly data in batches to avoid timeouts
 * Can be called multiple times to collect all historical data
 * 
 * Query params:
 * - startWeek: Week offset to start from (0 = current week)
 * - batchSize: Number of weeks to collect (default: 5)
 * 
 * Example: /api/automated/collect-weeks-batch?startWeek=0&batchSize=5
 */

import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Vercel cron jobs only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔒 SECURITY: Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const providedSecret = authHeader?.replace('Bearer ', '');
    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startWeek = parseInt(searchParams.get('startWeek') || '0');
    const batchSize = parseInt(searchParams.get('batchSize') || '5');
    const platform = (searchParams.get('platform') || 'meta') as 'meta' | 'google';

    console.log(`🔄 Starting batch collection: startWeek=${startWeek}, batchSize=${batchSize}, platform=${platform}`);

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return NextResponse.json(
        { error: 'No active clients found' },
        { status: 404 }
      );
    }

    const results = {
      successful: 0,
      failed: 0,
      weeksCollected: [] as string[],
      errors: [] as any[]
    };

    // Collect data for each client
    for (const client of clients) {
      try {
        console.log(`📊 Collecting ${batchSize} weeks for client: ${client.name} (starting from week ${startWeek})`);
        
        const collector = BackgroundDataCollector.getInstance();
        
        // Calculate which weeks to collect
        const now = new Date();
        const weeksToCollect = [];
        
        for (let i = startWeek; i < startWeek + batchSize; i++) {
          // Calculate the date for this week
          const weekDate = new Date(now);
          weekDate.setDate(weekDate.getDate() - (i * 7));
          
          // Get Monday of that week (ISO week start)
          const dayOfWeek = weekDate.getDay();
          const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
          weekDate.setDate(weekDate.getDate() + diff);
          
          const weekStart = weekDate.toISOString().split('T')[0];
          weeksToCollect.push({
            offset: i,
            startDate: weekStart
          });
        }

        console.log(`📅 Weeks to collect:`, weeksToCollect.map(w => `Week -${w.offset} (${w.startDate})`));

        // Collect each week
        for (const week of weeksToCollect) {
          try {
            // Use the existing collectWeeklySummaryForClient method
            // But we need to trigger it for a specific date
            const weekEndDate = new Date(week.startDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
            const weekEnd = weekEndDate.toISOString().split('T')[0];

            console.log(`📊 Collecting week: ${week.startDate} to ${weekEnd}`);

            // Call the Meta API directly for this specific week
            if (platform === 'meta') {
              const { MetaAPIService } = await import('@/lib/meta-api-optimized');
              const metaService = new MetaAPIService(client.meta_access_token);
              const adAccountId = client.ad_account_id?.startsWith('act_')
                ? client.ad_account_id.substring(4)
                : client.ad_account_id;

              const campaigns = await metaService.getCampaignInsights(
                adAccountId,
                week.startDate,
                weekEnd,
                0
              );

              // Process and store the data
              const totals = {
                spend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
                impressions: campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
                clicks: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
                conversions: campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0),
                ctr: 0,
                cpc: 0
              };

              totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
              totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

              // Store in database using private method access
              await (collector as any).storeWeeklySummary(client.id, {
                summary_date: week.startDate,
                campaigns,
                totals,
                isCurrentWeek: week.offset === 0,
                conversionMetrics: {
                  click_to_call: campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0),
                  email_contacts: campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0),
                  booking_step_1: campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
                  booking_step_2: campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
                  booking_step_3: campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
                  reservations: campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0),
                  reservation_value: campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0)
                }
              }, platform);

              console.log(`✅ Stored week ${week.startDate} with ${campaigns.length} campaigns`);
              results.weeksCollected.push(week.startDate);
            }

          } catch (weekError: any) {
            console.error(`❌ Error collecting week ${week.startDate}:`, weekError);
            results.errors.push({
              week: week.startDate,
              error: weekError.message
            });
          }
        }

        results.successful++;
        console.log(`✅ Completed batch for client: ${client.name}`);

      } catch (clientError: any) {
        console.error(`❌ Error processing client ${client.name}:`, clientError);
        results.failed++;
        results.errors.push({
          client: client.name,
          error: clientError.message
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Batch collection completed in ${duration}ms`);
    console.log(`📊 Results: ${results.successful} successful, ${results.failed} failed`);
    console.log(`📅 Weeks collected: ${results.weeksCollected.length}`);

    return NextResponse.json({
      success: true,
      message: `Batch collection completed`,
      results: {
        startWeek,
        batchSize,
        platform,
        clientsProcessed: results.successful,
        clientsFailed: results.failed,
        weeksCollected: results.weeksCollected,
        totalWeeks: results.weeksCollected.length,
        errors: results.errors,
        durationMs: duration
      }
    });

  } catch (error: any) {
    console.error('❌ Batch collection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack
      },
      { status: 500 }
    );
  }
}

