/**
 * Update Current Periods with API Values
 * 
 * This script updates the current month and current week data with proper values
 * fetched directly from API:
 * - Meta Ads: Updates CPC/CTR from API (not calculated)
 * - Google Ads: Updates booking steps from API (not from daily_kpi_data)
 * 
 * Usage: npx tsx scripts/update-current-periods-with-api-values.ts
 */

// ✅ CRITICAL: Load environment variables FIRST before any imports
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { getCurrentMonthInfo, getCurrentWeekInfo } from '../src/lib/date-utils';
import { parseWeekPeriodId } from '../src/lib/week-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  console.error('\n💡 Make sure .env.local file exists in the project root with these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface UpdateResult {
  clientId: string;
  clientName: string;
  platform: 'meta' | 'google';
  periodType: 'month' | 'week';
  success: boolean;
  error?: string;
  updatedFields?: string[];
}

async function updateCurrentPeriods() {
  console.log('🚀 Starting update of current periods with API values...\n');

  // Get current period info
  const currentMonth = getCurrentMonthInfo();
  const currentWeek = getCurrentWeekInfo();
  
  console.log('📅 Current Periods:');
  console.log(`   Month: ${currentMonth.periodId} (${currentMonth.startDate} to ${currentMonth.endDate})`);
  console.log(`   Week: ${currentWeek.periodId} (${currentWeek.startDate} to ${currentWeek.endDate})\n`);

  // Get all active clients (those with valid API status)
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .eq('api_status', 'valid');

  if (clientsError) {
    console.error('❌ Failed to fetch clients:', clientsError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('⚠️ No active clients found');
    return;
  }

  console.log(`📊 Found ${clients.length} active clients\n`);

  const results: UpdateResult[] = [];

  // Get Google Ads system settings once (used by all Google Ads clients)
  const { data: googleAdsSettings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

  const googleAdsSystemSettings = googleAdsSettings?.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>) || {};

  for (const client of clients) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 Processing: ${client.name} (${client.id})`);
    console.log('='.repeat(60));

    // Process Meta Ads - check if client has Meta token or ad_account_id
    if ((client.meta_access_token || client.system_user_token) && client.ad_account_id) {
      console.log('\n🔵 META ADS:');
      
      // Update current month
      const monthResult = await updateMetaCurrentMonth(client, currentMonth);
      results.push(monthResult);
      
      // Update current week
      const weekResult = await updateMetaCurrentWeek(client, currentWeek);
      results.push(weekResult);
    }

    // Process Google Ads - check if client has customer_id (system settings provide other credentials)
    if (client.google_ads_customer_id) {
      console.log('\n🔴 GOOGLE ADS:');
      
      // Update current month
      const monthResult = await updateGoogleAdsCurrentMonth(client, currentMonth, googleAdsSystemSettings);
      results.push(monthResult);
      
      // Update current week
      const weekResult = await updateGoogleAdsCurrentWeek(client, currentWeek, googleAdsSystemSettings);
      results.push(weekResult);
    }

    // Small delay between clients
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Total: ${results.length}\n`);

  if (failed.length > 0) {
    console.log('❌ Failed Updates:');
    failed.forEach(r => {
      console.log(`   - ${r.clientName} (${r.platform}, ${r.periodType}): ${r.error}`);
    });
  }

  console.log('\n✅ Update complete!');
}

async function updateMetaCurrentMonth(
  client: any,
  currentMonth: { periodId: string; startDate: string; endDate: string }
): Promise<UpdateResult> {
  try {
    console.log(`   📅 Updating current month: ${currentMonth.periodId}`);

    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'month',
        success: false,
        error: 'No Meta token available'
      };
    }

    const metaService = new MetaAPIServiceOptimized(metaToken);
    const adAccountId = client.ad_account_id?.startsWith('act_') 
      ? client.ad_account_id.substring(4) 
      : client.ad_account_id || '';

    if (!adAccountId) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'month',
        success: false,
        error: 'No ad account ID'
      };
    }

    // Fetch fresh data from API
    console.log('   🔄 Fetching fresh data from Meta API...');
    const campaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      currentMonth.startDate,
      currentMonth.endDate,
      0
    );

    if (!campaignInsights || campaignInsights.length === 0) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'month',
        success: false,
        error: 'No campaign insights returned from API'
      };
    }

    // Get account-level insights for CPC/CTR
    const accountInsights = await metaService.getAccountInsights(
      adAccountId,
      currentMonth.startDate,
      currentMonth.endDate
    );

    // Calculate totals
    const totalSpend = campaignInsights.reduce((sum: number, c: any) => sum + parseFloat(c.spend || 0), 0);
    const totalImpressions = campaignInsights.reduce((sum: number, c: any) => sum + parseInt(c.impressions || 0), 0);
    const totalClicks = campaignInsights.reduce((sum: number, c: any) => sum + parseInt(c.inline_link_clicks || c.clicks || 0), 0);

    // ✅ CRITICAL: Use API values for CPC/CTR (not calculated)
    let averageCtr: number;
    let averageCpc: number;

    if (accountInsights) {
      averageCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || '0');
      averageCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || '0');
      console.log(`   ✅ Using account-level API values: CTR=${averageCtr}%, CPC=${averageCpc}`);
    } else {
      // Use weighted average from campaign API values
      let weightedCtrSum = 0;
      let weightedCpcSum = 0;
      let totalClickWeight = 0;

      campaignInsights.forEach((insight: any) => {
        const campaignClicks = parseInt(insight.inline_link_clicks || insight.clicks || '0');
        const campaignCtr = parseFloat(insight.inline_link_click_ctr || insight.ctr || '0');
        const campaignCpc = parseFloat(insight.cost_per_inline_link_click || insight.cpc || '0');

        if (campaignClicks > 0 && campaignCtr > 0 && campaignCpc > 0) {
          weightedCtrSum += campaignCtr * campaignClicks;
          weightedCpcSum += campaignCpc * campaignClicks;
          totalClickWeight += campaignClicks;
        }
      });

      if (totalClickWeight > 0) {
        averageCtr = weightedCtrSum / totalClickWeight;
        averageCpc = weightedCpcSum / totalClickWeight;
        console.log(`   ✅ Using weighted average from campaigns: CTR=${averageCtr}%, CPC=${averageCpc}`);
      } else {
        averageCtr = 0;
        averageCpc = 0;
        console.log(`   ⚠️ No API values available, setting to 0`);
      }
    }

    // Update current_month_cache
    const { data: existingCache } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentMonth.periodId)
      .single();

    if (existingCache) {
      const cacheData = existingCache.cache_data || {};
      if (cacheData.stats) {
        cacheData.stats.averageCtr = averageCtr;
        cacheData.stats.averageCpc = averageCpc;
      }

      const { error: updateError } = await supabase
        .from('current_month_cache')
        .update({
          cache_data: cacheData,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingCache.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated current_month_cache`);
    }

    // Update campaign_summaries for current month
    const summaryDate = currentMonth.startDate;
    const { data: existingSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .eq('summary_date', summaryDate)
      .single();

    if (existingSummary) {
      const { error: updateError } = await supabase
        .from('campaign_summaries')
        .update({
          average_ctr: averageCtr,
          average_cpc: averageCpc,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated campaign_summaries (monthly)`);
    }

    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'meta',
      periodType: 'month',
      success: true,
      updatedFields: ['average_ctr', 'average_cpc']
    };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message || error}`);
    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'meta',
      periodType: 'month',
      success: false,
      error: error.message || String(error)
    };
  }
}

async function updateMetaCurrentWeek(
  client: any,
  currentWeek: { periodId: string; startDate: string; endDate: string }
): Promise<UpdateResult> {
  try {
    console.log(`   📅 Updating current week: ${currentWeek.periodId}`);

    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'week',
        success: false,
        error: 'No Meta token available'
      };
    }

    const metaService = new MetaAPIServiceOptimized(metaToken);
    const adAccountId = client.ad_account_id?.startsWith('act_') 
      ? client.ad_account_id.substring(4) 
      : client.ad_account_id || '';

    if (!adAccountId) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'week',
        success: false,
        error: 'No ad account ID'
      };
    }

    // Fetch fresh data from API
    console.log('   🔄 Fetching fresh data from Meta API...');
    const campaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      currentWeek.startDate,
      currentWeek.endDate,
      0
    );

    if (!campaignInsights || campaignInsights.length === 0) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'meta',
        periodType: 'week',
        success: false,
        error: 'No campaign insights returned from API'
      };
    }

    // Get account-level insights for CPC/CTR
    const accountInsights = await metaService.getAccountInsights(
      adAccountId,
      currentWeek.startDate,
      currentWeek.endDate
    );

    // ✅ CRITICAL: Use API values for CPC/CTR (not calculated)
    let averageCtr: number;
    let averageCpc: number;

    if (accountInsights) {
      averageCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || '0');
      averageCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || '0');
      console.log(`   ✅ Using account-level API values: CTR=${averageCtr}%, CPC=${averageCpc}`);
    } else {
      // Use weighted average from campaign API values
      let weightedCtrSum = 0;
      let weightedCpcSum = 0;
      let totalClickWeight = 0;

      campaignInsights.forEach((insight: any) => {
        const campaignClicks = parseInt(insight.inline_link_clicks || insight.clicks || '0');
        const campaignCtr = parseFloat(insight.inline_link_click_ctr || insight.ctr || '0');
        const campaignCpc = parseFloat(insight.cost_per_inline_link_click || insight.cpc || '0');

        if (campaignClicks > 0 && campaignCtr > 0 && campaignCpc > 0) {
          weightedCtrSum += campaignCtr * campaignClicks;
          weightedCpcSum += campaignCpc * campaignClicks;
          totalClickWeight += campaignClicks;
        }
      });

      if (totalClickWeight > 0) {
        averageCtr = weightedCtrSum / totalClickWeight;
        averageCpc = weightedCpcSum / totalClickWeight;
        console.log(`   ✅ Using weighted average from campaigns: CTR=${averageCtr}%, CPC=${averageCpc}`);
      } else {
        averageCtr = 0;
        averageCpc = 0;
        console.log(`   ⚠️ No API values available, setting to 0`);
      }
    }

    // Update current_week_cache
    const { data: existingCache } = await supabase
      .from('current_week_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentWeek.periodId)
      .single();

    if (existingCache) {
      const cacheData = existingCache.cache_data || {};
      if (cacheData.stats) {
        cacheData.stats.averageCtr = averageCtr;
        cacheData.stats.averageCpc = averageCpc;
      }

      const { error: updateError } = await supabase
        .from('current_week_cache')
        .update({
          cache_data: cacheData,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingCache.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated current_week_cache`);
    }

    // Update campaign_summaries for current week
    // The startDate from currentWeek is already the Monday of the week
    const summaryDate = currentWeek.startDate;
    
    const { data: existingSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'meta')
      .eq('summary_type', 'weekly')
      .eq('summary_date', summaryDate)
      .single();

    if (existingSummary) {
      const { error: updateError } = await supabase
        .from('campaign_summaries')
        .update({
          average_ctr: averageCtr,
          average_cpc: averageCpc,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated campaign_summaries (weekly)`);
    }

    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'meta',
      periodType: 'week',
      success: true,
      updatedFields: ['average_ctr', 'average_cpc']
    };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message || error}`);
    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'meta',
      periodType: 'week',
      success: false,
      error: error.message || String(error)
    };
  }
}

