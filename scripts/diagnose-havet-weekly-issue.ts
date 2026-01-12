/**
 * Diagnose Havet Weekly Google Ads Issue
 * 
 * This script:
 * 1. Checks if Havet has weekly data in database
 * 2. Tests the date range for week 2025-W01
 * 3. Verifies client configuration
 * 4. Tests API call with proper parameters
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseHavetWeekly() {
  console.log('🔍 DIAGNOSING HAVET WEEKLY GOOGLE ADS ISSUE\n');
  console.log('='.repeat(60));
  
  // Step 1: Find Havet client
  console.log('\n1️⃣ Finding Havet client...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%');
  
  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ Havet client not found');
    process.exit(1);
  }
  
  const havet = clients[0];
  console.log(`✅ Found: ${havet.name} (${havet.id.substring(0, 8)}...)`);
  console.log(`   Google Ads enabled: ${havet.google_ads_enabled}`);
  console.log(`   Customer ID: ${havet.google_ads_customer_id || 'N/A'}`);
  console.log(`   Has refresh token: ${!!havet.google_ads_refresh_token}`);
  
  // Step 2: Check weekly data in database
  console.log('\n\n2️⃣ Checking weekly Google Ads data in database...');
  
  // Week 2025-W01: Dec 30, 2024 - Jan 5, 2025
  // Monday is Dec 30, 2024
  const week2025W01Monday = '2024-12-30';
  
  const { data: weeklyData, error: weeklyError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', havet.id)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .eq('summary_date', week2025W01Monday);
  
  if (weeklyError) {
    console.error('❌ Error querying database:', weeklyError);
  } else if (!weeklyData || weeklyData.length === 0) {
    console.log(`⚠️ No data found for week 2025-W01 (${week2025W01Monday})`);
    console.log('   This is why the system is trying to fetch from API');
  } else {
    console.log(`✅ Found data for week 2025-W01:`);
    console.log(`   Spend: ${weeklyData[0].total_spend} PLN`);
    console.log(`   Campaigns: ${jsonb_array_length(weeklyData[0].campaign_data)}`);
    console.log(`   Booking steps: ${weeklyData[0].booking_step_1}/${weeklyData[0].booking_step_2}/${weeklyData[0].booking_step_3}`);
  }
  
  // Step 3: Check all weekly data for Havet
  console.log('\n\n3️⃣ Checking all weekly Google Ads data for Havet...');
  const { data: allWeekly, error: allWeeklyError } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, booking_step_1')
    .eq('client_id', havet.id)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false })
    .limit(10);
  
  if (allWeeklyError) {
    console.error('❌ Error:', allWeeklyError);
  } else if (!allWeekly || allWeekly.length === 0) {
    console.log('⚠️ No weekly Google Ads data found for Havet at all');
    console.log('   This means weekly collection has not run yet');
  } else {
    console.log(`✅ Found ${allWeekly.length} weekly records:`);
    allWeekly.forEach((week: any) => {
      console.log(`   ${week.summary_date}: ${week.total_spend} PLN, Steps: ${week.booking_step_1 || 0}`);
    });
  }
  
  // Step 4: Check weekly cache
  console.log('\n\n4️⃣ Checking weekly cache...');
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_week_cache')
    .select('*')
    .eq('client_id', havet.id);
  
  if (cacheError) {
    console.error('❌ Error:', cacheError);
  } else if (!cacheData || cacheData.length === 0) {
    console.log('⚠️ No weekly cache found');
  } else {
    console.log(`✅ Found ${cacheData.length} cache entries:`);
    cacheData.forEach((cache: any) => {
      const age = Math.round((Date.now() - new Date(cache.last_updated).getTime()) / (1000 * 60 * 60));
      console.log(`   Period: ${cache.period_id}, Age: ${age} hours`);
    });
  }
  
  // Step 5: Test date range validation
  console.log('\n\n5️⃣ Testing date range for week 2025-W01...');
  const startDate = '2024-12-30';
  const endDate = '2025-01-05';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const today = new Date().toISOString().split('T')[0];
  const isCurrentWeek = endDate >= today;
  
  console.log(`   Start: ${startDate}`);
  console.log(`   End: ${endDate}`);
  console.log(`   Days: ${daysDiff}`);
  console.log(`   Today: ${today}`);
  console.log(`   Is current week: ${isCurrentWeek}`);
  console.log(`   Should use database: ${!isCurrentWeek}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('\n💡 Recommendations:');
  
  if (!allWeekly || allWeekly.length === 0) {
    console.log('   1. Run weekly data collection for Havet:');
    console.log('      npx tsx scripts/fix-google-ads-weeks.ts');
  } else if (!weeklyData || weeklyData.length === 0) {
    console.log('   1. Week 2025-W01 needs to be collected');
    console.log('   2. Run: npx tsx scripts/fix-google-ads-weeks.ts');
  } else {
    console.log('   1. Data exists in database');
    console.log('   2. Check why the fetch is not using database');
    console.log('   3. Verify the Monday date matching logic');
  }
}

function jsonb_array_length(data: any): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  return 0;
}

diagnoseHavetWeekly()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });

