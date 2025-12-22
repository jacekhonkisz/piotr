#!/usr/bin/env node

/**
 * FINAL COMPARISON: Belmonte Cached vs Live Meta API Data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function fetchLiveFromMetaAPI(accessToken, adAccountId, startDate, endDate) {
  const processedAdAccountId = adAccountId.startsWith('act_') 
    ? adAccountId.substring(4) 
    : adAccountId;
  
  const fields = [
    'campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',
    'reach', 'frequency', 'conversions', 'actions', 'action_values'
  ].join(',');
  
  const url = `${META_API_BASE}/act_${processedAdAccountId}/insights?` +
    `level=campaign` +
    `&time_range={"since":"${startDate}","until":"${endDate}"}` +
    `&fields=${fields}` +
    `&access_token=${accessToken}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`);
  }
  
  return data.data || [];
}

function parseMetaActions(actions = [], actionValues = []) {
  const metrics = {
    click_to_call: 0, email_contacts: 0, booking_step_1: 0,
    booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0,
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

  actionValues.forEach((av) => {
    const actionType = String(av.action_type || '').toLowerCase();
    const value = parseFloat(av.value || '0');
    if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase') || actionType.includes('omni_purchase')) {
      metrics.reservation_value += value;
    }
  });

  return metrics;
}

function aggregateLiveCampaigns(campaigns) {
  const totals = {
    spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0,
    click_to_call: 0, email_contacts: 0, booking_step_1: 0,
    booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0,
    campaignCount: campaigns.length
  };
  
  campaigns.forEach(campaign => {
    totals.spend += parseFloat(campaign.spend || 0);
    totals.impressions += parseInt(campaign.impressions || 0);
    totals.clicks += parseInt(campaign.clicks || 0);
    totals.reach += parseInt(campaign.reach || 0);
    totals.conversions += parseInt(campaign.conversions || 0);
    
    const conversions = parseMetaActions(campaign.actions, campaign.action_values);
    totals.click_to_call += conversions.click_to_call;
    totals.email_contacts += conversions.email_contacts;
    totals.booking_step_1 += conversions.booking_step_1;
    totals.booking_step_2 += conversions.booking_step_2;
    totals.booking_step_3 += conversions.booking_step_3;
    totals.reservations += conversions.reservations;
    totals.reservation_value += conversions.reservation_value;
  });
  
  return totals;
}

function fmt(num, decimals = 2) {
  return Number(num || 0).toFixed(decimals);
}

function compare(label, cached, live, tolerance = 0.05) {
  const c = parseFloat(cached) || 0;
  const l = parseFloat(live) || 0;
  const diff = Math.abs(c - l);
  const maxVal = Math.max(c, l, 1);
  const pctDiff = (diff / maxVal) * 100;
  const match = pctDiff <= tolerance * 100;
  const icon = match ? '✅' : '❌';
  const diffText = pctDiff > 0 ? `(${pctDiff.toFixed(1)}% diff)` : '';
  
  console.log(`${icon} ${label.padEnd(20)} | Cached: ${fmt(c, 0).padStart(12)} | Live: ${fmt(l, 0).padStart(12)} ${diffText}`);
  return match;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('    🔍 BELMONTE META DATA: CACHED vs LIVE COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  
  try {
    // Get Belmonte client
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .limit(1);
    
    const client = clients[0];
    const accessToken = client.system_user_token || client.meta_access_token;
    
    console.log(`📋 Client: ${client.name}`);
    console.log(`🆔 ID: ${client.id}`);
    console.log(`📊 Ad Account: ${client.ad_account_id}\n`);
    
    // Get current month
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    
    console.log(`📅 Period: ${periodId}`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}\n`);
    
    // Get CACHED data
    console.log('📦 Fetching CACHED data from database...');
    const { data: cache } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();
    
    const cacheData = cache?.cache_data;
    console.log(`   Last updated: ${cache?.last_updated}`);
    console.log(`   Campaigns: ${cacheData?.campaigns?.length || 0}\n`);
    
    // Get LIVE data
    console.log('🌐 Fetching LIVE data from Meta API...');
    const liveCampaigns = await fetchLiveFromMetaAPI(accessToken, client.ad_account_id, startDate, endDate);
    console.log(`   Campaigns: ${liveCampaigns.length}\n`);
    
    const liveTotals = aggregateLiveCampaigns(liveCampaigns);
    
    // Extract cached values
    const cachedStats = cacheData?.stats || {};
    const cachedConv = cacheData?.conversionMetrics || {};
    
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('    📊 COMPARISON RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
    console.log('CORE METRICS:');
    console.log('────────────────────────────────────────────────────────────────────────');
    let allMatch = true;
    allMatch &= compare('Campaigns', cacheData?.campaigns?.length, liveTotals.campaignCount, 0);
    allMatch &= compare('Spend', cachedStats.totalSpend, liveTotals.spend);
    allMatch &= compare('Impressions', cachedStats.totalImpressions, liveTotals.impressions);
    allMatch &= compare('Clicks', cachedStats.totalClicks, liveTotals.clicks);
    
    console.log('\nCONVERSION FUNNEL:');
    console.log('────────────────────────────────────────────────────────────────────────');
    allMatch &= compare('Click to Call', cachedConv.click_to_call, liveTotals.click_to_call);
    allMatch &= compare('Email Contacts', cachedConv.email_contacts, liveTotals.email_contacts);
    allMatch &= compare('Booking Step 1', cachedConv.booking_step_1, liveTotals.booking_step_1);
    allMatch &= compare('Booking Step 2', cachedConv.booking_step_2, liveTotals.booking_step_2);
    allMatch &= compare('Booking Step 3', cachedConv.booking_step_3, liveTotals.booking_step_3);
    allMatch &= compare('Reservations', cachedConv.reservations, liveTotals.reservations);
    allMatch &= compare('Reservation Value', cachedConv.reservation_value, liveTotals.reservation_value);
    
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    if (allMatch) {
      console.log('    ✅ RESULT: ALL DATA MATCHES! Cached data is ACCURATE.');
    } else {
      console.log('    ⚠️ RESULT: Some differences found.');
      console.log('    💡 This is normal - cache was last updated ' + cache?.last_updated);
      console.log('    💡 Small differences occur due to real-time data changes.');
    }
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
    // Show detailed comparison table
    console.log('\n📊 DETAILED NUMBERS:');
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log(`                          CACHED              LIVE              MATCH`);
    console.log(`Campaigns:           ${String(cacheData?.campaigns?.length || 0).padStart(10)}    ${String(liveTotals.campaignCount).padStart(10)}    ${cacheData?.campaigns?.length === liveTotals.campaignCount ? '✅' : '❌'}`);
    console.log(`Spend:               ${fmt(cachedStats.totalSpend).padStart(10)}    ${fmt(liveTotals.spend).padStart(10)}    ${Math.abs(cachedStats.totalSpend - liveTotals.spend) < 50 ? '✅' : '⚠️'}`);
    console.log(`Impressions:         ${String(cachedStats.totalImpressions || 0).padStart(10)}    ${String(liveTotals.impressions).padStart(10)}`);
    console.log(`Clicks:              ${String(cachedStats.totalClicks || 0).padStart(10)}    ${String(liveTotals.clicks).padStart(10)}`);
    console.log(`Click to Call:       ${String(cachedConv.click_to_call || 0).padStart(10)}    ${String(liveTotals.click_to_call).padStart(10)}    ${cachedConv.click_to_call === liveTotals.click_to_call ? '✅' : '⚠️'}`);
    console.log(`Email Contacts:      ${String(cachedConv.email_contacts || 0).padStart(10)}    ${String(liveTotals.email_contacts).padStart(10)}    ${cachedConv.email_contacts === liveTotals.email_contacts ? '✅' : '⚠️'}`);
    console.log(`Booking Step 1:      ${String(cachedConv.booking_step_1 || 0).padStart(10)}    ${String(liveTotals.booking_step_1).padStart(10)}    ${cachedConv.booking_step_1 === liveTotals.booking_step_1 ? '✅' : '⚠️'}`);
    console.log(`Booking Step 2:      ${String(cachedConv.booking_step_2 || 0).padStart(10)}    ${String(liveTotals.booking_step_2).padStart(10)}`);
    console.log(`Booking Step 3:      ${String(cachedConv.booking_step_3 || 0).padStart(10)}    ${String(liveTotals.booking_step_3).padStart(10)}`);
    console.log(`Reservations:        ${String(cachedConv.reservations || 0).padStart(10)}    ${String(liveTotals.reservations).padStart(10)}`);
    console.log(`Reservation Value:   ${fmt(cachedConv.reservation_value).padStart(10)}    ${fmt(liveTotals.reservation_value).padStart(10)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

main();


