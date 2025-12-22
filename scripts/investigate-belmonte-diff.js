#!/usr/bin/env node

/**
 * Investigate the conversion funnel differences
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('🔍 INVESTIGATING CONVERSION FUNNEL DIFFERENCES\n');
  
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const client = clients[0];
  const now = new Date();
  const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const { data: cache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();
  
  const cacheData = cache.cache_data;
  
  // Check cache date range
  console.log('📅 CACHE DATE RANGE:');
  console.log('─────────────────────────────');
  console.log(`   dateRange: ${JSON.stringify(cacheData.dateRange)}`);
  console.log(`   fetchedAt: ${cacheData.fetchedAt}`);
  console.log(`   last_updated: ${cache.last_updated}\n`);
  
  // Check cache stats source
  console.log('📊 CACHE STATS:');
  console.log('─────────────────────────────');
  console.log(`   totalSpend: ${cacheData.stats.totalSpend}`);
  console.log(`   totalImpressions: ${cacheData.stats.totalImpressions}`);
  console.log(`   totalClicks: ${cacheData.stats.totalClicks}`);
  console.log(`   totalConversions: ${cacheData.stats.totalConversions}\n`);
  
  // Aggregate from campaigns to verify
  console.log('🔄 AGGREGATING FROM CACHED CAMPAIGNS:');
  console.log('─────────────────────────────');
  
  const campaigns = cacheData.campaigns || [];
  
  let totals = {
    spend: 0, impressions: 0, clicks: 0,
    booking_step_1: 0, booking_step_2: 0, booking_step_3: 0,
    reservations: 0, reservation_value: 0
  };
  
  campaigns.forEach(c => {
    totals.spend += parseFloat(c.spend || 0);
    totals.impressions += parseInt(c.impressions || 0);
    totals.clicks += parseInt(c.clicks || 0);
    totals.booking_step_1 += parseInt(c.booking_step_1 || 0);
    totals.booking_step_2 += parseInt(c.booking_step_2 || 0);
    totals.booking_step_3 += parseInt(c.booking_step_3 || 0);
    totals.reservations += parseInt(c.reservations || 0);
    totals.reservation_value += parseFloat(c.reservation_value || 0);
  });
  
  console.log(`   Spend (from campaigns): ${totals.spend.toFixed(2)}`);
  console.log(`   Impressions (from campaigns): ${totals.impressions}`);
  console.log(`   Clicks (from campaigns): ${totals.clicks}`);
  console.log(`   Booking Step 1 (from campaigns): ${totals.booking_step_1}`);
  console.log(`   Booking Step 2 (from campaigns): ${totals.booking_step_2}`);
  console.log(`   Booking Step 3 (from campaigns): ${totals.booking_step_3}`);
  console.log(`   Reservations (from campaigns): ${totals.reservations}`);
  console.log(`   Reservation Value (from campaigns): ${totals.reservation_value.toFixed(2)}\n`);
  
  // Check conversionMetrics vs aggregated
  console.log('📊 COMPARING conversionMetrics vs AGGREGATED FROM CAMPAIGNS:');
  console.log('─────────────────────────────');
  const conv = cacheData.conversionMetrics;
  console.log(`   booking_step_1: convMetrics=${conv.booking_step_1} | aggregated=${totals.booking_step_1} | ${conv.booking_step_1 === totals.booking_step_1 ? '✅' : '❌'}`);
  console.log(`   booking_step_2: convMetrics=${conv.booking_step_2} | aggregated=${totals.booking_step_2} | ${conv.booking_step_2 === totals.booking_step_2 ? '✅' : '❌'}`);
  console.log(`   booking_step_3: convMetrics=${conv.booking_step_3} | aggregated=${totals.booking_step_3} | ${conv.booking_step_3 === totals.booking_step_3 ? '✅' : '❌'}`);
  console.log(`   reservations: convMetrics=${conv.reservations} | aggregated=${totals.reservations} | ${conv.reservations === totals.reservations ? '✅' : '❌'}`);
  console.log(`   reservation_value: convMetrics=${conv.reservation_value} | aggregated=${totals.reservation_value} | ${conv.reservation_value === totals.reservation_value ? '✅' : '❌'}\n`);
  
  // Check daily_kpi_data contribution
  console.log('📊 CHECKING daily_kpi_data FOR CURRENT MONTH:');
  console.log('─────────────────────────────');
  
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = now.toISOString().split('T')[0];
  
  const { data: dailyKpi } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', client.id)
    .gte('date', startDate)
    .lte('date', endDate);
  
  if (dailyKpi && dailyKpi.length > 0) {
    console.log(`   Found ${dailyKpi.length} daily_kpi_data records for ${startDate} to ${endDate}`);
    
    let kpiTotals = {
      booking_step_1: 0, booking_step_2: 0, booking_step_3: 0,
      reservations: 0, reservation_value: 0
    };
    
    dailyKpi.forEach(d => {
      kpiTotals.booking_step_1 += parseInt(d.booking_step_1 || 0);
      kpiTotals.booking_step_2 += parseInt(d.booking_step_2 || 0);
      kpiTotals.booking_step_3 += parseInt(d.booking_step_3 || 0);
      kpiTotals.reservations += parseInt(d.reservations || 0);
      kpiTotals.reservation_value += parseFloat(d.reservation_value || 0);
    });
    
    console.log(`   Booking Step 1 (daily_kpi): ${kpiTotals.booking_step_1}`);
    console.log(`   Booking Step 2 (daily_kpi): ${kpiTotals.booking_step_2}`);
    console.log(`   Booking Step 3 (daily_kpi): ${kpiTotals.booking_step_3}`);
    console.log(`   Reservations (daily_kpi): ${kpiTotals.reservations}`);
    console.log(`   Reservation Value (daily_kpi): ${kpiTotals.reservation_value.toFixed(2)}`);
  } else {
    console.log(`   ⚠️ No daily_kpi_data records found for ${startDate} to ${endDate}`);
  }
  
  // Show sample campaign with highest reservation value
  console.log('\n📋 TOP CAMPAIGN BY RESERVATION VALUE (from cache):');
  console.log('─────────────────────────────');
  const topCampaign = [...campaigns].sort((a, b) => (b.reservation_value || 0) - (a.reservation_value || 0))[0];
  if (topCampaign) {
    console.log(`   Name: ${topCampaign.campaign_name}`);
    console.log(`   ID: ${topCampaign.campaign_id}`);
    console.log(`   Reservations: ${topCampaign.reservations}`);
    console.log(`   Reservation Value: ${topCampaign.reservation_value}`);
  }
}

investigate();


