#!/usr/bin/env node
/**
 * GOOGLE ADS BACKFILL SCRIPT (FIXED VERSION)
 * 
 * Uses the existing BackgroundDataCollector which properly implements
 * the Google Ads API via the official google-ads-api library.
 * 
 * Usage: npx tsx scripts/backfill-google-ads-using-collector.ts [--dry-run] [--client=CLIENT_ID]
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const clientArg = args.find(a => a.startsWith('--client='));
const specificClientId = clientArg ? clientArg.split('=')[1] : null;

// ============================================================================
// DATE UTILITIES
// ============================================================================

function getMonthsToBackfill(): Array<{ startDate: string; endDate: string; label: string }> {
  const months: Array<{ startDate: string; endDate: string; label: string }> = [];
  
  // Start from December 2024
  const startYear = 2024;
  const startMonth = 12;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let year = startYear;
  let month = startMonth;
  
  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    const lastDay = new Date(year, month, 0).getDate();
    months.push({
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
      label: `${year}-${String(month).padStart(2, '0')}`
    });
    
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  return months;
}

function getWeeksToBackfill(): Array<{ startDate: string; endDate: string; label: string }> {
  const weeks: Array<{ startDate: string; endDate: string; label: string }> = [];
  
  // Start from first Monday of December 2024 (Dec 2, 2024)
  // Use UTC to avoid timezone issues
  let current = new Date(Date.UTC(2024, 11, 2)); // Month is 0-indexed, so 11 = December
  const now = new Date();
  
  let weekNum = 1;
  
  while (current < now) {
    // Ensure we're on a Monday (day 1 in JS)
    const dayOfWeek = current.getUTCDay();
    if (dayOfWeek !== 1) {
      console.warn(`⚠️ Week ${weekNum} starts on day ${dayOfWeek}, not Monday! Skipping...`);
      current.setUTCDate(current.getUTCDate() + 7);
      weekNum++;
      continue;
    }
    
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    
    // Only include completed weeks
    if (weekEnd < now) {
      // Format as YYYY-MM-DD using UTC to avoid timezone shifts
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      weeks.push({
        startDate: startStr,
        endDate: endStr,
        label: `Week ${weekNum} (${startStr})`
      });
    }
    
    current.setUTCDate(current.getUTCDate() + 7);
    weekNum++;
  }
  
  console.log(`📅 Generated ${weeks.length} weeks, first: ${weeks[0]?.startDate}, last: ${weeks[weeks.length-1]?.startDate}`);
  
  return weeks;
}

// ============================================================================
// EXISTING PERIOD CHECK
// ============================================================================

async function getExistingPeriods(clientId: string, platform: string, summaryType: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('summary_date')
    .eq('client_id', clientId)
    .eq('platform', platform)
    .eq('summary_type', summaryType);
  
  if (error) {
    console.error('Error fetching existing periods:', error);
    return new Set<string>();
  }
  
  return new Set((data || []).map(d => d.summary_date));
}

// ============================================================================
// TRIGGER DATA COLLECTION
// ============================================================================

async function triggerGoogleAdsCollection(
  clientId: string,
  clientName: string,
  summaryType: 'monthly' | 'weekly',
  summaryDate: string,
  dateStart: string,
  dateEnd: string
): Promise<boolean> {
  
  if (isDryRun) {
    console.log(`   [DRY RUN] Would collect: ${clientName} - ${summaryType} - ${summaryDate}`);
    return true;
  }
  
  try {
    // Use the existing background data collection API endpoint
    // This uses the proper GoogleAdsAPIService with the official library
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/admin/collect-google-ads-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        summaryType,
        summaryDate,
        dateStart,
        dateEnd,
        force: true // Force collection even if data exists
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`   ✅ Collected: ${result.spend?.toFixed(2) || '0.00'} PLN, ${result.impressions || 0} impressions`);
      return true;
    } else {
      console.log(`   ⚠️ No data: ${result.message || 'No campaigns found'}`);
      return false;
    }
    
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// DIRECT DATABASE INSERT (Alternative approach without API)
// ============================================================================

async function directCollectGoogleAdsData(
  clientId: string,
  clientName: string,
  customerId: string,
  summaryType: 'monthly' | 'weekly',
  summaryDate: string,
  dateStart: string,
  dateEnd: string,
  settings: any
): Promise<boolean> {
  
  if (isDryRun) {
    console.log(`   [DRY RUN] Would collect: ${clientName} - ${summaryType} - ${summaryDate}`);
    return true;
  }
  
  try {
    // Import the service dynamically to avoid module resolution issues
    const { GoogleAdsAPIService } = await import('../src/lib/google-ads-api');
    
    // Get refresh token (manager token priority)
    const { data: clientData } = await supabase
      .from('clients')
      .select('google_ads_refresh_token')
      .eq('id', clientId)
      .single();
    
    const refreshToken = settings.google_ads_manager_refresh_token || clientData?.google_ads_refresh_token;
    
    if (!refreshToken) {
      console.log(`   ❌ No refresh token available`);
      return false;
    }
    
    // Initialize the Google Ads service
    const googleAdsService = new GoogleAdsAPIService({
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: customerId,
      managerCustomerId: settings.google_ads_manager_customer_id
    });
    
    // Fetch campaign data using the proper API
    const campaigns = await googleAdsService.getCampaignData(dateStart, dateEnd);
    
    if (!campaigns || campaigns.length === 0) {
      console.log(`   ⚠️ No campaigns found for period`);
      // Store zero record
      await storeEmptySummary(clientId, summaryType, summaryDate);
      return true;
    }
    
    // Calculate totals
    const totals = campaigns.reduce((acc, campaign: any) => ({
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
    
    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;
    
    // Store in database
    const summary = {
      client_id: clientId,
      summary_type: summaryType,
      summary_date: summaryDate,
      platform: 'google',
      total_spend: totals.spend,
      total_impressions: Math.round(totals.impressions),
      total_clicks: Math.round(totals.clicks),
      total_conversions: Math.round(totals.conversions),
      average_ctr: ctr,
      average_cpc: cpc,
      click_to_call: Math.round(totals.click_to_call),
      email_contacts: Math.round(totals.email_contacts),
      booking_step_1: Math.round(totals.booking_step_1),
      booking_step_2: Math.round(totals.booking_step_2),
      booking_step_3: Math.round(totals.booking_step_3),
      reservations: Math.round(totals.reservations),
      reservation_value: totals.reservation_value,
      cost_per_reservation: cost_per_reservation,
      campaign_data: campaigns,
      active_campaign_count: campaigns.filter((c: any) => c.status === 'ENABLED').length,
      data_source: 'google_ads_api_backfill',
      last_updated: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(summary, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });
    
    if (error) {
      console.log(`   ❌ Storage error: ${error.message}`);
      return false;
    }
    
    console.log(`   ✅ Stored: ${totals.spend.toFixed(2)} PLN, ${totals.impressions} impressions, ${campaigns.length} campaigns`);
    return true;
    
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function storeEmptySummary(clientId: string, summaryType: string, summaryDate: string): Promise<void> {
  await supabase
    .from('campaign_summaries')
    .upsert({
      client_id: clientId,
      summary_type: summaryType,
      summary_date: summaryDate,
      platform: 'google',
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      average_ctr: 0,
      average_cpc: 0,
      campaign_data: [],
      active_campaign_count: 0,
      data_source: 'google_ads_api_backfill_empty',
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 GOOGLE ADS BACKFILL (Using Official Library)');
  console.log('='.repeat(80));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }
  
  // Get Google Ads settings
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
    console.error('❌ Error fetching settings:', settingsError);
    process.exit(1);
  }
  
  const settings = settingsData.reduce((acc: any, s: any) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  
  if (!settings.google_ads_developer_token) {
    console.error('❌ Missing Google Ads developer token');
    process.exit(1);
  }
  
  // Get clients
  let query = supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_enabled')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null);
  
  if (specificClientId) {
    query = query.eq('id', specificClientId);
  }
  
  const { data: clients, error: clientsError } = await query.order('name');
  
  if (clientsError || !clients) {
    console.error('❌ Error fetching clients:', clientsError);
    process.exit(1);
  }
  
  console.log(`\n✅ Found ${clients.length} clients with Google Ads enabled`);
  
  // Get periods to backfill
  const months = getMonthsToBackfill();
  const weeks = getWeeksToBackfill();
  
  console.log(`📅 Periods to check:`);
  console.log(`   Months: ${months.length} (${months[0]?.label} to ${months[months.length-1]?.label})`);
  console.log(`   Weeks: ${weeks.length}`);
  
  // Stats
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  // Process each client
  for (const client of clients) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 BACKFILLING: ${client.name}`);
    console.log('='.repeat(80));
    console.log(`   Customer ID: ${client.google_ads_customer_id}`);
    
    // Get existing periods
    const existingMonths = await getExistingPeriods(client.id, 'google', 'monthly');
    const existingWeeks = await getExistingPeriods(client.id, 'google', 'weekly');
    
    // MONTHLY BACKFILL
    console.log(`\n📅 MONTHLY DATA (${months.length} months):`);
    
    for (const month of months) {
      if (existingMonths.has(month.startDate)) {
        console.log(`   ⏭️  ${month.label} - Already exists`);
        totalSkipped++;
        continue;
      }
      
      console.log(`   📊 ${month.label} - Fetching...`);
      
      const success = await directCollectGoogleAdsData(
        client.id,
        client.name,
        client.google_ads_customer_id,
        'monthly',
        month.startDate,
        month.startDate,
        month.endDate,
        settings
      );
      
      if (success) {
        totalSuccess++;
      } else {
        totalErrors++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // WEEKLY BACKFILL (show fewer logs)
    console.log(`\n📅 WEEKLY DATA (${weeks.length} weeks):`);
    let weekSuccess = 0;
    let weekSkipped = 0;
    let weekErrors = 0;
    
    for (const week of weeks) {
      if (existingWeeks.has(week.startDate)) {
        weekSkipped++;
        totalSkipped++;
        continue;
      }
      
      const success = await directCollectGoogleAdsData(
        client.id,
        client.name,
        client.google_ads_customer_id,
        'weekly',
        week.startDate,
        week.startDate,
        week.endDate,
        settings
      );
      
      if (success) {
        weekSuccess++;
        totalSuccess++;
      } else {
        weekErrors++;
        totalErrors++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`   Summary: ${weekSuccess} added, ${weekSkipped} skipped, ${weekErrors} errors`);
  }
  
  // Final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal successful: ${totalSuccess}`);
  console.log(`Total skipped (existing): ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  
  if (isDryRun) {
    console.log(`\n⚠️  DRY RUN - Run without --dry-run to actually backfill data`);
  } else {
    console.log(`\n✅ Backfill complete!`);
    console.log(`   Run audit to verify: npx tsx scripts/audit-funnel-metrics-reliability.ts`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

