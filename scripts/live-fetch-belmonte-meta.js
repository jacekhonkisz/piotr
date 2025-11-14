#!/usr/bin/env node

/**
 * Live fetch Belmonte Meta data to test if API is working
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function liveFetchBelmonteMetaData() {
  console.log('🔴 LIVE FETCH - BELMONTE META ADS DATA');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Get Belmonte client
    console.log('📋 Step 1: Getting Belmonte client...');
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .limit(1);
    
    if (!clients || clients.length === 0) {
      console.error('❌ Belmonte client not found');
      return;
    }
    
    const client = clients[0];
    console.log(`✅ Client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   Has Meta Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
    console.log(`   Token Length: ${client.meta_access_token?.length || 0} chars`);
    console.log('');
    
    if (!client.meta_access_token) {
      console.error('❌ No Meta access token found!');
      return;
    }
    
    if (!client.ad_account_id) {
      console.error('❌ No ad account ID found!');
      return;
    }
    
    // Step 2: Calculate date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('📋 Step 2: Date range...');
    console.log(`   Start: ${startDate}`);
    console.log(`   End: ${endDate}`);
    console.log('');
    
    // Step 3: Call Meta API directly
    console.log('📋 Step 3: Calling Meta API...');
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id 
      : `act_${client.ad_account_id}`;
    
    const fields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'conversions',
      'actions',
      'action_values',
      'date_start',
      'date_stop'
    ].join(',');
    
    const params = new URLSearchParams({
      access_token: client.meta_access_token,
      fields: fields,
      time_range: JSON.stringify({
        since: startDate,
        until: endDate,
      }),
      level: 'campaign',
      limit: '100',
    });
    
    const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?${params.toString()}`;
    
    console.log(`   URL: https://graph.facebook.com/v18.0/${adAccountId}/insights`);
    console.log(`   Level: campaign`);
    console.log(`   Date Range: ${startDate} to ${endDate}`);
    console.log('   ⏳ Fetching...\n');
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Step 4: Check response
    console.log('📋 Step 4: Checking response...\n');
    
    if (!response.ok) {
      console.error('❌ Meta API Error!');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      if (data.error) {
        console.error(`   Error Code: ${data.error.code}`);
        console.error(`   Error Type: ${data.error.type}`);
        console.error(`   Error Message: ${data.error.message}`);
        
        if (data.error.message.includes('expired') || data.error.message.includes('Session')) {
          console.error('\n🔑 TOKEN EXPIRED!');
          console.error('   The Meta access token needs to be refreshed.');
          console.error('   Go to Meta Business Suite → Settings → Business Tools → System Users');
          console.error('   Generate a new token and update in database.');
        }
      }
      return;
    }
    
    console.log('✅ API Response OK!\n');
    
    const campaigns = data.data || [];
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RESULTS');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total Campaigns: ${campaigns.length}\n`);
    
    if (campaigns.length === 0) {
      console.log('⚠️  No campaigns returned!');
      console.log('   Possible reasons:');
      console.log('   - No active campaigns in November');
      console.log('   - No campaigns with spend in date range');
      console.log('   - Ad account ID incorrect');
      console.log('');
      
      // Check if we have paging
      if (data.paging) {
        console.log('📄 Paging info found:', JSON.stringify(data.paging, null, 2));
      }
      
      return;
    }
    
    // Calculate totals
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    
    campaigns.forEach(campaign => {
      totalSpend += parseFloat(campaign.spend || '0');
      totalImpressions += parseInt(campaign.impressions || '0');
      totalClicks += parseInt(campaign.clicks || '0');
    });
    
    console.log('Aggregated Metrics:');
    console.log(`  Total Spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`  Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`  Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log('');
    
    // Show first 3 campaigns
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 SAMPLE CAMPAIGNS (First 3)');
    console.log('═══════════════════════════════════════════════════\n');
    
    campaigns.slice(0, 3).forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.campaign_name || 'Unknown'}`);
      console.log(`   ID: ${campaign.campaign_id}`);
      console.log(`   Spend: ${parseFloat(campaign.spend || '0').toFixed(2)} PLN`);
      console.log(`   Impressions: ${parseInt(campaign.impressions || '0').toLocaleString()}`);
      console.log(`   Clicks: ${parseInt(campaign.clicks || '0').toLocaleString()}`);
      console.log(`   Has actions: ${campaign.actions ? 'Yes (' + campaign.actions.length + ' actions)' : 'No'}`);
      
      // Show first few actions
      if (campaign.actions && campaign.actions.length > 0) {
        console.log(`   Sample actions:`);
        campaign.actions.slice(0, 5).forEach(action => {
          console.log(`     - ${action.action_type}: ${action.value}`);
        });
      }
      console.log('');
    });
    
    // Check for conversion data
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 CONVERSION DATA CHECK');
    console.log('═══════════════════════════════════════════════════\n');
    
    const campaignsWithActions = campaigns.filter(c => c.actions && c.actions.length > 0);
    console.log(`Campaigns with actions array: ${campaignsWithActions.length} of ${campaigns.length}`);
    
    if (campaignsWithActions.length > 0) {
      // Count action types
      const actionTypes = {};
      campaignsWithActions.forEach(campaign => {
        campaign.actions.forEach(action => {
          const type = action.action_type;
          if (!actionTypes[type]) {
            actionTypes[type] = 0;
          }
          actionTypes[type] += parseInt(action.value || '0');
        });
      });
      
      console.log('\nAll action types found:');
      Object.entries(actionTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  - ${type}: ${count}`);
        });
      
      // Check for our funnel actions
      console.log('\n🎯 Funnel Actions:');
      const searchActions = Object.keys(actionTypes).filter(k => k.includes('search'));
      const viewContentActions = Object.keys(actionTypes).filter(k => k.includes('view_content'));
      const checkoutActions = Object.keys(actionTypes).filter(k => k.includes('initiate_checkout'));
      const purchaseActions = Object.keys(actionTypes).filter(k => k.includes('purchase'));
      
      console.log(`  Search actions: ${searchActions.length > 0 ? '✅ ' + searchActions.join(', ') : '❌ None'}`);
      console.log(`  View Content actions: ${viewContentActions.length > 0 ? '✅ ' + viewContentActions.join(', ') : '❌ None'}`);
      console.log(`  Initiate Checkout actions: ${checkoutActions.length > 0 ? '✅ ' + checkoutActions.join(', ') : '❌ None'}`);
      console.log(`  Purchase actions: ${purchaseActions.length > 0 ? '✅ ' + purchaseActions.join(', ') : '❌ None'}`);
    } else {
      console.log('⚠️  No campaigns have actions array!');
      console.log('   This means either:');
      console.log('   - Meta Pixel not configured');
      console.log('   - No conversions tracked');
      console.log('   - Conversion tracking not set up');
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ LIVE FETCH COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
    if (campaigns.length > 0) {
      console.log('🎉 SUCCESS! Meta API is working and returning campaigns.');
      console.log('   The issue with empty cache might be:');
      console.log('   - Error in smart-cache-helper processing');
      console.log('   - Issue with parser integration');
      console.log('   - Cache save failed');
      console.log('');
      console.log('💡 Next step: Check server logs when dashboard loads');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

liveFetchBelmonteMetaData();

