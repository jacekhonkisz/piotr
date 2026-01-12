/**
 * Re-collect Google Ads Weeks Missing Booking Steps
 * 
 * This script focuses on weeks that have spend but no booking steps
 * These are definitely wrong and need to be re-collected
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { getSundayOfWeek, formatDateISO, validateIsMonday } from '../src/lib/week-helpers';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recollectWeeksMissingSteps() {
  console.log('🔄 RE-COLLECTING GOOGLE ADS WEEKS MISSING BOOKING STEPS\n');
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
  
  // Step 3: Find and re-collect weeks with spend but no steps
  let totalRecollected = 0;
  let totalSkipped = 0;
  
  for (const client of clients) {
    console.log(`\n📊 Processing: ${client.name}`);
    console.log('-'.repeat(60));
    
    // Find weeks with spend but no booking steps
    const { data: weeksMissingSteps, error: weeksError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, total_spend, booking_step_1, booking_step_2, booking_step_3')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'weekly')
      .gt('total_spend', 0)
      .eq('booking_step_1', 0)
      .order('summary_date', { ascending: false });
    
    if (weeksError) {
      console.log(`   ⚠️ Error fetching weeks: ${weeksError.message}`);
      continue;
    }
    
    if (!weeksMissingSteps || weeksMissingSteps.length === 0) {
      console.log(`   ✅ No weeks missing steps`);
      continue;
    }
    
    console.log(`   Found ${weeksMissingSteps.length} weeks with spend but no booking steps`);
    
    // Re-collect each week
    let recollected = 0;
    let skipped = 0;
    
    for (const weekRecord of weeksMissingSteps) {
      const weekMonday = weekRecord.summary_date;
      const weekMondayDate = new Date(weekMonday);
      const weekSunday = getSundayOfWeek(weekMondayDate);
      
      console.log(`   📅 Re-collecting: ${weekMonday} (Spend: ${weekRecord.total_spend.toFixed(2)} PLN)`);
      
      try {
        // Get refresh token
        let refreshToken = settings.google_ads_manager_refresh_token;
        if (!refreshToken && client.google_ads_refresh_token) {
          refreshToken = client.google_ads_refresh_token;
        }
        
        if (!refreshToken) {
          console.log(`      ⚠️ No refresh token, skipping`);
          skipped++;
          continue;
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
        const campaigns = await googleAdsService.getCampaignData(weekMonday, formatDateISO(weekSunday));
        
        if (!campaigns || campaigns.length === 0) {
          console.log(`      ⚠️ No campaigns found`);
          skipped++;
          continue;
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
        try {
          validateIsMonday(weekMondayDate);
        } catch (error) {
          console.log(`      ❌ Validation failed: ${weekMonday} is not a Monday`);
          skipped++;
          continue;
        }
        
        // Update in database
        const summary = {
          client_id: client.id,
          summary_type: 'weekly',
          summary_date: weekMonday,
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
          skipped++;
        } else {
          const oldSteps = weekRecord.booking_step_1 || 0;
          const newSteps = totals.booking_step_1 || 0;
          const oldSpend = weekRecord.total_spend || 0;
          const newSpend = totals.spend || 0;
          
          console.log(`      ✅ Updated: Steps ${oldSteps} → ${newSteps}, Spend ${oldSpend.toFixed(2)} → ${newSpend.toFixed(2)} PLN`);
          recollected++;
          totalRecollected++;
        }
        
      } catch (error: any) {
        console.log(`      ❌ Error: ${error.message || error}`);
        skipped++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n   ✅ Re-collected: ${recollected} weeks`);
    console.log(`   ⚠️ Skipped: ${skipped} weeks`);
    totalSkipped += skipped;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ RE-COLLECTION COMPLETE!');
  console.log(`   Total re-collected: ${totalRecollected} weeks`);
  console.log(`   Total skipped: ${totalSkipped} weeks`);
  console.log('\n💡 Next: Check if zero spend weeks are correct (they might actually have no activity)');
}

recollectWeeksMissingSteps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Re-collection failed:', error);
    process.exit(1);
  });

