import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';
import { enhanceCampaignsWithConversions, aggregateConversionMetrics } from '../../../../lib/meta-actions-parser';
import { GoogleAdsAPIService } from '../../../../lib/google-ads-api';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';
import { fetchAndStoreGoogleAdsTables } from '../../../../lib/google-ads-tables-storage';
import {
  fetchGoogleDynamicConversionRowsWithService,
  googleDynamicRowsToMetricMap,
} from '../../../../lib/google-dynamic-conversion-fetch';

/**
 * END OF MONTH DATA COLLECTION
 * 
 * Runs on the 1st of each month to:
 * 1. Fetch RICH campaign data from Meta/Google APIs for previous month
 * 2. Save with full campaign details (not just aggregated totals)
 * 3. Process ALL active clients automatically
 * 4. Skip if rich data already exists (quality validation)
 * 5. Platform-separated (Meta and Google distinct)
 * 
 * Usage:
 * - Automated: Vercel cron on 1st of month at 2 AM (requires CRON_SECRET)
 * - Manual: POST /api/automated/end-of-month-collection (requires CRON_SECRET)
 *   Body: { "targetMonth": "2025-09", "dryRun": false }
 * 
 * Security: Protected with CRON_SECRET authentication
 *
 * SCALING (30-40+ clients):
 * - This endpoint is BATCHED via ?offset & ?limit query params so each cron
 *   invocation stays under the serverless execution limit. The per-client work
 *   is heavy (Meta + full Google fetch incl. breakdown tables) and is serialized
 *   by the in-memory Google API rate limiter (~40-50s/client), so a full run of
 *   40 clients would far exceed any single-invocation time budget.
 * - Cron entries in vercel.json fire staggered batches (offset 0,5,10,...) a few
 *   minutes apart. They are staggered in TIME (not parallel) on purpose: the
 *   Google rate limiter is per-instance, so parallel batches would multiply the
 *   real API call rate and risk quota errors.
 * - Manual/backfill calls with no offset/limit process ALL clients in one go
 *   (fine for a long-running local script; NOT for a serverless cron).
 * - The response includes { batch: { hasMore, nextOffset } } so a queue/chained
 *   trigger can be added later without changing this handler.
 */

// Allow up to 5 min on plans that support it (Vercel Pro/Fluid). Batches are
// sized so a single invocation processes only a few clients well within this.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface CollectionResult {
  clientId: string;
  clientName: string;
  month: string;
  platform: 'meta' | 'google';
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  metrics?: {
    spend: number;
    impressions: number;
    campaigns: number;
    reservations: number;
  };
}

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
    logger.info('🤖 Starting END OF MONTH data collection...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // 🆕 BATCHING: process a slice of clients per invocation so a single
    // serverless run stays under the execution limit. Defaults to a large
    // limit so manual/backfill calls still process everyone; cron entries pass
    // explicit small batches (e.g. ?offset=0&limit=5).
    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '1000', 10) || 1000);

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun || false;
    
    // Calculate target month (previous month by default)
    const targetMonthStr = body.targetMonth || (() => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    })();
    
    const [year, month] = targetMonthStr.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // The "just-closed" month (previous month relative to now). For this month
    // the stored data may still be a partial current-month snapshot, so Google
    // MUST be re-fetched fresh and overwritten even if campaigns already exist.
    // Older months are treated as immutable (skip if rich data already exists)
    // to avoid unnecessary API usage.
    const justClosed = new Date();
    justClosed.setMonth(justClosed.getMonth() - 1);
    const justClosedMonthStr = `${justClosed.getFullYear()}-${String(justClosed.getMonth() + 1).padStart(2, '0')}`;
    const isJustClosedMonth = targetMonthStr === justClosedMonthStr;

    logger.info(`📅 Target month: ${targetMonthStr} (${startDate} to ${endDate})`);
    logger.info(`🔧 Mode: ${dryRun ? 'DRY RUN (no saves)' : 'LIVE (will save)'}`);
    logger.info(`🗓️ Just-closed month: ${justClosedMonthStr} (force Google re-fetch: ${isJustClosedMonth})`);

    // Total client count (for batch bookkeeping / hasMore).
    const { count: totalClients } = await supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true });

    // Get clients with API tokens (any status). Deterministic ordering by
    // created_at keeps offsets stable across staggered batch invocations.
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, email, api_status, meta_access_token, system_user_token, ad_account_id, google_ads_access_token, google_ads_customer_id')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (clientError) {
      logger.error('❌ Error fetching clients:', clientError);
      logger.error('❌ Client error details:', JSON.stringify(clientError));
      return NextResponse.json({ 
        error: 'Failed to fetch clients',
        details: clientError.message,
        code: clientError.code
      }, { status: 500 });
    }

    if (!clients || clients.length === 0) {
      logger.info(`⚠️ No clients found in batch (offset=${offset}, limit=${limit})`);
      return NextResponse.json({ 
        success: true, 
        message: 'No clients in this batch',
        batch: { offset, limit, processed: 0, totalClients: totalClients ?? null, hasMore: false, nextOffset: null },
        results: [] 
      });
    }

    logger.info(`👥 Batch offset=${offset} limit=${limit}: processing ${clients.length} of ${totalClients ?? '?'} clients`);

    const results: CollectionResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process each client
    for (const client of clients) {
      const clientName = client.company || client.name;
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`👤 Processing: ${clientName} (${client.id})`);

      // PROCESS META ADS
      // ✅ FIX: Check for EITHER system_user_token OR meta_access_token
      const metaAvailable = (client.system_user_token || client.meta_access_token) && client.ad_account_id;
      if (metaAvailable) {
        try {
          logger.info(`🔵 Processing Meta Ads for ${clientName}...`);
          
          // STEP 1: Check if RICH data already exists
          const { data: existingData } = await supabaseAdmin
            .from('campaign_summaries')
            .select('id, campaign_data, platform, total_spend')
            .eq('client_id', client.id)
            .eq('summary_date', startDate)
            .eq('summary_type', 'monthly')
            .eq('platform', 'meta')
            .single();

          if (existingData) {
            // Check if data is RICH (has campaigns)
            const existingCampaigns = Array.isArray(existingData.campaign_data) ? existingData.campaign_data : [];
            const hasRichData = existingCampaigns.length > 0;
            
            if (hasRichData) {
              logger.info(`⏭️  Rich Meta data already exists (${existingCampaigns.length} campaigns), skipping...`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'meta',
                status: 'skipped',
                reason: `Rich data exists (${existingCampaigns.length} campaigns, ${existingData.total_spend} PLN)`
              });
              skippedCount++;
              continue; // Skip to next platform
            } else {
              logger.info(`⚠️  Found poor quality Meta data (no campaigns), will re-fetch...`);
            }
          }

          // STEP 2: Fetch RICH data from Meta API
          if (!dryRun) {
            logger.info(`📡 Fetching Meta data from API for ${startDate} to ${endDate}...`);
            
            // ✅ FIX: Use system_user_token if available, otherwise use meta_access_token
            const metaToken = client.system_user_token || client.meta_access_token;
            const tokenType = client.system_user_token ? 'system_user (permanent)' : 'access_token (60-day)';
            logger.info(`🔑 Using ${tokenType} for ${client.name || client.id}`);

            if (!metaToken) {
              logger.warn(`⚠️  No Meta token for ${client.name || client.id}, skipping...`);
              continue;
            }

            const metaService = new MetaAPIService(metaToken);

            // Fetch campaign insights
            const rawCampaigns = await metaService.getCampaignInsights(
              client.ad_account_id,
              startDate,
              endDate
            );

            if (!rawCampaigns || rawCampaigns.length === 0) {
              logger.warn(`⚠️  No Meta campaigns returned for ${clientName}`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'meta',
                status: 'failed',
                reason: 'No campaigns from API'
              });
              failedCount++;
              continue;
            }

            // Parse actions arrays into structured funnel metrics
            const campaigns = enhanceCampaignsWithConversions(rawCampaigns);
            const convMetrics = aggregateConversionMetrics(campaigns);

            logger.info(`  Found ${campaigns.length} Meta campaigns (parsed with funnel data)`);

            // Calculate totals from campaigns
            const totals = campaigns.reduce((acc: any, campaign: any) => ({
              spend: acc.spend + (parseFloat(campaign.spend) || 0),
              impressions: acc.impressions + (parseInt(campaign.impressions) || 0),
              clicks: acc.clicks + (parseInt(campaign.inline_link_clicks || campaign.clicks) || 0),
              conversions: acc.conversions + (parseInt(campaign.conversions) || 0),
              reach: acc.reach + (parseInt(campaign.reach) || 0)
            }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 });

            // ✅ NEW: Try to get account-level insights first to use API values directly
            let accountInsights: any = null;
            let averageCtr: number;
            let averageCpc: number;
            
            try {
              // Clean ad account ID (remove 'act_' prefix if present)
              const adAccountId = client.ad_account_id.startsWith('act_') 
                ? client.ad_account_id.substring(4) 
                : client.ad_account_id;
              accountInsights = await metaService.getAccountInsights(adAccountId, startDate, endDate);
              if (accountInsights) {
                logger.info(`✅ Using account-level insights from API for ${clientName} ${targetMonthStr} CTR/CPC`);
                averageCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || 0);
                averageCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || 0);
              } else {
                // Fallback: Calculate from totals
                averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
                averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
              }
            } catch (accountError) {
              logger.warn(`⚠️ Could not fetch account-level insights for ${clientName}, will use calculated values:`, accountError);
              // Fallback: Calculate from totals
              averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
              averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            }

            // STEP 3: Save to database with funnel metrics
            const roas = totals.spend > 0 && convMetrics.reservation_value > 0
              ? convMetrics.reservation_value / totals.spend : 0;
            const costPerRes = convMetrics.reservations > 0 && totals.spend > 0
              ? totals.spend / convMetrics.reservations : 0;

            const { error: saveError } = await supabaseAdmin
              .from('campaign_summaries')
              .upsert({
                client_id: client.id,
                platform: 'meta',
                summary_type: 'monthly',
                summary_date: startDate,
                total_spend: totals.spend,
                total_impressions: Math.round(totals.impressions),
                total_clicks: Math.round(totals.clicks),
                total_conversions: Math.round(totals.conversions),
                average_ctr: averageCtr,
                average_cpc: averageCpc,
                click_to_call: Math.round(convMetrics.click_to_call || 0),
                email_contacts: Math.round(convMetrics.email_contacts || 0),
                booking_step_1: Math.round(convMetrics.booking_step_1 || 0),
                booking_step_2: Math.round(convMetrics.booking_step_2 || 0),
                booking_step_3: Math.round(convMetrics.booking_step_3 || 0),
                reservations: Math.round(convMetrics.reservations || 0),
                reservation_value: Math.round((convMetrics.reservation_value || 0) * 100) / 100,
                roas: Math.round(roas * 100) / 100,
                cost_per_reservation: Math.round(costPerRes * 100) / 100,
                campaign_data: campaigns,
                data_source: 'meta_api',
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'client_id,summary_type,summary_date,platform'
              });

            if (saveError) {
              logger.error(`❌ Failed to save Meta data:`, saveError);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'meta',
                status: 'failed',
                reason: saveError.message
              });
              failedCount++;
            } else {
              logger.info(`✅ Meta data saved: ${campaigns.length} campaigns, ${totals.spend.toFixed(2)} PLN`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'meta',
                status: 'success',
                metrics: {
                  spend: totals.spend,
                  impressions: totals.impressions,
                  campaigns: campaigns.length,
                  reservations: 0 // Will be added when we fetch conversion data
                }
              });
              successCount++;
            }
          } else {
            logger.info(`🔧 DRY RUN: Would fetch Meta data from API`);
            results.push({
              clientId: client.id,
              clientName,
              month: targetMonthStr,
              platform: 'meta',
              status: 'skipped',
              reason: 'Dry run mode'
            });
            skippedCount++;
          }

        } catch (error) {
          logger.error(`❌ Meta processing failed for ${clientName}:`, error);
          results.push({
            clientId: client.id,
            clientName,
            month: targetMonthStr,
            platform: 'meta',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      } else {
        logger.info(`⏭️  Skipping Meta (no token/account ID)`);
        results.push({
          clientId: client.id,
          clientName,
          month: targetMonthStr,
          platform: 'meta',
          status: 'skipped',
          reason: 'No Meta token or account ID'
        });
        skippedCount++;
      }

      // PROCESS GOOGLE ADS
      const googleAdsAvailable = client.google_ads_customer_id;
      if (googleAdsAvailable) {
        try {
          logger.info(`🔵 Processing Google Ads for ${clientName}...`);
          
          // STEP 1: Check if RICH Google Ads data already exists
          const { data: existingGoogleData } = await supabaseAdmin
            .from('campaign_summaries')
            .select('id, campaign_data, platform, total_spend')
            .eq('client_id', client.id)
            .eq('summary_date', startDate)
            .eq('summary_type', 'monthly')
            .eq('platform', 'google')
            .single();

          const existingGoogleCampaignData = existingGoogleData?.campaign_data;
          const existingGoogleCampaigns = Array.isArray(existingGoogleCampaignData) ? existingGoogleCampaignData : [];
          // ✅ FIX: For the just-closed month, the stored row may be a partial
          // current-month snapshot (frozen at whatever day the smart cache last
          // refreshed). "Has campaigns" is NOT proof of completeness, so we must
          // always re-fetch and overwrite the just-closed month. Only skip when
          // the target is an OLDER, already-immutable month with rich data.
          if (existingGoogleData) {
            const hasRichData = existingGoogleCampaigns.length > 0;

            if (hasRichData && !isJustClosedMonth) {
              logger.info(`⏭️  Rich Google Ads data already exists for older month (${existingGoogleCampaigns.length} campaigns), skipping...`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'google',
                status: 'skipped',
                reason: `Rich data exists for immutable month (${existingGoogleCampaigns.length} campaigns, ${existingGoogleData.total_spend} PLN)`
              });
              skippedCount++;
            } else if (hasRichData && isJustClosedMonth) {
              logger.info(`🔄 Just-closed month has existing data (${existingGoogleCampaigns.length} campaigns) that may be a partial snapshot — re-fetching authoritative full month...`);
            } else {
              logger.info(`⚠️  Found poor quality Google Ads data (no campaigns), will re-fetch...`);
            }
          }

          // STEP 2: Fetch authoritative full-month data from Google Ads API.
          // Always fetch for the just-closed month; for older months only when
          // no rich data exists yet.
          const shouldFetchGoogle = isJustClosedMonth || existingGoogleCampaigns.length === 0;
          if (!dryRun && shouldFetchGoogle) {
            logger.info(`📡 Fetching Google Ads data from API for ${startDate} to ${endDate}...`);
            
            // Get Google Ads system settings
            const { data: settingsData, error: settingsError } = await supabaseAdmin
              .from('system_settings')
              .select('key, value')
              .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

            if (settingsError) {
              logger.error(`❌ Failed to get Google Ads system settings:`, settingsError);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'google',
                status: 'failed',
                reason: `System settings error: ${settingsError.message}`
              });
              failedCount++;
            } else {
              const settings = settingsData?.reduce((acc: any, setting: any) => {
                acc[setting.key] = setting.value;
                return acc;
              }, {}) || {};

              // Determine refresh token (manager token takes priority)
              let refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_access_token;

              if (!refreshToken) {
                logger.warn(`⚠️ No Google Ads refresh token available for ${clientName}`);
                results.push({
                  clientId: client.id,
                  clientName,
                  month: targetMonthStr,
                  platform: 'google',
                  status: 'skipped',
                  reason: 'No Google Ads refresh token'
                });
                skippedCount++;
              } else {
                const googleAdsCredentials = {
                  refreshToken,
                  clientId: settings.google_ads_client_id,
                  clientSecret: settings.google_ads_client_secret,
                  developmentToken: settings.google_ads_developer_token,
                  customerId: client.google_ads_customer_id || '',
                  managerCustomerId: settings.google_ads_manager_customer_id,
                };

                // Initialize Google Ads API service
                const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

                // Fetch campaign data
                const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

                if (!campaigns || campaigns.length === 0) {
                  logger.warn(`⚠️  No Google Ads campaigns returned for ${clientName}`);
                  results.push({
                    clientId: client.id,
                    clientName,
                    month: targetMonthStr,
                    platform: 'google',
                    status: 'failed',
                    reason: 'No campaigns from API'
                  });
                  failedCount++;
                } else {
                  logger.info(`  Found ${campaigns.length} Google Ads campaigns`);

                  // Calculate totals from campaigns
                  const googleTotals = campaigns.reduce((acc: any, campaign: any) => ({
                    spend: acc.spend + (campaign.spend || 0),
                    impressions: acc.impressions + (campaign.impressions || 0),
                    clicks: acc.clicks + (campaign.clicks || 0),
                    conversions: acc.conversions + (campaign.conversions || 0),
                    click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
                    email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
                    booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
                    booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
                    booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
                    reservations: acc.reservations + (campaign.reservations || 0),
                    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
                  }), { 
                    spend: 0, impressions: 0, clicks: 0, conversions: 0,
                    click_to_call: 0, email_contacts: 0, booking_step_1: 0,
                    booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
                  });

                  const averageCtr = googleTotals.impressions > 0 ? (googleTotals.clicks / googleTotals.impressions) * 100 : 0;
                  const averageCpc = googleTotals.clicks > 0 ? googleTotals.spend / googleTotals.clicks : 0;
                  const roas = googleTotals.spend > 0 ? googleTotals.reservation_value / googleTotals.spend : 0;
                  const costPerReservation = googleTotals.reservations > 0 ? googleTotals.spend / googleTotals.reservations : 0;

                  // ✅ P1 COMPLETENESS GUARD: Verify the summed campaign spend
                  // matches the account-level total for the same range. A large
                  // shortfall means the fetch is partial/incomplete — we flag the
                  // row so it can be reviewed/re-collected instead of silently
                  // publishing wrong historical numbers.
                  let googleDataSource = 'google_ads_api';
                  try {
                    const account = await googleAdsService.getAccountPerformance(startDate, endDate);
                    const accountSpend = account?.spend || 0;
                    if (accountSpend > 0) {
                      const spendRatio = googleTotals.spend / accountSpend;
                      if (spendRatio < 0.98 || spendRatio > 1.02) {
                        googleDataSource = 'google_ads_api_incomplete';
                        logger.warn(`⚠️ COMPLETENESS CHECK FAILED for ${clientName} ${targetMonthStr}: campaign spend ${googleTotals.spend.toFixed(2)} vs account spend ${accountSpend.toFixed(2)} (ratio ${(spendRatio * 100).toFixed(1)}%). Flagging row as incomplete.`);
                      } else {
                        logger.info(`✅ Completeness check passed for ${clientName} ${targetMonthStr}: campaign spend within 2% of account spend (${accountSpend.toFixed(2)})`);
                      }
                    }
                  } catch (verifyError) {
                    logger.warn(`⚠️ Completeness check skipped for ${clientName} (account query failed):`, verifyError);
                  }

                  // Fetch Google Ads tables (network, demographic, quality score)
                  let googleAdsTables = null;
                  try {
                    googleAdsTables = await fetchAndStoreGoogleAdsTables(
                      googleAdsService,
                      client.id,
                      startDate,
                      endDate
                    );
                    logger.info(`📊 Fetched Google Ads tables data`);
                  } catch (tablesError) {
                    logger.warn(`⚠️ Failed to fetch Google Ads tables:`, tablesError);
                  }

                  let dynamicMetricValues: Record<string, number> = {};
                  let dynamicMetricRows: Array<{ key: string; id: string; label: string; count: number; value: number }> = [];
                  try {
                    const dyn = await fetchGoogleDynamicConversionRowsWithService(
                      googleAdsService,
                      startDate,
                      endDate
                    );
                    if (dyn.fetchOk) {
                      dynamicMetricValues = googleDynamicRowsToMetricMap(dyn.rows);
                      dynamicMetricRows = dyn.rows;
                    }
                  } catch (dynamicError) {
                    logger.warn(`⚠️ Failed to fetch Google Ads dynamic metrics:`, dynamicError);
                  }

                  // STEP 3: Save to database
                  const { error: saveError } = await supabaseAdmin
                    .from('campaign_summaries')
                    .upsert({
                      client_id: client.id,
                      platform: 'google',
                      summary_type: 'monthly',
                      summary_date: startDate,
                      total_spend: googleTotals.spend,
                      total_impressions: Math.round(googleTotals.impressions),
                      total_clicks: Math.round(googleTotals.clicks),
                      total_conversions: Math.round(googleTotals.conversions),
                      average_ctr: averageCtr,
                      average_cpc: averageCpc,
                      // Conversion metrics
                      click_to_call: Math.round(googleTotals.click_to_call),
                      email_contacts: Math.round(googleTotals.email_contacts),
                      booking_step_1: Math.round(googleTotals.booking_step_1),
                      booking_step_2: Math.round(googleTotals.booking_step_2),
                      booking_step_3: Math.round(googleTotals.booking_step_3),
                      reservations: Math.round(googleTotals.reservations),
                      reservation_value: googleTotals.reservation_value,
                      // ✅ RESERVATION-ONLY: persist value columns so read paths
                      // never see stale residue from older writes
                      conversion_value: googleTotals.reservation_value,
                      total_conversion_value: googleTotals.reservation_value,
                      roas: roas,
                      cost_per_reservation: costPerReservation,
                      campaign_data: campaigns as any,
                      google_ads_tables: googleAdsTables as any,
                      google_dynamic_metric_values: dynamicMetricValues as any,
                      google_dynamic_metric_rows: dynamicMetricRows as any,
                      data_source: googleDataSource,
                      last_updated: new Date().toISOString()
                    }, {
                      onConflict: 'client_id,summary_type,summary_date,platform'
                    });

                  if (saveError) {
                    logger.error(`❌ Failed to save Google Ads data:`, saveError);
                    results.push({
                      clientId: client.id,
                      clientName,
                      month: targetMonthStr,
                      platform: 'google',
                      status: 'failed',
                      reason: saveError.message
                    });
                    failedCount++;
                  } else {
                    logger.info(`✅ Google Ads data saved: ${campaigns.length} campaigns, ${googleTotals.spend.toFixed(2)} PLN`);
                    results.push({
                      clientId: client.id,
                      clientName,
                      month: targetMonthStr,
                      platform: 'google',
                      status: 'success',
                      metrics: {
                        spend: googleTotals.spend,
                        impressions: googleTotals.impressions,
                        campaigns: campaigns.length,
                        reservations: googleTotals.reservations
                      }
                    });
                    successCount++;
                  }
                }
              }
            }
          } else if (dryRun) {
            logger.info(`🔧 DRY RUN: Would fetch Google Ads data from API`);
            results.push({
              clientId: client.id,
              clientName,
              month: targetMonthStr,
              platform: 'google',
              status: 'skipped',
              reason: 'Dry run mode'
            });
            skippedCount++;
          }

        } catch (error) {
          logger.error(`❌ Google Ads processing failed for ${clientName}:`, error);
          results.push({
            clientId: client.id,
            clientName,
            month: targetMonthStr,
            platform: 'google',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      } else {
        logger.info(`⏭️  Skipping Google Ads (no customer ID)`);
        results.push({
          clientId: client.id,
          clientName,
          month: targetMonthStr,
          platform: 'google',
          status: 'skipped',
          reason: 'No Google Ads customer ID'
        });
        skippedCount++;
      }

      // Small delay to prevent API rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Batch bookkeeping so schedulers/queues can chain the next slice.
    const processedThrough = offset + clients.length;
    const hasMore = typeof totalClients === 'number' ? processedThrough < totalClients : clients.length === limit;
    const nextOffset = hasMore ? processedThrough : null;

    const summary = {
      success: true,
      mode: dryRun ? 'dry-run' : 'live',
      targetMonth: targetMonthStr,
      dateRange: { start: startDate, end: endDate },
      totalClients: clients.length,
      batch: {
        offset,
        limit,
        processed: clients.length,
        totalClients: totalClients ?? null,
        hasMore,
        nextOffset
      },
      summary: {
        successful: successCount,
        failed: failedCount,
        skipped: skippedCount
      },
      duration: `${duration} seconds`,
      results,
      timestamp: new Date().toISOString()
    };

    logger.info('\n' + '='.repeat(60));
    logger.info('✅ END OF MONTH COLLECTION BATCH COMPLETED');
    logger.info(`📦 Batch: offset=${offset} limit=${limit} processed=${clients.length} hasMore=${hasMore}${nextOffset !== null ? ` nextOffset=${nextOffset}` : ''}`);
    logger.info(`📊 Summary: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);
    logger.info(`⏱️  Duration: ${duration} seconds`);
    logger.info('='.repeat(60));

    return NextResponse.json(summary);

  } catch (error) {
    logger.error('❌ End of month collection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

