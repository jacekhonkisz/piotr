/**
 * Fix Google Ads Weekly Booking Steps
 * 
 * This script:
 * 1. Identifies weekly summaries with spend but no booking steps
 * 2. Re-collects those weeks from API with proper booking steps
 * 3. Updates the database with correct values
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWeeklyBookingSteps() {
  console.log('🔧 FIXING GOOGLE ADS WEEKLY BOOKING STEPS\n');
  console.log('='.repeat(60));
  
  // Step 1: Find problematic records
  console.log('\n1️⃣ Finding weekly summaries with spend but no booking steps...');
  
  const { data: problematicWeeks, error: findError } = await supabase
    .from('campaign_summaries')
    .select(`
      id,
      client_id,
      summary_date,
      total_spend,
      booking_step_1,
      booking_step_2,
      booking_step_3,
      clients!inner(name, google_ads_customer_id)
    `)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .gt('total_spend', 0)
    .eq('booking_step_1', 0)
    .order('summary_date', { ascending: false })
    .limit(50);
  
  if (findError) {
    console.error('❌ Error finding problematic weeks:', findError);
    process.exit(1);
  }
  
  if (!problematicWeeks || problematicWeeks.length === 0) {
    console.log('✅ No problematic weeks found!');
    return;
  }
  
  console.log(`\n⚠️ Found ${problematicWeeks.length} weeks with issues:\n`);
  problematicWeeks.forEach((week: any) => {
    console.log(`   ${week.clients.name} - ${week.summary_date}: ${week.total_spend.toFixed(2)} PLN, Steps: 0/0/0`);
  });
  
  // Step 2: Get Google Ads settings
  console.log('\n\n2️⃣ Getting Google Ads system settings...');
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
    console.error('❌ Failed to get Google Ads settings');
    process.exit(1);
  }
  
  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);
  
  // Step 3: Fix each problematic week
  console.log('\n\n3️⃣ Fixing problematic weeks...\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const week of problematicWeeks) {
    const client = week.clients;
    console.log(`📊 Fixing: ${client.name} - ${week.summary_date}`);
    
    try {
      // Calculate week dates (summary_date is Monday)
      const weekStart = new Date(week.summary_date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startDate = weekStart.toISOString().split('T')[0];
      const endDate = weekEnd.toISOString().split('T')[0];
      
      // Get refresh token
      let refreshToken = settings.google_ads_manager_refresh_token;
      if (!refreshToken) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('google_ads_refresh_token')
          .eq('id', week.client_id)
          .single();
        refreshToken = clientData?.google_ads_refresh_token;
      }
      
      if (!refreshToken) {
        console.log(`   ⚠️ No refresh token, skipping`);
        errorCount++;
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
      
      // Fetch fresh data from API
      const campaigns = await googleAdsService.getCampaignData(startDate, endDate);
      
      if (!campaigns || campaigns.length === 0) {
        console.log(`   ⚠️ No campaigns found for this week`);
        errorCount++;
        continue;
      }
      
      // Aggregate booking steps from API
      const bookingStep1 = Math.round(campaigns.reduce((sum, c: any) => sum + (c.booking_step_1 || 0), 0));
      const bookingStep2 = Math.round(campaigns.reduce((sum, c: any) => sum + (c.booking_step_2 || 0), 0));
      const bookingStep3 = Math.round(campaigns.reduce((sum, c: any) => sum + (c.booking_step_3 || 0), 0));
      const reservations = Math.round(campaigns.reduce((sum, c: any) => sum + (c.reservations || 0), 0));
      const reservationValue = campaigns.reduce((sum, c: any) => sum + (c.reservation_value || 0), 0);
      
      console.log(`   📊 API Results: Step1=${bookingStep1}, Step2=${bookingStep2}, Step3=${bookingStep3}, Reservations=${reservations}`);
      
      // Update database
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
        .eq('id', week.id);
      
      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Fixed! Updated booking steps from API`);
        fixedCount++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message || error}`);
      errorCount++;
    }
    
    // Small delay between fixes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ FIX COMPLETE!');
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total: ${problematicWeeks.length}`);
}

fixWeeklyBookingSteps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

