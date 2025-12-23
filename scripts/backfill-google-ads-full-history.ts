#!/usr/bin/env node
/**
 * GOOGLE ADS FULL HISTORY BACKFILL SCRIPT
 * 
 * Purpose: Backfill ALL missing Google Ads data for all clients
 * Covers: December 2024 through present (13+ months)
 * Types: Both monthly AND weekly summaries
 * 
 * Usage: npx tsx scripts/backfill-google-ads-full-history.ts [--dry-run] [--client=CLIENT_ID]
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
// GOOGLE ADS API SERVICE (Simplified version)
// ============================================================================

interface GoogleAdsCredentials {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  developmentToken: string;
  customerId: string;
  managerCustomerId?: string;
}

class GoogleAdsAPIService {
  private credentials: GoogleAdsCredentials;
  private accessToken: string | null = null;

  constructor(credentials: GoogleAdsCredentials) {
    this.credentials = credentials;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!data.access_token) {
      throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
    }

    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async getCampaignData(startDate: string, endDate: string): Promise<any[]> {
    const accessToken = await this.getAccessToken();
    const customerId = this.credentials.customerId.replace(/-/g, '');
    
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions,
        metrics.conversions_value,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
    `;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': this.credentials.developmentToken,
      'Content-Type': 'application/json',
    };

    if (this.credentials.managerCustomerId) {
      headers['login-customer-id'] = this.credentials.managerCustomerId.replace(/-/g, '');
    }

    const response = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Google Ads API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Transform to our format
    return data.results.map((result: any) => ({
      id: result.campaign?.id,
      name: result.campaign?.name,
      status: result.campaign?.status,
      impressions: parseInt(result.metrics?.impressions || '0'),
      clicks: parseInt(result.metrics?.clicks || '0'),
      spend: (parseInt(result.metrics?.costMicros || '0') / 1_000_000),
      conversions: parseFloat(result.metrics?.conversions || '0'),
      all_conversions: parseFloat(result.metrics?.allConversions || '0'),
      conversions_value: parseFloat(result.metrics?.conversionsValue || '0'),
      all_conversions_value: parseFloat(result.metrics?.allConversionsValue || '0'),
      // Map to our funnel metrics
      reservations: parseFloat(result.metrics?.conversions || '0'),
      reservation_value: parseFloat(result.metrics?.conversionsValue || '0'),
    }));
  }
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function getMonthsToBackfill(): Array<{ year: number; month: number; startDate: string; endDate: string }> {
  const months: Array<{ year: number; month: number; startDate: string; endDate: string }> = [];
  
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
      year,
      month,
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    });
    
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  return months;
}

function getWeeksToBackfill(): Array<{ weekNumber: number; startDate: string; endDate: string }> {
  const weeks: Array<{ weekNumber: number; startDate: string; endDate: string }> = [];
  
  // Start from first Monday of December 2024
  const start = new Date('2024-12-02'); // First Monday of Dec 2024
  const now = new Date();
  
  let current = new Date(start);
  let weekNum = 1;
  
  while (current < now) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Only include completed weeks
    if (weekEnd < now) {
      weeks.push({
        weekNumber: weekNum,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
    }
    
    current.setDate(current.getDate() + 7);
    weekNum++;
  }
  
  return weeks;
}

// ============================================================================
// DATA STORAGE
// ============================================================================

async function storeGoogleAdsSummary(
  clientId: string, 
  summaryType: 'monthly' | 'weekly',
  summaryDate: string,
  campaigns: any[]
): Promise<boolean> {
  
  // Calculate totals
  const totals = campaigns.reduce((acc, campaign) => ({
    spend: acc.spend + (campaign.spend || 0),
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    conversions: acc.conversions + (campaign.conversions || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
  }), {
    spend: 0, impressions: 0, clicks: 0, conversions: 0,
    reservations: 0, reservation_value: 0
  });

  // Calculate derived metrics
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

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
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: Math.round(totals.reservations),
    reservation_value: totals.reservation_value,
    cost_per_reservation: cost_per_reservation,
    campaign_data: campaigns,
    active_campaign_count: campaigns.filter(c => c.status === 'ENABLED').length,
    data_source: 'google_ads_api_backfill',
    last_updated: new Date().toISOString()
  };

  if (isDryRun) {
    console.log(`   [DRY RUN] Would store: ${totals.spend.toFixed(2)} PLN, ${totals.impressions} impressions`);
    return true;
  }

  const { error } = await supabase
    .from('campaign_summaries')
    .upsert(summary, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });

  if (error) {
    console.error(`   ❌ Storage error: ${error.message}`);
    return false;
  }

  return true;
}

// ============================================================================
// MAIN BACKFILL LOGIC
// ============================================================================

async function getGoogleAdsClients() {
  const query = supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_enabled, google_ads_refresh_token')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null);
  
  if (specificClientId) {
    query.eq('id', specificClientId);
  }
  
  const { data, error } = await query.order('name');
  
  if (error) {
    console.error('❌ Error fetching clients:', error);
    return [];
  }
  
  return data || [];
}

async function getGoogleAdsSettings() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ]);

  if (error) {
    console.error('❌ Error fetching Google Ads settings:', error);
    return null;
  }

  return data.reduce((acc: any, setting: any) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
}

async function getExistingPeriods(clientId: string, platform: string, summaryType: string) {
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

async function backfillClientData(
  client: any,
  settings: any,
  months: any[],
  weeks: any[]
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 BACKFILLING: ${client.name}`);
  console.log('='.repeat(80));
  console.log(`   Customer ID: ${client.google_ads_customer_id}`);
  
  // Determine refresh token
  const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
  
  if (!refreshToken) {
    console.log(`   ❌ No refresh token available, skipping`);
    return { monthsAdded: 0, weeksAdded: 0, errors: 1 };
  }
  
  const credentials: GoogleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
  };
  
  const googleAdsService = new GoogleAdsAPIService(credentials);
  
  let monthsAdded = 0;
  let weeksAdded = 0;
  let errors = 0;
  
  // Get existing periods
  const existingMonths = await getExistingPeriods(client.id, 'google', 'monthly');
  const existingWeeks = await getExistingPeriods(client.id, 'google', 'weekly');
  
  // MONTHLY BACKFILL
  console.log(`\n📅 MONTHLY DATA (${months.length} months to check):`);
  
  for (const monthData of months) {
    const monthId = `${monthData.year}-${String(monthData.month).padStart(2, '0')}-01`;
    
    if (existingMonths.has(monthId)) {
      console.log(`   ⏭️  ${monthData.year}-${String(monthData.month).padStart(2, '0')} - Already exists`);
      continue;
    }
    
    console.log(`   📊 ${monthData.year}-${String(monthData.month).padStart(2, '0')} - Fetching...`);
    
    try {
      const campaigns = await googleAdsService.getCampaignData(monthData.startDate, monthData.endDate);
      
      if (campaigns.length === 0) {
        console.log(`      ⚠️  No campaigns found (possibly inactive month)`);
        // Store zero record to mark as processed
        await storeGoogleAdsSummary(client.id, 'monthly', monthData.startDate, []);
        continue;
      }
      
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      
      console.log(`      ✅ Found ${campaigns.length} campaigns: ${totalSpend.toFixed(2)} PLN, ${totalImpressions} impressions`);
      
      const stored = await storeGoogleAdsSummary(client.id, 'monthly', monthData.startDate, campaigns);
      if (stored) monthsAdded++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  // WEEKLY BACKFILL
  console.log(`\n📅 WEEKLY DATA (${weeks.length} weeks to check):`);
  
  for (const weekData of weeks) {
    if (existingWeeks.has(weekData.startDate)) {
      // Skip silently for weeks (too many to show)
      continue;
    }
    
    try {
      const campaigns = await googleAdsService.getCampaignData(weekData.startDate, weekData.endDate);
      
      if (campaigns.length === 0) {
        // Store zero record
        await storeGoogleAdsSummary(client.id, 'weekly', weekData.startDate, []);
        continue;
      }
      
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      console.log(`   ✅ Week ${weekData.startDate}: ${totalSpend.toFixed(2)} PLN`);
      
      const stored = await storeGoogleAdsSummary(client.id, 'weekly', weekData.startDate, campaigns);
      if (stored) weeksAdded++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      // Skip silently for weekly errors (API limits)
      errors++;
    }
  }
  
  console.log(`\n📊 ${client.name} SUMMARY:`);
  console.log(`   Months added: ${monthsAdded}`);
  console.log(`   Weeks added: ${weeksAdded}`);
  console.log(`   Errors: ${errors}`);
  
  return { monthsAdded, weeksAdded, errors };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 GOOGLE ADS FULL HISTORY BACKFILL');
  console.log('='.repeat(80));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written\n');
  }
  
  // Get settings
  const settings = await getGoogleAdsSettings();
  if (!settings) {
    console.error('❌ Could not load Google Ads settings');
    process.exit(1);
  }
  
  // Get clients
  const clients = await getGoogleAdsClients();
  console.log(`\n✅ Found ${clients.length} clients with Google Ads enabled`);
  
  if (clients.length === 0) {
    console.log('❌ No clients to process');
    process.exit(0);
  }
  
  // Get periods to backfill
  const months = getMonthsToBackfill();
  const weeks = getWeeksToBackfill();
  
  console.log(`📅 Periods to check:`);
  console.log(`   Months: ${months.length} (${months[0].startDate} to ${months[months.length-1].startDate})`);
  console.log(`   Weeks: ${weeks.length}`);
  
  // Process each client
  let totalMonthsAdded = 0;
  let totalWeeksAdded = 0;
  let totalErrors = 0;
  
  for (const client of clients) {
    try {
      const result = await backfillClientData(client, settings, months, weeks);
      totalMonthsAdded += result.monthsAdded;
      totalWeeksAdded += result.weeksAdded;
      totalErrors += result.errors;
    } catch (error: any) {
      console.error(`\n❌ Fatal error for ${client.name}: ${error.message}`);
      totalErrors++;
    }
  }
  
  // Final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nClients processed: ${clients.length}`);
  console.log(`Total months added: ${totalMonthsAdded}`);
  console.log(`Total weeks added: ${totalWeeksAdded}`);
  console.log(`Total errors: ${totalErrors}`);
  
  if (isDryRun) {
    console.log(`\n⚠️  DRY RUN - Run without --dry-run to actually backfill data`);
  } else {
    console.log(`\n✅ Backfill complete!`);
    console.log(`   Run the audit script to verify: npx tsx scripts/compare-all-clients-year-data.ts`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

