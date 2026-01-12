/**
 * AUDIT: Google Ads Smart Cache vs Live API Booking Steps
 * 
 * This script compares:
 * 1. What smart cache has stored for booking steps
 * 2. What live API returns for the same period
 * 3. Identifies discrepancies in the fetching logic
 */

// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

// Helper function to get current month info (avoid importing from smart-cache-helper which loads Supabase)
function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Calculate month boundaries
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of current month
  
  return {
    year,
    month,
    startDate: startDate.toISOString().split('T')[0]!,
    endDate: endDate.toISOString().split('T')[0]!,
    periodId: `${year}-${String(month).padStart(2, '0')}`
  };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ComparisonResult {
  clientName: string;
  clientId: string;
  periodId: string;
  smartCache: {
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
    reservation_value: number;
    totalSpend: number;
    lastUpdated: string;
    cacheAge: string;
  };
  liveAPI: {
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
    reservation_value: number;
    totalSpend: number;
    fetchedAt: string;
  };
  discrepancy: {
    step1_diff: number;
    step2_diff: number;
    step3_diff: number;
    reservations_diff: number;
    reservation_value_diff: number;
    spend_diff: number;
    hasDiscrepancy: boolean;
  };
}

async function getSmartCacheData(clientId: string, periodId: string) {
  const { data, error } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .single();

  if (error || !data) {
    return null;
  }

  const cacheData = data.cache_data;
  const lastUpdated = new Date(data.last_updated);
  const now = new Date();
  const cacheAgeMs = now.getTime() - lastUpdated.getTime();
  const cacheAgeHours = (cacheAgeMs / (1000 * 60 * 60)).toFixed(2);

  return {
    booking_step_1: cacheData?.conversionMetrics?.booking_step_1 || 0,
    booking_step_2: cacheData?.conversionMetrics?.booking_step_2 || 0,
    booking_step_3: cacheData?.conversionMetrics?.booking_step_3 || 0,
    reservations: cacheData?.conversionMetrics?.reservations || 0,
    reservation_value: cacheData?.conversionMetrics?.reservation_value || 0,
    totalSpend: cacheData?.stats?.totalSpend || 0,
    lastUpdated: data.last_updated,
    cacheAge: `${cacheAgeHours} hours`
  };
}

async function getLiveAPIData(client: any, dateStart: string, dateEnd: string) {
  // Get Google Ads system settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ]);

  if (settingsError || !settingsData) {
    throw new Error('Google Ads system configuration not found');
  }

  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);

  // Use the same token priority logic as smart cache
  let refreshToken = null;
  if (settings.google_ads_manager_refresh_token) {
    refreshToken = settings.google_ads_manager_refresh_token;
  } else if (client.google_ads_refresh_token) {
    refreshToken = client.google_ads_refresh_token;
  }

  if (!refreshToken) {
    throw new Error('Google Ads refresh token not found');
  }

  const googleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id,
  };

  // Initialize Google Ads API service
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

  // Validate credentials
  const validation = await googleAdsService.validateCredentials();
  if (!validation.valid) {
    throw new Error(`Google Ads credentials invalid: ${validation.error}`);
  }

  // Fetch campaign data (same as smart cache)
  const campaignData = await googleAdsService.getCampaignData(dateStart, dateEnd);

  // Aggregate conversion metrics (same logic as smart cache)
  const conversionMetrics = campaignData.reduce((acc, campaign: any) => {
    acc.booking_step_1 += campaign.booking_step_1 || 0;
    acc.booking_step_2 += campaign.booking_step_2 || 0;
    acc.booking_step_3 += campaign.booking_step_3 || 0;
    acc.reservations += campaign.reservations || 0;
    acc.reservation_value += campaign.reservation_value || 0;
    return acc;
  }, {
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0
  });

  const totalSpend = campaignData.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);

  return {
    booking_step_1: conversionMetrics.booking_step_1,
    booking_step_2: conversionMetrics.booking_step_2,
    booking_step_3: conversionMetrics.booking_step_3,
    reservations: conversionMetrics.reservations,
    reservation_value: conversionMetrics.reservation_value,
    totalSpend,
    fetchedAt: new Date().toISOString()
  };
}

