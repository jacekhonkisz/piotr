#!/usr/bin/env node

/**
 * BELMONTE META DATA COMPARISON: CACHED vs LIVE
 * 
 * This script compares:
 * 1. Data currently stored in smart cache (what's displayed)
 * 2. Live data fetched directly from Meta API
 * 
 * Purpose: Verify that displayed data matches real Meta data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Meta API configuration
const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function fetchFromMetaAPI(accessToken, adAccountId, startDate, endDate) {
  const processedAdAccountId = adAccountId.startsWith('act_') 
    ? adAccountId.substring(4) 
    : adAccountId;
  
  const fields = [
    'campaign_id',
    'campaign_name',
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'reach',
    'frequency',
    'conversions',
    'actions',
    'action_values'
  ].join(',');
  
  const url = `${META_API_BASE}/act_${processedAdAccountId}/insights?` +
    `level=campaign` +
    `&time_range={"since":"${startDate}","until":"${endDate}"}` +
    `&fields=${fields}` +
    `&access_token=${accessToken}`;
  
  console.log(`\n🔗 Fetching from Meta API...`);
  console.log(`   Date range: ${startDate} to ${endDate}`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`);
  }
  
  return data.data || [];
}

function parseMetaActions(actions = [], actionValues = []) {
  const metrics = {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
  };

  actions.forEach((action) => {
    const actionType = String(action.action_type || '').toLowerCase();
    const value = parseInt(action.value || '0', 10);
    
    if (isNaN(value) || value < 0) return;
    
    if (actionType.includes('click_to_call') || actionType.includes('phone_number_clicks') || actionType.includes('call')) {
      metrics.click_to_call += value;
    }
    
    if (actionType.includes('contact') || actionType.includes('email') || actionType.includes('lead')) {
      metrics.email_contacts += value;
    }
    
    if (actionType.includes('search') || actionType === 'omni_search') {
      metrics.booking_step_1 += value;
    }
    
    if (actionType.includes('view_content') || actionType === 'omni_view_content') {
      metrics.booking_step_2 += value;
    }
    
    if (actionType.includes('initiate_checkout') || actionType === 'omni_initiated_checkout') {
      metrics.booking_step_3 += value;
    }
    
    if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase') || actionType.includes('omni_purchase')) {
      metrics.reservations += value;
    }
  });

  actionValues.forEach((actionValue) => {
    const actionType = String(actionValue.action_type || '').toLowerCase();
    const value = parseFloat(actionValue.value || '0');
    
    if (isNaN(value) || value < 0) return;
    
    if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase') || actionType.includes('omni_purchase')) {
      metrics.reservation_value += value;
    }
  });

  return metrics;
}

function aggregateCampaigns(campaigns) {
  const totals = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    conversions: 0,
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
    campaignCount: campaigns.length
  };
  
  campaigns.forEach(campaign => {
    totals.spend += parseFloat(campaign.spend || 0);
    totals.impressions += parseInt(campaign.impressions || 0);
    totals.clicks += parseInt(campaign.clicks || 0);
    totals.reach += parseInt(campaign.reach || 0);
    totals.conversions += parseInt(campaign.conversions || 0);
    
    // Parse actions for each campaign
    const conversions = parseMetaActions(campaign.actions, campaign.action_values);
    totals.click_to_call += conversions.click_to_call;
    totals.email_contacts += conversions.email_contacts;
    totals.booking_step_1 += conversions.booking_step_1;
    totals.booking_step_2 += conversions.booking_step_2;
    totals.booking_step_3 += conversions.booking_step_3;
    totals.reservations += conversions.reservations;
    totals.reservation_value += conversions.reservation_value;
  });
  
  // Calculate derived metrics
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  totals.roas = totals.spend > 0 ? totals.reservation_value / totals.spend : 0;
  totals.cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;
  
  return totals;
}

function formatNumber(num, decimals = 2) {
  if (num === undefined || num === null) return 'N/A';
  return Number(num).toFixed(decimals);
}

function formatCurrency(num) {
  if (num === undefined || num === null) return 'N/A';
  return Number(num).toFixed(2) + ' PLN';
}

function compareValues(label, cached, live, tolerance = 0.01) {
  const cachedNum = parseFloat(cached) || 0;
  const liveNum = parseFloat(live) || 0;
  
  const diff = Math.abs(cachedNum - liveNum);
  const maxVal = Math.max(cachedNum, liveNum, 1);
  const percentDiff = (diff / maxVal) * 100;
  
  const match = percentDiff <= tolerance * 100;
  const icon = match ? '✅' : '❌';
  const status = match ? 'MATCH' : `DIFF: ${percentDiff.toFixed(1)}%`;
  
  console.log(`   ${icon} ${label.padEnd(20)} | Cached: ${formatNumber(cachedNum, 2).padStart(15)} | Live: ${formatNumber(liveNum, 2).padStart(15)} | ${status}`);
  
  return match;
}

async function compareBelmonteMetaData() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('   🔍 BELMONTE META DATA COMPARISON: CACHED vs LIVE API');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Get Belmonte client
    console.log('📋 Step 1: Finding Belmonte client...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .limit(1);
    
    if (clientError || !clients || clients.length === 0) {
      console.error('❌ Belmonte client not found:', clientError);
      return;
    }
    
    const client = clients[0];
    console.log(`   ✅ Found: ${client.name}`);
    console.log(`   📧 Email: ${client.email}`);
    console.log(`   🆔 Client ID: ${client.id}`);
    console.log(`   📊 Ad Account ID: ${client.ad_account_id}`);
    
    // Check for token
    const accessToken = client.system_user_token || client.meta_access_token;
    if (!accessToken) {
      console.error('\n❌ No Meta access token found for Belmonte');
      return;
    }
    console.log(`   🔑 Token: ${accessToken.substring(0, 20)}...`);
    
    // 2. Get current month date range
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`\n📅 Current Month Period: ${periodId}`);
    console.log(`   Start: ${startDate}`);
    console.log(`   End: ${endDate}`);
    
    // 3. Get cached data from current_month_cache
    console.log('\n📋 Step 2: Fetching CACHED data from database...');
    const { data: cachedData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();
    
    if (cacheError) {
      console.log(`   ⚠️ No cache found: ${cacheError.message}`);
    }
    
    let cachedTotals = null;
    if (cachedData) {
      console.log(`   ✅ Cache found!`);
      console.log(`   📊 Last updated: ${cachedData.updated_at}`);
      
      // Extract totals from cache
      const cacheContent = cachedData.data || cachedData;
      cachedTotals = {
        spend: parseFloat(cacheContent.stats?.totalSpend || cacheContent.totalSpend || 0),
        impressions: parseInt(cacheContent.stats?.totalImpressions || cacheContent.totalImpressions || 0),
        clicks: parseInt(cacheContent.stats?.totalClicks || cacheContent.totalClicks || 0),
        conversions: parseInt(cacheContent.stats?.totalConversions || cacheContent.totalConversions || 0),
        click_to_call: parseInt(cacheContent.conversionMetrics?.click_to_call || 0),
        email_contacts: parseInt(cacheContent.conversionMetrics?.email_contacts || 0),
        booking_step_1: parseInt(cacheContent.conversionMetrics?.booking_step_1 || 0),
        booking_step_2: parseInt(cacheContent.conversionMetrics?.booking_step_2 || 0),
        booking_step_3: parseInt(cacheContent.conversionMetrics?.booking_step_3 || 0),
        reservations: parseInt(cacheContent.conversionMetrics?.reservations || 0),
        reservation_value: parseFloat(cacheContent.conversionMetrics?.reservation_value || 0),
        campaignCount: cacheContent.campaigns?.length || 0
      };
      
      console.log(`   📊 Cached campaigns: ${cachedTotals.campaignCount}`);
    }
    
    // 4. Fetch LIVE data from Meta API
    console.log('\n📋 Step 3: Fetching LIVE data from Meta API...');
    const liveCampaigns = await fetchFromMetaAPI(accessToken, client.ad_account_id, startDate, endDate);
    console.log(`   ✅ Live campaigns fetched: ${liveCampaigns.length}`);
    
    const liveTotals = aggregateCampaigns(liveCampaigns);
    
    // 5. Compare data
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('   📊 COMPARISON: CACHED DATA vs LIVE META API');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    
    if (!cachedTotals) {
      console.log('   ⚠️ No cached data available - showing LIVE data only:\n');
      console.log('   LIVE DATA (From Meta API):');
      console.log('   ─────────────────────────────────────────');
      console.log(`   Campaigns:        ${liveTotals.campaignCount}`);
      console.log(`   Spend:            ${formatCurrency(liveTotals.spend)}`);
      console.log(`   Impressions:      ${liveTotals.impressions.toLocaleString()}`);
      console.log(`   Clicks:           ${liveTotals.clicks.toLocaleString()}`);
      console.log(`   CTR:              ${formatNumber(liveTotals.ctr)}%`);
      console.log(`   CPC:              ${formatCurrency(liveTotals.cpc)}`);
      console.log(`   Click to Call:    ${liveTotals.click_to_call}`);
      console.log(`   Email Contacts:   ${liveTotals.email_contacts}`);
      console.log(`   Booking Step 1:   ${liveTotals.booking_step_1}`);
      console.log(`   Booking Step 2:   ${liveTotals.booking_step_2}`);
      console.log(`   Booking Step 3:   ${liveTotals.booking_step_3}`);
      console.log(`   Reservations:     ${liveTotals.reservations}`);
      console.log(`   Reservation Value: ${formatCurrency(liveTotals.reservation_value)}`);
      return;
    }
    
    console.log('   CORE METRICS:');
    console.log('   ─────────────────────────────────────────────────────────────────────');
    
    let allMatch = true;
    
    allMatch &= compareValues('Campaigns', cachedTotals.campaignCount, liveTotals.campaignCount, 0);
    allMatch &= compareValues('Spend', cachedTotals.spend, liveTotals.spend, 0.05);
    allMatch &= compareValues('Impressions', cachedTotals.impressions, liveTotals.impressions, 0.05);
    allMatch &= compareValues('Clicks', cachedTotals.clicks, liveTotals.clicks, 0.05);
    
    console.log('\n   CONVERSION FUNNEL:');
    console.log('   ─────────────────────────────────────────────────────────────────────');
    
    allMatch &= compareValues('Click to Call', cachedTotals.click_to_call, liveTotals.click_to_call, 0.05);
    allMatch &= compareValues('Email Contacts', cachedTotals.email_contacts, liveTotals.email_contacts, 0.05);
    allMatch &= compareValues('Booking Step 1', cachedTotals.booking_step_1, liveTotals.booking_step_1, 0.05);
    allMatch &= compareValues('Booking Step 2', cachedTotals.booking_step_2, liveTotals.booking_step_2, 0.05);
    allMatch &= compareValues('Booking Step 3', cachedTotals.booking_step_3, liveTotals.booking_step_3, 0.05);
    allMatch &= compareValues('Reservations', cachedTotals.reservations, liveTotals.reservations, 0.05);
    allMatch &= compareValues('Reservation Value', cachedTotals.reservation_value, liveTotals.reservation_value, 0.05);
    
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    if (allMatch) {
      console.log('   ✅ RESULT: ALL DATA MATCHES! Cached data is accurate.');
    } else {
      console.log('   ⚠️ RESULT: Some discrepancies found. Cache may be stale.');
      console.log('   💡 Consider refreshing the smart cache.');
    }
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    
    // 6. Show campaign details comparison
    console.log('\n📋 CAMPAIGN DETAILS (Live from Meta API):');
    console.log('─────────────────────────────────────────────────────────────────────');
    
    liveCampaigns.forEach((campaign, idx) => {
      const conversions = parseMetaActions(campaign.actions, campaign.action_values);
      console.log(`\n${idx + 1}. ${campaign.campaign_name || 'Unknown Campaign'}`);
      console.log(`   ID: ${campaign.campaign_id}`);
      console.log(`   Spend: ${formatCurrency(campaign.spend)} | Impr: ${parseInt(campaign.impressions || 0).toLocaleString()} | Clicks: ${parseInt(campaign.clicks || 0).toLocaleString()}`);
      console.log(`   Funnel: Step1=${conversions.booking_step_1} → Step2=${conversions.booking_step_2} → Step3=${conversions.booking_step_3} → Reservations=${conversions.reservations}`);
      console.log(`   Value: ${formatCurrency(conversions.reservation_value)}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

compareBelmonteMetaData();


