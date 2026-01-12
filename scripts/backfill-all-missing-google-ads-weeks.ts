/**
 * Backfill All Missing Google Ads Weeks
 * 
 * This script:
 * 1. Identifies missing weeks for all clients
 * 2. Collects missing weeks using proper API method
 * 3. Stores with correct booking steps from API
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { getLastNWeeks, getSundayOfWeek, formatDateISO, getISOWeekNumber, validateIsMonday } from '../src/lib/week-helpers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface WeekInfo {
  weekMonday: string;
  weekEnd: string;
  weekNumber: number;
  periodId: string;
}

function getWeeksToBackfill(): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  
  // ✅ FIX: Use week-helpers to ensure correct Monday calculation
  // Get last 53 weeks (all starting on Monday)
  const weekMondays = getLastNWeeks(53, true);
  
  for (let i = 0; i < weekMondays.length; i++) {
    const weekMonday = weekMondays[i];
    
    // ✅ VALIDATE: Ensure it's actually a Monday
    try {
      validateIsMonday(weekMonday);
    } catch (error) {
      console.error(`❌ Week ${i} is not a Monday: ${formatDateISO(weekMonday)}`);
      continue;
    }
    
    const weekSunday = getSundayOfWeek(weekMonday);
    
    // Calculate ISO week number
    const weekNumber = getISOWeekNumber(weekMonday);
    const year = weekMonday.getFullYear();
    const periodId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    
    weeks.push({
      weekMonday: formatDateISO(weekMonday),
      weekEnd: formatDateISO(weekSunday),
      weekNumber: i + 1,
      periodId
    });
  }
  
  return weeks;
}

async function getExistingWeeks(clientId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('summary_date')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly');
  
  if (error) {
    console.error(`❌ Error fetching existing weeks for client ${clientId}:`, error);
    return new Set();
  }
  
  return new Set((data || []).map(d => d.summary_date));
}

async function getWeeksNeedingRecollection(clientId: string): Promise<Set<string>> {
  // ✅ FIX: Also find weeks with zero spend or missing data that need re-collection
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, booking_step_1, campaign_data')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .or('total_spend.eq.0,and(total_spend.gt.0,booking_step_1.eq.0)');
  
  if (error) {
    console.error(`❌ Error fetching weeks needing recollection for client ${clientId}:`, error);
    return new Set();
  }
  
  // Filter for weeks that need re-collection:
  // 1. Zero spend (might have data now)
  // 2. Has spend but no booking steps (missing conversion data)
  // 3. Empty campaign_data
  const weeksNeedingRecollection = new Set<string>();
  
  (data || []).forEach((week: any) => {
    const hasZeroSpend = (week.total_spend || 0) === 0;
    const hasSpendButNoSteps = (week.total_spend || 0) > 0 && (week.booking_step_1 || 0) === 0;
    const hasEmptyCampaigns = !week.campaign_data || 
      (Array.isArray(week.campaign_data) && week.campaign_data.length === 0) ||
      (typeof week.campaign_data === 'object' && Object.keys(week.campaign_data).length === 0);
    
    if (hasZeroSpend || hasSpendButNoSteps || hasEmptyCampaigns) {
      weeksNeedingRecollection.add(week.summary_date);
    }
  });
  
  return weeksNeedingRecollection;
}

async function collectWeek(
  client: any,
  week: WeekInfo,
  settings: any
): Promise<boolean> {
  try {
    console.log(`   📅 Week ${week.periodId} (${week.weekMonday} to ${week.weekEnd})`);
    
    // Get refresh token
    let refreshToken = settings.google_ads_manager_refresh_token;
    if (!refreshToken && client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
    }
    
    if (!refreshToken) {
      console.log(`      ⚠️ No refresh token, skipping`);
      return false;
    }
    
    // Initialize Google Ads service
    const googleAdsCredentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: client.google_ads_customer_id,
      managerCustomerId: settings.google_ads_manager_customer_id,
    };
    
    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
    
    // Fetch campaign data from API
    const campaigns = await googleAdsService.getCampaignData(week.weekMonday, week.weekEnd);
    
    if (!campaigns || campaigns.length === 0) {
      console.log(`      ⚠️ No campaigns found`);
      return false;
    }
    
    // Calculate totals (with booking steps from API)
    const totals = campaigns.reduce((acc: any, campaign: any) => ({
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
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
    });
    
    // Calculate derived metrics
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    
    // Count active campaigns
    const activeCampaignCount = campaigns.filter((c: any) => c.status === 'ENABLED').length;
    
    // ✅ VALIDATE: Ensure weekMonday is actually a Monday before storing
    const weekMondayDate = new Date(week.weekMonday);
    try {
      validateIsMonday(weekMondayDate);
    } catch (error) {
      console.log(`      ❌ Validation failed: ${week.weekMonday} is not a Monday`);
      return false;
    }
    
    // Store in database
    const summary = {
      client_id: client.id,
      summary_type: 'weekly',
      summary_date: week.weekMonday, // ✅ This is now guaranteed to be a Monday
      platform: 'google',
      total_spend: totals.spend || 0,
      total_impressions: Math.round(totals.impressions || 0),
      total_clicks: Math.round(totals.clicks || 0),
      total_conversions: Math.round(totals.conversions || 0),
      average_ctr: totals.ctr || 0,
      average_cpc: totals.cpc || 0,
      average_cpa: totals.reservations > 0 ? totals.spend / totals.reservations : 0,
      active_campaigns: activeCampaignCount,
      total_campaigns: campaigns.length,
      campaign_data: campaigns,
      data_source: 'google_ads_api',
      click_to_call: Math.round(totals.click_to_call || 0),
      email_contacts: Math.round(totals.email_contacts || 0),
      booking_step_1: Math.round(totals.booking_step_1 || 0),
      booking_step_2: Math.round(totals.booking_step_2 || 0),
      booking_step_3: Math.round(totals.booking_step_3 || 0),
      reservations: Math.round(totals.reservations || 0),
      reservation_value: totals.reservation_value || 0,
      roas: totals.reservation_value > 0 && totals.spend > 0 ? totals.reservation_value / totals.spend : 0,
      cost_per_reservation: totals.reservations > 0 ? totals.spend / totals.reservations : 0,
      last_updated: new Date().toISOString()
    };
    
    const { error: upsertError } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });
    
    if (upsertError) {
      console.log(`      ❌ Storage failed: ${upsertError.message}`);
      return false;
    }
    
    console.log(`      ✅ Collected: ${totals.spend.toFixed(2)} PLN, Steps: ${totals.booking_step_1}/${totals.booking_step_2}/${totals.booking_step_3}`);
    return true;
    
  } catch (error: any) {
    console.log(`      ❌ Error: ${error.message || error}`);
    return false;
  }
}

async function backfillMissingWeeks() {
  console.log('🔄 BACKFILLING MISSING GOOGLE ADS WEEKS\n');
  console.log('='.repeat(60));
  
  // Step 1: Get all clients with Google Ads
  console.log('\n1️⃣ Finding clients with Google Ads...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .not('google_ads_customer_id', 'is', null);
  
  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ No clients with Google Ads found');
    process.exit(1);
  }
  
  console.log(`✅ Found ${clients.length} clients\n`);
  
  // Step 2: Get Google Ads settings
  console.log('2️⃣ Getting Google Ads system settings...');
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
  
  if (settingsError) {
    console.error('❌ Failed to get settings');
    process.exit(1);
  }
  
  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);
  
  // Step 3: Generate all expected weeks
  const allWeeks = getWeeksToBackfill();
  console.log(`\n3️⃣ Generated ${allWeeks.length} expected weeks\n`);
  
  // Step 4: Process each client
  let totalCollected = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const client of clients) {
    console.log(`\n📊 Processing: ${client.name}`);
    console.log('-'.repeat(60));
    
    // Get existing weeks for this client
    const existingWeeks = await getExistingWeeks(client.id);
    console.log(`   Existing weeks: ${existingWeeks.size}`);
    
    // ✅ FIX: Also get weeks that need re-collection (zero spend, missing steps, etc.)
    const weeksNeedingRecollection = await getWeeksNeedingRecollection(client.id);
    console.log(`   Weeks needing re-collection: ${weeksNeedingRecollection.size}`);
    
    // Find missing weeks OR weeks needing re-collection
    const weeksToCollect = allWeeks.filter(w => 
      !existingWeeks.has(w.weekMonday) || weeksNeedingRecollection.has(w.weekMonday)
    );
    
    const missingCount = allWeeks.filter(w => !existingWeeks.has(w.weekMonday)).length;
    const recollectCount = weeksNeedingRecollection.size;
    
    console.log(`   Missing weeks: ${missingCount}`);
    console.log(`   Weeks to re-collect: ${recollectCount}`);
    console.log(`   Total to collect: ${weeksToCollect.length}`);
    
    if (weeksToCollect.length === 0) {
      console.log(`   ✅ All weeks collected and have data`);
      continue;
    }
    
    // Collect missing weeks and weeks needing re-collection
    let collected = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const week of weeksToCollect) {
      const isRecollection = existingWeeks.has(week.weekMonday);
      if (isRecollection) {
        console.log(`   🔄 Re-collecting week ${week.periodId} (has zero/missing data)`);
      }
      const success = await collectWeek(client, week, settings);
      if (success) {
        collected++;
        totalCollected++;
      } else {
        skipped++;
        totalSkipped++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n   ✅ Collected: ${collected}`);
    console.log(`   ⚠️ Skipped: ${skipped}`);
    
    totalErrors += errors;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ BACKFILL COMPLETE!');
  console.log(`   Total collected: ${totalCollected} weeks`);
  console.log(`   Total skipped: ${totalSkipped} weeks`);
  console.log(`   Total errors: ${totalErrors}`);
}

backfillMissingWeeks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });

