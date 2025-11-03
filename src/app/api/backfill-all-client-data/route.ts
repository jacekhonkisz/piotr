import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { MetaAPIService } from '../../../lib/meta-api-optimized';
import { ProductionDataManager } from '../../../lib/production-data-manager';
import logger from '../../../lib/logger';

/**
 * BACKFILL ALL CLIENT DATA ENDPOINT
 * 
 * Comprehensive endpoint to backfill missing historical data for all clients
 * across all platforms (Meta Ads and Google Ads)
 * 
 * Usage:
 * POST /api/backfill-all-client-data
 * {
 *   "monthsToBackfill": 6,  // Optional, defaults to 12
 *   "clientIds": [],         // Optional, if empty processes all clients
 *   "platform": "all",       // "all", "meta", or "google"
 *   "forceRefresh": false    // If true, re-fetch even if data exists
 * }
 */

interface BackfillRequest {
  monthsToBackfill?: number;
  clientIds?: string[];
  platform?: 'all' | 'meta' | 'google';
  forceRefresh?: boolean;
}

interface BackfillResult {
  clientId: string;
  clientName: string;
  month: string;
  platform: 'meta' | 'google';
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  metrics?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 Starting comprehensive data backfill...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Parse request body
    const body: BackfillRequest = await request.json().catch(() => ({}));
    const monthsToBackfill = body.monthsToBackfill || 12;
    const targetClientIds = body.clientIds || [];
    const platformFilter = body.platform || 'all';
    const forceRefresh = body.forceRefresh || false;

    logger.info('📋 Backfill configuration:', {
      monthsToBackfill,
      clientCount: targetClientIds.length || 'all',
      platform: platformFilter,
      forceRefresh
    });

    // Get clients to process
    let clientQuery = supabaseAdmin
      .from('clients')
      .select('id, name, email, api_status, meta_access_token, google_ads_access_token, ad_account_id, google_ads_customer_id, system_user_token');

    if (targetClientIds.length > 0) {
      clientQuery = clientQuery.in('id', targetClientIds);
    }

    const { data: clients, error: clientError } = await clientQuery;

    if (clientError) {
      logger.error('❌ Error fetching clients:', clientError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    if (!clients || clients.length === 0) {
      logger.info('⚠️ No clients found to process');
      return NextResponse.json({ 
        success: true, 
        message: 'No clients to process',
        results: [] 
      });
    }

    logger.info(`👥 Processing ${clients.length} clients`);

    // Generate list of months to backfill
    const monthsToProcess: { year: number; month: number; monthStr: string }[] = [];
    const now = new Date();
    
    for (let i = 1; i <= monthsToBackfill; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsToProcess.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      });
    }

    logger.info(`📅 Will process ${monthsToProcess.length} months: ${monthsToProcess.map(m => m.monthStr).join(', ')}`);

