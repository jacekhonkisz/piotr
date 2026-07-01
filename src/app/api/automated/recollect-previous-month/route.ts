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
 * ATTRIBUTION WINDOW RE-COLLECTION
 *
 * Lightweight cron that re-fetches ONLY the previous month's data from live APIs
 * and upserts into campaign_summaries. This captures conversions that arrive
 * after the month ends due to attribution windows:
 *
 *   Google Ads: default 30-day click attribution → data stabilizes ~30 days out
 *   Meta Ads:   7-day click attribution (2026)   → data stabilizes ~10 days out
 *
 * Schedule (all times UTC, targeting the month that just ended):
 *   5th  at 3:00 AM  — catches early Meta attribution lag
 *   8th  at 3:15 AM  — Meta data nearly final
 *   11th at 3:30 AM  — Meta final, early Google attribution
 *   15th at 3:45 AM  — ~50% of Google 30-day window
 *   28th at 4:00 AM  — Google data nearly final (also re-collects month-2)
 *
 * Query param ?monthOffset=N overrides target (1 = previous month, 2 = two months ago).
 * Default is 1 (previous month). The 28th cron passes monthOffset=2 so it
 * covers the month whose 30-day Google attribution window has fully closed.
 */

interface CollectionResult {
  clientId: string;
  clientName: string;
  month: string;
  platform: 'meta' | 'google';
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  metrics?: { spend: number; impressions: number; campaigns: number; reservations: number };
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  return await runRecollection(request);
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  return await runRecollection(request);
}