async function compareSmartCacheVsLive(clientId: string) {
  console.log(`\n🔍 Auditing client: ${clientId}`);
  
  // Get client data
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    console.error(`❌ Client not found: ${clientId}`);
    return null;
  }

  if (!client.google_ads_customer_id) {
    console.log(`⚠️  Client ${client.name} has no Google Ads customer ID, skipping...`);
    return null;
  }

  console.log(`✅ Client: ${client.name}`);

  // Get current month info
  const currentMonth = getCurrentMonthInfo();
  console.log(`📅 Period: ${currentMonth.periodId} (${currentMonth.startDate} to ${currentMonth.endDate})`);

  // Get smart cache data
  console.log(`\n1️⃣ Fetching Smart Cache Data...`);
  const smartCacheData = await getSmartCacheData(clientId, currentMonth.periodId);
  
  if (!smartCacheData) {
    console.log(`⚠️  No smart cache data found for ${currentMonth.periodId}`);
    return null;
  }

  console.log(`✅ Smart Cache Data:`, {
    booking_step_1: smartCacheData.booking_step_1,
    booking_step_2: smartCacheData.booking_step_2,
    booking_step_3: smartCacheData.booking_step_3,
    reservations: smartCacheData.reservations,
    reservation_value: smartCacheData.reservation_value,
    totalSpend: smartCacheData.totalSpend,
    lastUpdated: smartCacheData.lastUpdated,
    cacheAge: smartCacheData.cacheAge
  });

  // Get live API data
  console.log(`\n2️⃣ Fetching Live API Data...`);
  let liveAPIData;
  try {
    liveAPIData = await getLiveAPIData(client, currentMonth.startDate!, currentMonth.endDate!);
    console.log(`✅ Live API Data:`, {
      booking_step_1: liveAPIData.booking_step_1,
      booking_step_2: liveAPIData.booking_step_2,
      booking_step_3: liveAPIData.booking_step_3,
      reservations: liveAPIData.reservations,
      reservation_value: liveAPIData.reservation_value,
      totalSpend: liveAPIData.totalSpend,
      fetchedAt: liveAPIData.fetchedAt
    });
  } catch (error: any) {
    console.error(`❌ Failed to fetch live API data:`, error.message);
    return null;
  }

  // Calculate discrepancies
  const discrepancy = {
    step1_diff: liveAPIData.booking_step_1 - smartCacheData.booking_step_1,
    step2_diff: liveAPIData.booking_step_2 - smartCacheData.booking_step_2,
    step3_diff: liveAPIData.booking_step_3 - smartCacheData.booking_step_3,
    reservations_diff: liveAPIData.reservations - smartCacheData.reservations,
    reservation_value_diff: liveAPIData.reservation_value - smartCacheData.reservation_value,
    spend_diff: liveAPIData.totalSpend - smartCacheData.totalSpend,
    hasDiscrepancy: false
  };

  discrepancy.hasDiscrepancy = 
    Math.abs(discrepancy.step1_diff) > 0.01 ||
    Math.abs(discrepancy.step2_diff) > 0.01 ||
    Math.abs(discrepancy.step3_diff) > 0.01 ||
    Math.abs(discrepancy.reservations_diff) > 0.01 ||
    Math.abs(discrepancy.reservation_value_diff) > 0.01 ||
    Math.abs(discrepancy.spend_diff) > 0.01;

  console.log(`\n3️⃣ Comparison Results:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (discrepancy.hasDiscrepancy) {
    console.log(`🚨 DISCREPANCY DETECTED!`);
    console.log(`   Booking Step 1:  ${smartCacheData.booking_step_1} (cache) vs ${liveAPIData.booking_step_1} (live) = ${discrepancy.step1_diff > 0 ? '+' : ''}${discrepancy.step1_diff.toFixed(2)}`);
    console.log(`   Booking Step 2:  ${smartCacheData.booking_step_2} (cache) vs ${liveAPIData.booking_step_2} (live) = ${discrepancy.step2_diff > 0 ? '+' : ''}${discrepancy.step2_diff.toFixed(2)}`);
    console.log(`   Booking Step 3:  ${smartCacheData.booking_step_3} (cache) vs ${liveAPIData.booking_step_3} (live) = ${discrepancy.step3_diff > 0 ? '+' : ''}${discrepancy.step3_diff.toFixed(2)}`);
    console.log(`   Reservations:    ${smartCacheData.reservations} (cache) vs ${liveAPIData.reservations} (live) = ${discrepancy.reservations_diff > 0 ? '+' : ''}${discrepancy.reservations_diff.toFixed(2)}`);
    console.log(`   Reservation Val: ${smartCacheData.reservation_value.toFixed(2)} (cache) vs ${liveAPIData.reservation_value.toFixed(2)} (live) = ${discrepancy.reservation_value_diff > 0 ? '+' : ''}${discrepancy.reservation_value_diff.toFixed(2)}`);
    console.log(`   Total Spend:     ${smartCacheData.totalSpend.toFixed(2)} (cache) vs ${liveAPIData.totalSpend.toFixed(2)} (live) = ${discrepancy.spend_diff > 0 ? '+' : ''}${discrepancy.spend_diff.toFixed(2)}`);
  } else {
    console.log(`✅ NO DISCREPANCY - Smart cache matches live API`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return {
    clientName: client.name,
    clientId: client.id,
    periodId: currentMonth.periodId,
    smartCache: smartCacheData,
    liveAPI: liveAPIData,
    discrepancy
  } as ComparisonResult;
}

async function main() {
  console.log('🔍 Google Ads Smart Cache vs Live API Audit');
  console.log('==========================================\n');

  // Get all clients with Google Ads enabled
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch clients:', error);
    process.exit(1);
  }

  console.log(`Found ${clients?.length || 0} clients with Google Ads configured\n`);

  const results: ComparisonResult[] = [];
  const clientsWithDiscrepancies: ComparisonResult[] = [];

  for (const client of clients || []) {
    try {
      const result = await compareSmartCacheVsLive(client.id);
      if (result) {
        results.push(result);
        if (result.discrepancy.hasDiscrepancy) {
          clientsWithDiscrepancies.push(result);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error auditing client ${client.name}:`, error.message);
    }
  }

  // Summary
  console.log(`\n\n📊 AUDIT SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total clients audited: ${results.length}`);
  console.log(`Clients with discrepancies: ${clientsWithDiscrepancies.length}`);
  
  if (clientsWithDiscrepancies.length > 0) {
    console.log(`\n🚨 CLIENTS WITH DISCREPANCIES:`);
    clientsWithDiscrepancies.forEach((result) => {
      console.log(`\n   ${result.clientName}:`);
      console.log(`   - Step 1 diff: ${result.discrepancy.step1_diff > 0 ? '+' : ''}${result.discrepancy.step1_diff.toFixed(2)}`);
      console.log(`   - Step 2 diff: ${result.discrepancy.step2_diff > 0 ? '+' : ''}${result.discrepancy.step2_diff.toFixed(2)}`);
      console.log(`   - Step 3 diff: ${result.discrepancy.step3_diff > 0 ? '+' : ''}${result.discrepancy.step3_diff.toFixed(2)}`);
      console.log(`   - Reservations diff: ${result.discrepancy.reservations_diff > 0 ? '+' : ''}${result.discrepancy.reservations_diff.toFixed(2)}`);
    });
  } else {
    console.log(`\n✅ All clients match - no discrepancies found!`);
  }
}

main().catch(console.error);

