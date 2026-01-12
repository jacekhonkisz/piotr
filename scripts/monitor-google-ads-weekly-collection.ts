/**
 * Monitor Google Ads Weekly Data Collection Progress
 * 
 * This script provides real-time monitoring of:
 * - Weekly cache status
 * - Database collection progress
 * - Data quality checks
 * - Booking steps verification
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

async function monitorWeeklyCollection() {
  console.log('📊 GOOGLE ADS WEEKLY DATA COLLECTION MONITOR\n');
  console.log('='.repeat(60));
  
  // Part 1: Weekly Cache Status
  console.log('\n1️⃣ WEEKLY CACHE STATUS (Current Week)');
  console.log('-'.repeat(60));
  
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_week_cache')
    .select(`
      period_id,
      last_updated,
      cache_data,
      clients!inner(name)
    `)
    .order('last_updated', { ascending: false });
  
  if (cacheError) {
    console.error('❌ Error fetching cache:', cacheError);
  } else if (!cacheData || cacheData.length === 0) {
    console.log('⚠️ No weekly cache found');
  } else {
    cacheData.forEach((cache: any) => {
      const cacheAge = Math.round((Date.now() - new Date(cache.last_updated).getTime()) / (1000 * 60 * 60));
      const spend = cache.cache_data?.stats?.totalSpend || 0;
      const step1 = cache.cache_data?.conversionMetrics?.booking_step_1 || 0;
      const step2 = cache.cache_data?.conversionMetrics?.booking_step_2 || 0;
      const step3 = cache.cache_data?.conversionMetrics?.booking_step_3 || 0;
      
      console.log(`\n   Client: ${cache.clients.name}`);
      console.log(`   Period: ${cache.period_id}`);
      console.log(`   Age: ${cacheAge} hours`);
      console.log(`   Spend: ${spend.toFixed(2)} PLN`);
      console.log(`   Steps: ${step1} / ${step2} / ${step3}`);
      console.log(`   Status: ${spend > 0 ? '✅ Has data' : '⚠️ No data'}`);
    });
  }
  
  // Part 2: Database Collection Progress
  console.log('\n\n2️⃣ DATABASE COLLECTION PROGRESS (Historical Weeks)');
  console.log('-'.repeat(60));
  
  const { data: summaries, error: summariesError } = await supabase
    .from('campaign_summaries')
    .select(`
      client_id,
      summary_date,
      total_spend,
      booking_step_1,
      booking_step_2,
      booking_step_3,
      clients!inner(name)
    `)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false })
    .limit(20);
  
  if (summariesError) {
    console.error('❌ Error fetching summaries:', summariesError);
  } else if (!summaries || summaries.length === 0) {
    console.log('⚠️ No weekly summaries in database');
  } else {
    console.log(`\n   Found ${summaries.length} recent weekly records:\n`);
    summaries.forEach((summary: any) => {
      console.log(`   ${summary.clients.name} - ${summary.summary_date}`);
      console.log(`      Spend: ${(summary.total_spend || 0).toFixed(2)} PLN`);
      console.log(`      Steps: ${summary.booking_step_1 || 0} / ${summary.booking_step_2 || 0} / ${summary.booking_step_3 || 0}`);
    });
  }
  
  // Part 3: Collection Progress by Client
  console.log('\n\n3️⃣ COLLECTION PROGRESS BY CLIENT');
  console.log('-'.repeat(60));
  
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      google_ads_customer_id
    `)
    .not('google_ads_customer_id', 'is', null);
  
  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError);
  } else if (!clients || clients.length === 0) {
    console.log('⚠️ No clients with Google Ads configured');
  } else {
    for (const client of clients) {
      const { count, error: countError } = await supabase
        .from('campaign_summaries')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'weekly');
      
      const weekCount = count || 0;
      let status = '❌ No data';
      if (weekCount >= 50) status = '✅ Complete (50+ weeks)';
      else if (weekCount >= 20) status = '🟡 Partial (20-49 weeks)';
      else if (weekCount > 0) status = '🟠 Limited (1-19 weeks)';
      
      console.log(`\n   ${client.name}:`);
      console.log(`      Weeks collected: ${weekCount}`);
      console.log(`      Status: ${status}`);
    }
  }
  
  // Part 4: Recent Weeks Quality Check
  console.log('\n\n4️⃣ RECENT WEEKS DATA QUALITY');
  console.log('-'.repeat(60));
  
  const { data: recentWeeks, error: recentError } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, booking_step_1, booking_step_2, booking_step_3')
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .gte('summary_date', new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('summary_date', { ascending: false });
  
  if (recentError) {
    console.error('❌ Error fetching recent weeks:', recentError);
  } else if (!recentWeeks || recentWeeks.length === 0) {
    console.log('⚠️ No recent weekly data');
  } else {
    const weeksByDate = new Map<string, any[]>();
    recentWeeks.forEach((week: any) => {
      const date = week.summary_date;
      if (!weeksByDate.has(date)) {
        weeksByDate.set(date, []);
      }
      weeksByDate.get(date)!.push(week);
    });
    
    console.log('\n   Summary by week:\n');
    Array.from(weeksByDate.entries()).forEach(([date, weeks]) => {
      const totalSpend = weeks.reduce((sum, w) => sum + (w.total_spend || 0), 0);
      const totalStep1 = weeks.reduce((sum, w) => sum + (w.booking_step_1 || 0), 0);
      const totalStep2 = weeks.reduce((sum, w) => sum + (w.booking_step_2 || 0), 0);
      const totalStep3 = weeks.reduce((sum, w) => sum + (w.booking_step_3 || 0), 0);
      const clientsWithSteps = weeks.filter(w => (w.booking_step_1 || 0) > 0).length;
      const clientsMissingSteps = weeks.filter(w => (w.total_spend || 0) > 0 && (w.booking_step_1 || 0) === 0).length;
      
      console.log(`   ${date}:`);
      console.log(`      Clients: ${weeks.length}`);
      console.log(`      Total Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`      Total Steps: ${totalStep1} / ${totalStep2} / ${totalStep3}`);
      console.log(`      Clients with steps: ${clientsWithSteps}`);
      if (clientsMissingSteps > 0) {
        console.log(`      ⚠️ Clients missing steps: ${clientsMissingSteps}`);
      }
    });
  }
  
  // Part 5: Booking Steps Validation
  console.log('\n\n5️⃣ BOOKING STEPS VALIDATION');
  console.log('-'.repeat(60));
  
  const { data: validationData, error: validationError } = await supabase
    .from('campaign_summaries')
    .select(`
      summary_date,
      total_spend,
      booking_step_1,
      booking_step_2,
      booking_step_3,
      clients!inner(name)
    `)
    .eq('platform', 'google')
    .eq('summary_type', 'weekly')
    .gte('summary_date', new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('summary_date', { ascending: false })
    .limit(20);
  
  if (validationError) {
    console.error('❌ Error fetching validation data:', validationError);
  } else if (!validationData || validationData.length === 0) {
    console.log('⚠️ No data to validate');
  } else {
    let validCount = 0;
    let invalidCount = 0;
    
    console.log('\n   Recent weeks validation:\n');
    validationData.forEach((week: any) => {
      const step1 = week.booking_step_1 || 0;
      const step2 = week.booking_step_2 || 0;
      const step3 = week.booking_step_3 || 0;
      const spend = week.total_spend || 0;
      
      let status = '✅ Valid';
      if (step2 > step1 && step1 > 0) {
        status = '🚨 Step2 > Step1';
        invalidCount++;
      } else if (step3 > step2 && step2 > 0) {
        status = '🚨 Step3 > Step2';
        invalidCount++;
      } else if (step1 === step2 && step2 === step3 && step1 > 0) {
        status = '⚠️ All identical';
        invalidCount++;
      } else if (spend > 0 && step1 === 0) {
        status = '⚠️ No steps';
        invalidCount++;
      } else {
        validCount++;
      }
      
      console.log(`   ${week.clients.name} - ${week.summary_date}: ${status}`);
      if (status !== '✅ Valid') {
        console.log(`      Steps: ${step1} / ${step2} / ${step3}, Spend: ${spend.toFixed(2)} PLN`);
      }
    });
    
    console.log(`\n   Validation Summary:`);
    console.log(`      ✅ Valid: ${validCount}`);
    console.log(`      ⚠️ Issues: ${invalidCount}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Monitoring complete');
  console.log('\n💡 Run this script periodically to track collection progress');
}

monitorWeeklyCollection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Monitoring failed:', error);
    process.exit(1);
  });