async function runRecollection(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const monthOffset = parseInt(request.nextUrl.searchParams.get('monthOffset') || '1', 10);

    const target = new Date();
    target.setMonth(target.getMonth() - monthOffset);
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

    logger.info(`🔄 ATTRIBUTION RE-COLLECTION: ${monthLabel} (offset=${monthOffset}, ${startDate}→${endDate})`);

    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, email, api_status, meta_access_token, system_user_token, ad_account_id, google_ads_customer_id');

    if (clientError || !clients?.length) {
      logger.error('❌ Failed to fetch clients:', clientError);
      return NextResponse.json({ success: false, error: 'No clients found' }, { status: 500 });
    }

    logger.info(`👥 Processing ${clients.length} clients for ${monthLabel}`);

    const results: CollectionResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const client of clients) {
      const clientName = client.company || client.name;

      // ── META ADS ──────────────────────────────────────────────
      const metaToken = client.system_user_token || client.meta_access_token;
      if (metaToken && client.ad_account_id) {
        try {
          const metaResult = await recollectMeta(client, metaToken, startDate, endDate, monthLabel);
          results.push({ ...metaResult, clientId: client.id, clientName, month: monthLabel });
          if (metaResult.status === 'success') successCount++;
          else if (metaResult.status === 'failed') failedCount++;
          else skippedCount++;
        } catch (err) {
          logger.error(`❌ Meta failed for ${clientName}:`, err);
          results.push({ clientId: client.id, clientName, month: monthLabel, platform: 'meta', status: 'failed', reason: String(err) });
          failedCount++;
        }
      }

      // ── GOOGLE ADS ────────────────────────────────────────────
      if (client.google_ads_customer_id) {
        try {
          const googleResult = await recollectGoogle(client, startDate, endDate, monthLabel);
          results.push({ ...googleResult, clientId: client.id, clientName, month: monthLabel });
          if (googleResult.status === 'success') successCount++;
          else if (googleResult.status === 'failed') failedCount++;
          else skippedCount++;
        } catch (err) {
          logger.error(`❌ Google Ads failed for ${clientName}:`, err);
          results.push({ clientId: client.id, clientName, month: monthLabel, platform: 'google', status: 'failed', reason: String(err) });
          failedCount++;
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ RE-COLLECTION DONE: ${monthLabel} — ${successCount} ok, ${failedCount} failed, ${skippedCount} skipped (${duration}s)`);

    return NextResponse.json({
      success: true,
      targetMonth: monthLabel,
      monthOffset,
      dateRange: { start: startDate, end: endDate },
      totalClients: clients.length,
      summary: { successful: successCount, failed: failedCount, skipped: skippedCount },
      duration: `${duration}s`,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Re-collection crashed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    }, { status: 500 });
  }
}

// ─── META RE-COLLECTION ─────────────────────────────────────────────────────

async function recollectMeta(
  client: any, metaToken: string, startDate: string, endDate: string, monthLabel: string
): Promise<Omit<CollectionResult, 'clientId' | 'clientName' | 'month'>> {
  const metaService = new MetaAPIService(metaToken);
  const tokenCheck = await metaService.validateToken();
  if (!tokenCheck.valid) return { platform: 'meta', status: 'skipped', reason: 'Invalid Meta token' };

  const adAccountId = client.ad_account_id.startsWith('act_')
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;

  const rawCampaigns = await metaService.getCampaignInsights(adAccountId, startDate, endDate);
  if (!rawCampaigns?.length) return { platform: 'meta', status: 'skipped', reason: 'No campaigns from API' };

  const campaigns = enhanceCampaignsWithConversions(rawCampaigns);
  const conv = aggregateConversionMetrics(campaigns);

  const totals = campaigns.reduce((a: any, c: any) => ({
    spend: a.spend + (parseFloat(c.spend) || 0),
    impressions: a.impressions + (parseInt(c.impressions) || 0),
    clicks: a.clicks + (parseInt(c.inline_link_clicks || c.clicks) || 0),
    conversions: a.conversions + (parseInt(c.conversions) || 0),
    reach: a.reach + (parseInt(c.reach) || 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 });

  let averageCtr: number;
  let averageCpc: number;
  try {
    const acct = await metaService.getAccountInsights(adAccountId, startDate, endDate);
    averageCtr = parseFloat(acct?.inline_link_click_ctr || acct?.ctr || '0');
    averageCpc = parseFloat(acct?.cost_per_inline_link_click || acct?.cpc || '0');
  } catch {
    averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  }

  const roas = totals.spend > 0 && conv.reservation_value > 0 ? conv.reservation_value / totals.spend : 0;
  const costPerRes = conv.reservations > 0 && totals.spend > 0 ? totals.spend / conv.reservations : 0;

  const {
    validateMetaCampaignSummaryWrite,
    logBlockedMetaSummaryWrite,
  } = await import('../../../../lib/campaign-summary-guard');
  const guard = validateMetaCampaignSummaryWrite({
    totals,
    campaigns,
    liveApiCampaignCount: campaigns.length,
  });
  if (!guard.allowed) {
    logBlockedMetaSummaryWrite('recollect_previous_month', client.id, startDate, guard);
    return { platform: 'meta', status: 'skipped', reason: guard.reason };
  }

  const { error } = await supabaseAdmin!.from('campaign_summaries').upsert({
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
    click_to_call: Math.round(conv.click_to_call || 0),
    email_contacts: Math.round(conv.email_contacts || 0),
    booking_step_1: Math.round(conv.booking_step_1 || 0),
    booking_step_2: Math.round(conv.booking_step_2 || 0),
    booking_step_3: Math.round(conv.booking_step_3 || 0),
    reservations: Math.round(conv.reservations || 0),
    reservation_value: Math.round((conv.reservation_value || 0) * 100) / 100,
    // Meta: "wartość konwersji" == reservation value. Persist so the value card
    // isn't 0 zł while ROAS (derived from reservation_value) is non-zero.
    total_conversion_value: Math.round((conv.reservation_value || 0) * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    cost_per_reservation: Math.round(costPerRes * 100) / 100,
    campaign_data: campaigns,
    data_source: 'attribution_recollection',
    last_updated: new Date().toISOString(),
  }, { onConflict: 'client_id,summary_type,summary_date,platform' });

  if (error) {
    logger.error(`❌ Meta upsert failed:`, error);
    return { platform: 'meta', status: 'failed', reason: error.message };
  }

  logger.info(`✅ Meta ${monthLabel}: ${campaigns.length} campaigns, ${totals.spend.toFixed(2)} PLN`);
  return {
    platform: 'meta',
    status: 'success',
    metrics: { spend: totals.spend, impressions: totals.impressions, campaigns: campaigns.length, reservations: conv.reservations || 0 },
  };
}

// ─── GOOGLE ADS RE-COLLECTION ────────────────────────────────────────────────

async function recollectGoogle(
  client: any, startDate: string, endDate: string, monthLabel: string
): Promise<Omit<CollectionResult, 'clientId' | 'clientName' | 'month'>> {
  const { data: settingsData, error: settingsError } = await supabaseAdmin!
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

  if (settingsError) return { platform: 'google', status: 'failed', reason: `Settings error: ${settingsError.message}` };

  const settings = (settingsData || []).reduce((a: any, s: any) => { a[s.key] = s.value; return a; }, {} as Record<string, any>);
  const refreshToken = settings.google_ads_manager_refresh_token;
  if (!refreshToken) return { platform: 'google', status: 'skipped', reason: 'No Google Ads refresh token' };

  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
  });

  const campaignResult = await googleAdsService.getCampaignData(startDate, endDate);
  const campaigns = (campaignResult && typeof campaignResult === 'object' && (campaignResult as any).campaigns)
    ? (campaignResult as any).campaigns
    : campaignResult;

  if (!campaigns?.length) return { platform: 'google', status: 'skipped', reason: 'No campaigns from API' };

  const totals = campaigns.reduce((a: any, c: any) => ({
    spend: a.spend + (c.spend || 0),
    impressions: a.impressions + (c.impressions || 0),
    clicks: a.clicks + (c.clicks || 0),
    click_to_call: a.click_to_call + (c.click_to_call || 0),
    email_contacts: a.email_contacts + (c.email_contacts || 0),
    booking_step_1: a.booking_step_1 + (c.booking_step_1 || 0),
    booking_step_2: a.booking_step_2 + (c.booking_step_2 || 0),
    booking_step_3: a.booking_step_3 + (c.booking_step_3 || 0),
    reservations: a.reservations + (c.reservations || 0),
    reservation_value: a.reservation_value + (c.reservation_value || 0),
    conversion_value: a.conversion_value + (c.conversion_value || 0),
    total_conversion_value: a.total_conversion_value + (c.total_conversion_value || 0),
  }), {
    spend: 0, impressions: 0, clicks: 0,
    click_to_call: 0, email_contacts: 0, booking_step_1: 0,
    booking_step_2: 0, booking_step_3: 0, reservations: 0,
    reservation_value: 0, conversion_value: 0, total_conversion_value: 0,
  });

  const averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const roas = totals.spend > 0 ? (totals.total_conversion_value || totals.reservation_value) / totals.spend : 0;
  const costPerRes = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

  let googleAdsTables = null;
  try {
    googleAdsTables = await fetchAndStoreGoogleAdsTables(googleAdsService, client.id, startDate, endDate);
  } catch { /* optional */ }

  let dynamicMetricValues: Record<string, number> = {};
  let dynamicMetricRows: Array<{ key: string; id: string; label: string; count: number; value: number }> = [];
  try {
    const dyn = await fetchGoogleDynamicConversionRowsWithService(googleAdsService, startDate, endDate);
    if (dyn.fetchOk) {
      dynamicMetricValues = googleDynamicRowsToMetricMap(dyn.rows);
      dynamicMetricRows = dyn.rows;
    }
  } catch (dynamicError) {
    logger.warn('⚠️ Google dynamic metrics failed during recollection:', dynamicError);
  }

  const { error } = await supabaseAdmin!.from('campaign_summaries').upsert({
    client_id: client.id,
    platform: 'google',
    summary_type: 'monthly',
    summary_date: startDate,
    total_spend: totals.spend,
    total_impressions: Math.round(totals.impressions),
    total_clicks: Math.round(totals.clicks),
    total_conversions: Math.round(totals.reservations),
    average_ctr: averageCtr,
    average_cpc: averageCpc,
    click_to_call: Math.round(totals.click_to_call),
    email_contacts: Math.round(totals.email_contacts),
    booking_step_1: Math.round(totals.booking_step_1),
    booking_step_2: Math.round(totals.booking_step_2),
    booking_step_3: Math.round(totals.booking_step_3),
    reservations: Math.round(totals.reservations),
    reservation_value: Math.round(totals.reservation_value * 100) / 100,
    conversion_value: Math.round(totals.conversion_value * 100) / 100,
    total_conversion_value: Math.round(totals.total_conversion_value * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    cost_per_reservation: Math.round(costPerRes * 100) / 100,
    campaign_data: campaigns as any,
    google_ads_tables: googleAdsTables as any,
    google_dynamic_metric_values: dynamicMetricValues as any,
    google_dynamic_metric_rows: dynamicMetricRows as any,
    data_source: 'attribution_recollection',
    last_updated: new Date().toISOString(),
  }, { onConflict: 'client_id,summary_type,summary_date,platform' });

  if (error) {
    logger.error(`❌ Google upsert failed:`, error);
    return { platform: 'google', status: 'failed', reason: error.message };
  }

  logger.info(`✅ Google ${monthLabel}: ${campaigns.length} campaigns, ${totals.spend.toFixed(2)} PLN`);
  return {
    platform: 'google',
    status: 'success',
    metrics: { spend: totals.spend, impressions: totals.impressions, campaigns: campaigns.length, reservations: totals.reservations },
  };
}
