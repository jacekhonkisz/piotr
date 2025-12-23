#!/usr/bin/env node
/**
 * Test script to simulate exactly what happens when loading Dec 2024 report
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testDecember2024Fetch() {
  console.log('\n🧪 SIMULATING FRONTEND FETCH FOR DECEMBER 2024\n');
  console.log('='.repeat(80));
  
  // 1. Get Havet client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) {
    console.error('❌ Havet not found');
    return;
  }
  
  console.log(`\n✅ Client: ${client.name} (${client.id})\n`);
  
  // 2. Simulate period classification
  const dateRange = {
    start: '2024-12-01',
    end: '2024-12-31'
  };
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 12 (December)
  
  const startDate = new Date(dateRange.start);
  const startYear = startDate.getFullYear(); // 2024
  const startMonth = startDate.getMonth() + 1; // 12
  
  const isExactCurrentMonth = startYear === currentYear && startMonth === currentMonth;
  const includesCurrentDay = dateRange.end >= today;
  
  console.log('📅 PERIOD CLASSIFICATION:');
  console.log(`   Today: ${today}`);
  console.log(`   Current Year/Month: ${currentYear}/${currentMonth}`);
  console.log(`   Request Year/Month: ${startYear}/${startMonth}`);
  console.log(`   isExactCurrentMonth: ${isExactCurrentMonth}`);
  console.log(`   includesCurrentDay: ${dateRange.end} >= ${today} = ${includesCurrentDay}`);
  console.log(`   needsSmartCache: ${isExactCurrentMonth && includesCurrentDay}`);
  console.log(`   Strategy: ${isExactCurrentMonth && includesCurrentDay ? '🔄 SMART_CACHE' : '💾 DATABASE_FIRST'}`);
  
  const needsSmartCache = isExactCurrentMonth && includesCurrentDay;
  
  console.log('\n' + '='.repeat(80));
  
  if (!needsSmartCache) {
    // Historical - check database
    console.log('\n💾 FETCHING FROM DATABASE (campaign_summaries):\n');
    
    const { data: summary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .eq('platform', 'meta')
      .eq('summary_date', dateRange.start)
      .single();
      
    if (error) {
      console.error('❌ Database error:', error.message);
      return;
    }
    
    if (!summary) {
      console.error('❌ No summary found');
      return;
    }
    
    console.log('✅ FOUND SUMMARY:');
    console.log(`   summary_date: ${summary.summary_date}`);
    console.log(`   platform: ${summary.platform}`);
    console.log(`   summary_type: ${summary.summary_type}`);
    console.log(`   total_spend: ${summary.total_spend} zł`);
    console.log(`   total_impressions: ${summary.total_impressions}`);
    console.log(`   total_clicks: ${summary.total_clicks}`);
    console.log(`   total_conversions: ${summary.total_conversions}`);
    console.log(`   average_ctr: ${summary.average_ctr}`);
    console.log(`   average_cpc: ${summary.average_cpc}`);
    console.log(`   reservations: ${summary.reservations}`);
    console.log(`   reservation_value: ${summary.reservation_value} zł`);
    console.log(`   click_to_call: ${summary.click_to_call}`);
    console.log(`   email_contacts: ${summary.email_contacts}`);
    console.log(`   booking_step_1: ${summary.booking_step_1}`);
    console.log(`   booking_step_2: ${summary.booking_step_2}`);
    console.log(`   booking_step_3: ${summary.booking_step_3}`);
    console.log(`   campaigns count: ${summary.campaign_data?.length || 0}`);
    
    // Transform to match StandardizedDataFetcher output
    console.log('\n📦 TRANSFORMED DATA (what frontend receives):');
    
    const sanitizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : 0;
      }
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };
    
    const totalSpend = sanitizeNumber(summary.total_spend);
    const reservationValue = sanitizeNumber(summary.reservation_value);
    const reservations = sanitizeNumber(summary.reservations);
    
    const transformedData = {
      stats: {
        totalSpend,
        totalImpressions: sanitizeNumber(summary.total_impressions),
        totalClicks: sanitizeNumber(summary.total_clicks),
        totalConversions: Math.round(sanitizeNumber(summary.total_conversions)),
        averageCtr: sanitizeNumber(summary.average_ctr),
        averageCpc: sanitizeNumber(summary.average_cpc)
      },
      conversionMetrics: {
        click_to_call: Math.round(sanitizeNumber(summary.click_to_call)),
        email_contacts: Math.round(sanitizeNumber(summary.email_contacts)),
        booking_step_1: Math.round(sanitizeNumber(summary.booking_step_1)),
        booking_step_2: Math.round(sanitizeNumber(summary.booking_step_2)),
        booking_step_3: Math.round(sanitizeNumber(summary.booking_step_3)),
        reservations: Math.round(reservations),
        reservation_value: Math.round(reservationValue * 100) / 100,
        conversion_value: Math.round(reservationValue * 100) / 100,
        total_conversion_value: Math.round(reservationValue * 100) / 100,
        roas: reservationValue && totalSpend ? Math.round((reservationValue / totalSpend) * 100) / 100 : 0,
        cost_per_reservation: reservations && totalSpend ? Math.round((totalSpend / reservations) * 100) / 100 : 0,
      }
    };
    
    console.log('\nstats:');
    console.log(JSON.stringify(transformedData.stats, null, 2));
    
    console.log('\nconversionMetrics:');
    console.log(JSON.stringify(transformedData.conversionMetrics, null, 2));
    
    console.log('\n✅ THIS IS WHAT THE FRONTEND SHOULD RECEIVE');
    console.log('\nIf ConversionFunnel shows "N/A brak danych", the issue is:');
    console.log('1. Frontend not calling the right endpoint');
    console.log('2. Frontend receiving different data');
    console.log('3. ConversionFunnel component not reading conversionMetrics correctly');
    
  } else {
    // Current period - check smart cache
    console.log('\n🔄 FETCHING FROM SMART CACHE (current_month_cache):\n');
    
    const { data: cache, error } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .single();
      
    if (error) {
      console.error('❌ Cache error:', error.message);
      return;
    }
    
    if (!cache) {
      console.error('❌ No cache found');
      return;
    }
    
    console.log('✅ FOUND CACHE:');
    console.log(JSON.stringify(cache.cache_data, null, 2));
  }
}

testDecember2024Fetch().catch(console.error);

