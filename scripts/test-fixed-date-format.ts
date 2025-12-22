#!/usr/bin/env npx tsx

/**
 * Test the fixed date format with 2-3 weeks
 * This will verify that different weeks return different data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { BackgroundDataCollector } from '../src/lib/background-data-collector';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFixedDateFormat() {
  console.log('🧪 TESTING FIXED DATE FORMAT\n');
  console.log('=' .repeat(70));
  console.log('This will test if different weeks return different data');
  console.log('=' .repeat(70));
  console.log('');
  
  // Get Belmonte client
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  if (error || !clients || clients.length === 0) {
    throw new Error('Failed to find Belmonte client');
  }
  
  const belmonte = clients[0];
  console.log(`✅ Found client: ${belmonte.name} (ID: ${belmonte.id})\n`);
  
  if (!belmonte.meta_access_token) {
    throw new Error('Belmonte has no Meta access token');
  }
  
  // Clear cache to ensure fresh API calls
  console.log('🧹 Clearing Meta API cache...');
  const metaService = new MetaAPIServiceOptimized(belmonte.meta_access_token);
  metaService.clearCache();
  console.log('✅ Cache cleared\n');
  
  // Delete test weeks (weeks 1-3) to start fresh
  console.log('🗑️  Deleting test weeks (weeks 1-3) for clean test...');
  
  // Get the week dates we'll be testing
  const { getLastNWeeks } = await import('../src/lib/week-helpers');
  const testWeeks = getLastNWeeks(3, false); // Get last 3 completed weeks (not current)
  
  const weekDates = testWeeks.map(weekMonday => {
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekSunday.getDate() + 6);
    return {
      monday: weekMonday.toISOString().split('T')[0],
      sunday: weekSunday.toISOString().split('T')[0]
    };
  });
  
  console.log('   Test weeks:');
  weekDates.forEach((week, i) => {
    console.log(`   Week ${i + 1}: ${week.monday} to ${week.sunday}`);
  });
  console.log('');
  
  // Delete these specific weeks
  for (const week of weekDates) {
    const { error: deleteError } = await supabase
      .from('campaign_summaries')
      .delete()
      .eq('client_id', belmonte.id)
      .eq('summary_type', 'weekly')
      .eq('platform', 'meta')
      .eq('summary_date', week.monday);
    
    if (deleteError) {
      console.warn(`⚠️  Warning deleting week ${week.monday}:`, deleteError.message);
    }
  }
  console.log('✅ Test weeks deleted\n');
  
  // Collect only 3 weeks to test
  console.log('🔄 Collecting 3 weeks with FIXED date format...\n');
  const collector = new BackgroundDataCollector();
  
  await collector.collectWeeklySummaries(
    belmonte.name,
    1,    // startWeek: Start from 1 week ago (skip current week)
    3     // weeksToCollect: Collect only 3 weeks for testing
  );
  
  console.log('\n' + '=' .repeat(70));
  console.log('📊 VERIFICATION: Checking if weeks have different values');
  console.log('=' .repeat(70));
  
  // Verify the collected data - query all recent weekly data (not just specific dates)
  const { data: collectedData, error: queryError } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, reservations, booking_step_1, reservation_value')
    .eq('client_id', belmonte.id)
    .eq('summary_type', 'weekly')
    .eq('platform', 'meta')
    .gte('summary_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 30 days
    .order('summary_date', { ascending: false })
    .limit(10);
  
  if (queryError) {
    console.error('❌ Error querying data:', queryError);
    return;
  }
  
  if (!collectedData || collectedData.length === 0) {
    console.error('❌ No data collected!');
    return;
  }
  
  console.log('\n📅 Collected Weeks Data:');
  console.log('-'.repeat(70));
  
  const values = new Set<string>();
  
  collectedData.forEach((week: any) => {
    const valueKey = `${week.total_spend}_${week.reservations}_${week.booking_step_1}`;
    values.add(valueKey);
    
    console.log(`Week: ${week.summary_date}`);
    console.log(`  Spend: ${parseFloat(week.total_spend || 0).toFixed(2)}`);
    console.log(`  Reservations: ${week.reservations || 0}`);
    console.log(`  Booking Step 1: ${week.booking_step_1 || 0}`);
    console.log(`  Reservation Value: ${parseFloat(week.reservation_value || 0).toFixed(2)}`);
    console.log('');
  });
  
  console.log('=' .repeat(70));
  
  if (values.size === collectedData.length) {
    console.log('✅ SUCCESS! Each week has different values - date format is working!');
    console.log(`   Found ${values.size} unique value sets across ${collectedData.length} weeks`);
  } else {
    console.log('❌ FAILED! Some weeks have identical values - date format may still be wrong');
    console.log(`   Found ${values.size} unique value sets but ${collectedData.length} weeks`);
    console.log('   This suggests the API is still returning the same data for different dates');
  }
  
  console.log('=' .repeat(70));
}

testFixedDateFormat().catch(console.error);

