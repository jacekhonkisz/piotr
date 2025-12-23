import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';
import { GoogleAdsAPIService } from '../../../../lib/google-ads-api';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

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
 */

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

    logger.info(`📅 Target month: ${targetMonthStr} (${startDate} to ${endDate})`);
    logger.info(`🔧 Mode: ${dryRun ? 'DRY RUN (no saves)' : 'LIVE (will save)'}`);

    // Get all clients with API tokens (any status)
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, email, api_status, meta_access_token, system_user_token, ad_account_id, google_ads_access_token, google_ads_customer_id');

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
      logger.info('⚠️ No clients found');
      return NextResponse.json({ 
        success: true, 
        message: 'No clients to process',
        results: [] 
      });
    }

    logger.info(`👥 Found ${clients.length} clients to process`);

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
            const hasRichData = existingData.campaign_data && 
                                Array.isArray(existingData.campaign_data) &&
                                existingData.campaign_data.length > 0;
            
            if (hasRichData) {
              logger.info(`⏭️  Rich Meta data already exists (${existingData.campaign_data.length} campaigns), skipping...`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'meta',
                status: 'skipped',
                reason: `Rich data exists (${existingData.campaign_data.length} campaigns, ${existingData.total_spend} PLN)`
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
            
            const metaService = new MetaAPIService(metaToken);

            // Fetch campaign insights
            const campaigns = await metaService.getCampaignInsights(
              client.ad_account_id,
              startDate,
              endDate
            );

            if (!campaigns || campaigns.length === 0) {
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

            logger.info(`  Found ${campaigns.length} Meta campaigns`);

            // Calculate totals from campaigns
            const totals = campaigns.reduce((acc, campaign) => ({
              spend: acc.spend + (campaign.spend || 0),
              impressions: acc.impressions + (campaign.impressions || 0),
              clicks: acc.clicks + (campaign.clicks || 0),
              conversions: acc.conversions + (campaign.conversions || 0),
              reach: acc.reach + (campaign.reach || 0)
            }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 });

            const averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

            // STEP 3: Save to database
            // ✅ IMPROVED: Use upsert pattern for consistency with other collection jobs
            const { error: saveError } = await supabaseAdmin
              .from('campaign_summaries')
              .upsert({
                client_id: client.id,
                platform: 'meta',
                summary_type: 'monthly',
                summary_date: startDate,
                total_spend: totals.spend,
                total_impressions: totals.impressions,
                total_clicks: totals.clicks,
                total_conversions: totals.conversions,
                average_ctr: averageCtr,
                average_cpc: averageCpc,
                campaign_data: campaigns,
                data_source: 'meta_api',
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'client_id,summary_type,summary_date,platform'  // ✅ CRITICAL: Includes platform
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

          if (existingGoogleData) {
            // Check if data is RICH (has campaigns)
            const hasRichData = existingGoogleData.campaign_data && 
                                Array.isArray(existingGoogleData.campaign_data) &&
                                existingGoogleData.campaign_data.length > 0;
            
            if (hasRichData) {
              logger.info(`⏭️  Rich Google Ads data already exists (${existingGoogleData.campaign_data.length} campaigns), skipping...`);
              results.push({
                clientId: client.id,
                clientName,
                month: targetMonthStr,
                platform: 'google',
                status: 'skipped',
                reason: `Rich data exists (${existingGoogleData.campaign_data.length} campaigns, ${existingGoogleData.total_spend} PLN)`
              });
              skippedCount++;
            } else {
              logger.info(`⚠️  Found poor quality Google Ads data (no campaigns), will re-fetch...`);
            }
          }

          // STEP 2: Fetch RICH data from Google Ads API (if not skipped)
          if (!dryRun && !(existingGoogleData?.campaign_data?.length > 0)) {
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
                  customerId: client.google_ads_customer_id,
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

                  // Fetch Google Ads tables (network, demographic, quality score)
                  let googleAdsTables = null;
                  try {
                    googleAdsTables = await googleAdsService.getGoogleAdsTables(startDate, endDate);
                    logger.info(`📊 Fetched Google Ads tables data`);
                  } catch (tablesError) {
                    logger.warn(`⚠️ Failed to fetch Google Ads tables:`, tablesError);
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
                      roas: roas,
                      cost_per_reservation: costPerReservation,
                      campaign_data: campaigns,
                      google_ads_tables: googleAdsTables,
                      data_source: 'google_ads_api',
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

    const summary = {
      success: true,
      mode: dryRun ? 'dry-run' : 'live',
      targetMonth: targetMonthStr,
      dateRange: { start: startDate, end: endDate },
      totalClients: clients.length,
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
    logger.info('✅ END OF MONTH COLLECTION COMPLETED');
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

