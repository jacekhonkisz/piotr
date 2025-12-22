#!/usr/bin/env node

/**
 * Compare a specific campaign between cache and live
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function compare() {
  console.log('🔍 COMPARING SPECIFIC CAMPAIGN: Cache vs Live\n');
  
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const client = clients[0];
  const accessToken = client.system_user_token || client.meta_access_token;
  
  const now = new Date();
  const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = now.toISOString().split('T')[0];
  
  // Get cache
  const { data: cache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();
  
  const cachedCampaigns = cache.cache_data.campaigns;
  
  // Fetch live with FULL actions array
  console.log('📡 Fetching LIVE data with full actions array...\n');
  
  const processedAdAccountId = client.ad_account_id.replace('act_', '');
  const fields = 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values';
  
  const url = `${META_API_BASE}/act_${processedAdAccountId}/insights?` +
    `level=campaign` +
    `&time_range={"since":"${startDate}","until":"${endDate}"}` +
    `&fields=${fields}` +
    `&access_token=${accessToken}`;
  
  const response = await fetch(url);
  const data = await response.json();
  const liveCampaigns = data.data || [];
  
  // Compare specific campaign (Advantage+)
  const targetId = '120202137235700116';
  
  const cachedCamp = cachedCampaigns.find(c => c.campaign_id === targetId);
  const liveCamp = liveCampaigns.find(c => c.campaign_id === targetId);
  
  console.log(`📋 CAMPAIGN: ${cachedCamp?.campaign_name || liveCamp?.campaign_name}\n`);
  
  console.log('CACHED DATA:');
  console.log('─────────────────────────────');
  if (cachedCamp) {
    console.log(`   spend: ${cachedCamp.spend}`);
    console.log(`   impressions: ${cachedCamp.impressions}`);
    console.log(`   clicks: ${cachedCamp.clicks}`);
    console.log(`   booking_step_1: ${cachedCamp.booking_step_1}`);
    console.log(`   booking_step_2: ${cachedCamp.booking_step_2}`);
    console.log(`   booking_step_3: ${cachedCamp.booking_step_3}`);
    console.log(`   reservations: ${cachedCamp.reservations}`);
    console.log(`   reservation_value: ${cachedCamp.reservation_value}`);
  }
  
  console.log('\nLIVE DATA (with actions array):');
  console.log('─────────────────────────────');
  if (liveCamp) {
    console.log(`   spend: ${liveCamp.spend}`);
    console.log(`   impressions: ${liveCamp.impressions}`);
    console.log(`   clicks: ${liveCamp.clicks}`);
    
    // Parse actions
    const actions = liveCamp.actions || [];
    const actionValues = liveCamp.action_values || [];
    
    // Show all action types for this campaign
    console.log(`\n   All actions (${actions.length} types):`);
    actions.forEach(a => {
      console.log(`     - ${a.action_type}: ${a.value}`);
    });
    
    console.log(`\n   All action_values (${actionValues.length} types):`);
    actionValues.forEach(a => {
      console.log(`     - ${a.action_type}: ${a.value}`);
    });
    
    // Parse with same logic as cache
    let metrics = {
      booking_step_1: 0, booking_step_2: 0, booking_step_3: 0,
      reservations: 0, reservation_value: 0
    };
    
    actions.forEach((action) => {
      const actionType = String(action.action_type || '').toLowerCase();
      const value = parseInt(action.value || '0', 10);
      
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
    
    console.log(`\n   Parsed metrics:`);
    console.log(`     booking_step_1: ${metrics.booking_step_1}`);
    console.log(`     booking_step_2: ${metrics.booking_step_2}`);
    console.log(`     booking_step_3: ${metrics.booking_step_3}`);
    console.log(`     reservations: ${metrics.reservations}`);
    console.log(`     reservation_value: ${metrics.reservation_value}`);
  }
  
  // Compare
  console.log('\n═══════════════════════════════════════════════════');
  console.log('COMPARISON:');
  console.log('═══════════════════════════════════════════════════');
  if (cachedCamp && liveCamp) {
    console.log(`booking_step_1: cached=${cachedCamp.booking_step_1} | live=? | diff=?`);
    console.log(`booking_step_2: cached=${cachedCamp.booking_step_2} | live=? | diff=?`);
    console.log(`booking_step_3: cached=${cachedCamp.booking_step_3} | live=? | diff=?`);
    console.log(`reservations: cached=${cachedCamp.reservations} | live=? | diff=?`);
    console.log(`reservation_value: cached=${cachedCamp.reservation_value} | live=? | diff=?`);
  }
}

compare();