async function updateGoogleAdsCurrentMonth(
  client: any,
  currentMonth: { periodId: string; startDate: string; endDate: string },
  systemSettings: Record<string, any>
): Promise<UpdateResult> {
  try {
    console.log(`   📅 Updating current month: ${currentMonth.periodId}`);

    if (!client.google_ads_customer_id) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'month',
        success: false,
        error: 'Missing Google Ads customer ID'
      };
    }

    // Use system settings for credentials (same as smart cache helper)
    const refreshToken = systemSettings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
    if (!refreshToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'month',
        success: false,
        error: 'Missing Google Ads refresh token (check system_settings)'
      };
    }

    const googleAdsCredentials = {
      refreshToken,
      clientId: systemSettings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!,
      clientSecret: systemSettings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developmentToken: systemSettings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      customerId: client.google_ads_customer_id,
      managerCustomerId: systemSettings.google_ads_manager_customer_id
    };

    if (!googleAdsCredentials.clientId || !googleAdsCredentials.clientSecret || !googleAdsCredentials.developmentToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'month',
        success: false,
        error: 'Missing Google Ads system settings (client_id, client_secret, or developer_token)'
      };
    }

    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

    // Fetch fresh data from API
    console.log('   🔄 Fetching fresh data from Google Ads API...');
    const campaigns = await googleAdsService.getCampaignData(
      currentMonth.startDate,
      currentMonth.endDate
    );

    if (!campaigns || campaigns.length === 0) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'month',
        success: false,
        error: 'No campaigns returned from API'
      };
    }

    // ✅ CRITICAL: Booking steps MUST come from API (not daily_kpi_data)
    const bookingStep1 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0));
    const bookingStep2 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0));
    const bookingStep3 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0));
    const reservations = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0));
    const reservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);

    console.log(`   ✅ Booking steps from API: Step1=${bookingStep1}, Step2=${bookingStep2}, Step3=${bookingStep3}, Reservations=${reservations}`);

    // Update google_ads_current_month_cache
    const { data: existingCache } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentMonth.periodId)
      .single();

    if (existingCache) {
      const cacheData = existingCache.cache_data || {};
      if (cacheData.conversionMetrics) {
        cacheData.conversionMetrics.booking_step_1 = bookingStep1;
        cacheData.conversionMetrics.booking_step_2 = bookingStep2;
        cacheData.conversionMetrics.booking_step_3 = bookingStep3;
        cacheData.conversionMetrics.reservations = reservations;
        cacheData.conversionMetrics.reservation_value = reservationValue;
      }

      const { error: updateError } = await supabase
        .from('google_ads_current_month_cache')
        .update({
          cache_data: cacheData,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingCache.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated google_ads_current_month_cache`);
    }

    // Update campaign_summaries for current month
    const summaryDate = currentMonth.startDate;
    const { data: existingSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', summaryDate)
      .single();

    if (existingSummary) {
      const { error: updateError } = await supabase
        .from('campaign_summaries')
        .update({
          booking_step_1: bookingStep1,
          booking_step_2: bookingStep2,
          booking_step_3: bookingStep3,
          reservations: reservations,
          reservation_value: reservationValue,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated campaign_summaries (monthly)`);
    }

    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'google',
      periodType: 'month',
      success: true,
      updatedFields: ['booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations', 'reservation_value']
    };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message || error}`);
    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'google',
      periodType: 'month',
      success: false,
      error: error.message || String(error)
    };
  }
}

async function updateGoogleAdsCurrentWeek(
  client: any,
  currentWeek: { periodId: string; startDate: string; endDate: string },
  systemSettings: Record<string, any>
): Promise<UpdateResult> {
  try {
    console.log(`   📅 Updating current week: ${currentWeek.periodId}`);

    if (!client.google_ads_customer_id) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'week',
        success: false,
        error: 'Missing Google Ads customer ID'
      };
    }

    // Use system settings for credentials (same as smart cache helper)
    const refreshToken = systemSettings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
    if (!refreshToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'week',
        success: false,
        error: 'Missing Google Ads refresh token (check system_settings)'
      };
    }

    const googleAdsCredentials = {
      refreshToken,
      clientId: systemSettings.google_ads_client_id || process.env.GOOGLE_ADS_CLIENT_ID!,
      clientSecret: systemSettings.google_ads_client_secret || process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developmentToken: systemSettings.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      customerId: client.google_ads_customer_id,
      managerCustomerId: systemSettings.google_ads_manager_customer_id
    };

    if (!googleAdsCredentials.clientId || !googleAdsCredentials.clientSecret || !googleAdsCredentials.developmentToken) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'week',
        success: false,
        error: 'Missing Google Ads system settings (client_id, client_secret, or developer_token)'
      };
    }

    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

    // Fetch fresh data from API
    console.log('   🔄 Fetching fresh data from Google Ads API...');
    const campaigns = await googleAdsService.getCampaignData(
      currentWeek.startDate,
      currentWeek.endDate
    );

    if (!campaigns || campaigns.length === 0) {
      return {
        clientId: client.id,
        clientName: client.name,
        platform: 'google',
        periodType: 'week',
        success: false,
        error: 'No campaigns returned from API'
      };
    }

    // ✅ CRITICAL: Booking steps MUST come from API (not daily_kpi_data)
    const bookingStep1 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0));
    const bookingStep2 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0));
    const bookingStep3 = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0));
    const reservations = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0));
    const reservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);

    console.log(`   ✅ Booking steps from API: Step1=${bookingStep1}, Step2=${bookingStep2}, Step3=${bookingStep3}, Reservations=${reservations}`);

    // Update campaign_summaries for current week
    // The startDate from currentWeek is already the Monday of the week
    const summaryDate = currentWeek.startDate;
    
    const { data: existingSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'weekly')
      .eq('summary_date', summaryDate)
      .single();

    if (existingSummary) {
      const { error: updateError } = await supabase
        .from('campaign_summaries')
        .update({
          booking_step_1: bookingStep1,
          booking_step_2: bookingStep2,
          booking_step_3: bookingStep3,
          reservations: reservations,
          reservation_value: reservationValue,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingSummary.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`   ✅ Updated campaign_summaries (weekly)`);
    }

    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'google',
      periodType: 'week',
      success: true,
      updatedFields: ['booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations', 'reservation_value']
    };

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message || error}`);
    return {
      clientId: client.id,
      clientName: client.name,
      platform: 'google',
      periodType: 'week',
      success: false,
      error: error.message || String(error)
    };
  }
}

// Run the script
updateCurrentPeriods()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