    const results: BackfillResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Process each client
    for (const client of clients) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`📊 Processing client: ${client.name} (${client.id})`);
      logger.info(`${'='.repeat(60)}`);

      // Process each month
      for (const monthData of monthsToProcess) {
        const { year, month, monthStr } = monthData;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        logger.info(`\n📅 Processing ${monthStr} for ${client.name}...`);

        // Check if RICH data already exists (unless forceRefresh is true)
        if (!forceRefresh) {
          const { data: existingData } = await supabaseAdmin
            .from('campaign_summaries')
            .select('id, campaign_data, platform')
            .eq('client_id', client.id)
            .eq('summary_date', startDate)
            .eq('summary_type', 'monthly')
            .eq('platform', platformFilter === 'google' ? 'google' : 'meta'); // Filter by platform

          if (existingData && existingData.length > 0) {
            // Check if data is RICH (has campaigns), not just aggregated totals
            const hasRichData = existingData[0].campaign_data && 
                                Array.isArray(existingData[0].campaign_data) &&
                                existingData[0].campaign_data.length > 0;
            
            if (hasRichData) {
              logger.info(`⏭️  Rich data already exists for ${monthStr} (${existingData[0].campaign_data.length} campaigns), skipping...`);
              results.push({
                clientId: client.id,
                clientName: client.name,
                month: monthStr,
                platform: 'meta',
                status: 'skipped',
                reason: `Rich data exists (${existingData[0].campaign_data.length} campaigns)`
              });
              totalSkipped++;
              continue;
            } else {
              logger.info(`⚠️  Found poor quality data for ${monthStr} (no campaigns), will re-fetch from API...`);
            }
          }
        }

        // Process Meta Ads data
        if ((platformFilter === 'all' || platformFilter === 'meta') && client.meta_access_token) {
          try {
            logger.info(`🔵 Fetching Meta Ads data for ${monthStr}...`);
            
            const metaService = new MetaAPIService(
              client.meta_access_token, 
              client.system_user_token || undefined
            );

            // Fetch campaign insights
            const campaigns = await metaService.getCampaignInsights(
              client.ad_account_id,
              startDate,
              endDate
            );

            logger.info(`  Found ${campaigns.length} Meta campaigns`);

            // Calculate totals
            const totals = campaigns.reduce((acc, campaign) => ({
              spend: acc.spend + (campaign.spend || 0),
              impressions: acc.impressions + (campaign.impressions || 0),
              clicks: acc.clicks + (campaign.clicks || 0),
              conversions: acc.conversions + (campaign.conversions || 0)
            }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

            // Store in campaign_summaries
            const { error: insertError } = await supabaseAdmin
              .from('campaign_summaries')
              .upsert({
                client_id: client.id,
                summary_type: 'monthly',
                summary_date: startDate,
                total_spend: totals.spend,
                total_impressions: totals.impressions,
                total_clicks: totals.clicks,
                total_conversions: totals.conversions,
                average_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
                average_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
                average_cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
                active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
                total_campaigns: campaigns.length,
                campaign_data: campaigns,
                data_source: 'meta_api',
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'client_id,summary_type,summary_date'
              });

            if (insertError) {
              throw insertError;
            }

            logger.info(`  ✅ Meta data saved: ${totals.spend.toFixed(2)} spend, ${totals.conversions} conversions`);

            results.push({
              clientId: client.id,
              clientName: client.name,
              month: monthStr,
              platform: 'meta',
              status: 'success',
              metrics: totals
            });
            totalSuccess++;

          } catch (error) {
            logger.error(`  ❌ Meta fetch failed:`, error);
            results.push({
              clientId: client.id,
              clientName: client.name,
              month: monthStr,
              platform: 'meta',
              status: 'failed',
              reason: error instanceof Error ? error.message : 'Unknown error'
            });
            totalFailed++;
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Process Google Ads data (skip for now - service not available)
        if ((platformFilter === 'all' || platformFilter === 'google') && client.google_ads_access_token) {
          logger.info(`🔴 Google Ads integration not available yet - skipping ${monthStr} for ${client.name}`);
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            month: monthStr,
            platform: 'google',
            status: 'skipped',
            reason: 'Google Ads service not implemented yet'
          });
          totalSkipped++;
        }
      }

      logger.info(`✅ Completed processing for ${client.name}`);
    }

    const executionTime = Date.now() - startTime;

    const summary = {
      success: true,
      summary: {
        totalClients: clients.length,
        totalMonths: monthsToProcess.length,
        totalAttempts: results.length,
        successCount: totalSuccess,
        failedCount: totalFailed,
        skippedCount: totalSkipped,
        executionTimeMs: executionTime,
        executionTimeReadable: `${Math.floor(executionTime / 1000 / 60)}m ${Math.floor((executionTime / 1000) % 60)}s`
      },
      results,
      timestamp: new Date().toISOString()
    };

    logger.info('\n' + '='.repeat(60));
    logger.info('✅ BACKFILL COMPLETED');
    logger.info('='.repeat(60));
    logger.info(`Total clients: ${clients.length}`);
    logger.info(`Total attempts: ${results.length}`);
    logger.info(`✅ Success: ${totalSuccess}`);
    logger.info(`❌ Failed: ${totalFailed}`);
    logger.info(`⏭️  Skipped: ${totalSkipped}`);
    logger.info(`⏱️  Execution time: ${summary.summary.executionTimeReadable}`);
    logger.info('='.repeat(60));

    return NextResponse.json(summary);

  } catch (error) {
    logger.error('❌ Backfill operation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  // Return documentation for this endpoint
  return NextResponse.json({
    endpoint: '/api/backfill-all-client-data',
    method: 'POST',
    description: 'Comprehensive endpoint to backfill missing historical data for all clients',
    usage: {
      body: {
        monthsToBackfill: 'Number of past months to backfill (default: 12)',
        clientIds: 'Array of client IDs to process (empty = all clients)',
        platform: 'Platform to backfill: "all", "meta", or "google" (default: "all")',
        forceRefresh: 'If true, re-fetch even if data exists (default: false)'
      },
      example: {
        monthsToBackfill: 6,
        clientIds: [],
        platform: 'all',
        forceRefresh: false
      }
    },
    notes: [
      'This operation can take several minutes depending on the number of clients and months',
      'Rate limiting delays are applied to avoid API throttling',
      'Existing data is skipped unless forceRefresh is true',
      'Failed requests are logged but do not stop the entire operation'
    ]
  });
}

