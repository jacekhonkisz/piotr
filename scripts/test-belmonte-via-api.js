#!/usr/bin/env node

/**
 * Test Belmonte data via API endpoint
 * This will trigger the fixed smart-cache-helper through the API
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBelmonteViaAPI() {
  console.log('🎯 TESTING BELMONTE DATA VIA API');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Get Belmonte client
    console.log('📋 Step 1: Finding Belmonte client...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .limit(1);
    
    if (clientError) throw clientError;
    if (!clients || clients.length === 0) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }
    
    const client = clients[0];
    console.log(`✅ Found: ${client.name}`);
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id}\n`);
    
    // Step 2: Clear cache first
    console.log('📋 Step 2: Clearing current month cache...');
    const currentPeriod = new Date().toISOString().substring(0, 7);
    
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod);
    
    if (deleteError) {
      console.warn('⚠️  Error clearing cache:', deleteError.message);
    } else {
      console.log('✅ Cache cleared\n');
    }
    
    // Step 3: Call API to trigger fresh fetch
    console.log('📋 Step 3: Triggering fresh data fetch via API...');
    console.log('   (This will use the fixed smart-cache-helper code)');
    console.log('   ⏳ Please wait 10-20 seconds...\n');
    
    // We'll call the fetch-live-data API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const dateRange = {
      start: `${currentPeriod}-01`,
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
        .toISOString().split('T')[0]
    };
    
    // Get a session token for authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      console.log('⚠️  No auth session available, trying direct database approach...\n');
      
      // Alternative: Check what's in cache after a minute
      console.log('📋 Alternative: Checking if dashboard already triggered a fetch...');
      console.log('   (If you just loaded the dashboard, data should be there)\n');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } else {
      console.log('✅ Auth session available, calling API...\n');
      
      try {
        const response = await fetch(`${apiUrl}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange,
            platform: 'meta',
            forceFresh: true,
            reason: 'test-real-data-fix'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ API call successful!\n');
        } else {
          console.warn('⚠️  API returned error:', response.status, response.statusText);
        }
      } catch (fetchError) {
        console.warn('⚠️  API call failed:', fetchError.message);
        console.log('   Will check cache directly instead...\n');
      }
    }
    
    // Step 4: Check the cache to see what was fetched
    console.log('📋 Step 4: Checking cache for results...\n');
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod)
      .single();
    
    if (cacheError || !cachedData) {
      console.error('❌ No cache data found!');
      console.error('   Possible reasons:');
      console.error('   - Data fetch failed (check server logs)');
      console.error('   - Meta API error (token expired?)');
      console.error('   - No campaigns in current month');
      console.error('\n   Try loading the dashboard manually and check logs.');
      return;
    }
    
    console.log('✅ Cache data found!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('CACHE ANALYSIS');
    console.log('═══════════════════════════════════════════════════');
    
    const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
    console.log(`Cache Age: ${Math.floor(cacheAge / 1000)} seconds ago`);
    console.log(`Last Updated: ${cachedData.last_updated}\n`);
    
    const data = cachedData.cache_data;
    const campaigns = data?.campaigns || [];
    const stats = data?.stats || {};
    const conv = data?.conversionMetrics || {};
    
    console.log('Main Metrics:');
    console.log(`  Total Spend: ${stats.totalSpend?.toFixed(2) || 0} PLN`);
    console.log(`  Total Clicks: ${stats.totalClicks || 0}`);
    console.log(`  Total Impressions: ${stats.totalImpressions || 0}\n`);
    
    console.log(`Total Campaigns: ${campaigns.length}\n`);
    
    if (campaigns.length === 0) {
      console.log('⚠️  WARNING: Cache has 0 campaigns!');
      console.log('   This could mean:');
      console.log('   - Meta API error during fetch');
      console.log('   - No active campaigns in November');
      console.log('   - Token expired (check server logs)');
      return;
    }
    
    // Analyze distribution
    console.log('═══════════════════════════════════════════════════');
    console.log('PER-CAMPAIGN DATA ANALYSIS');
    console.log('═══════════════════════════════════════════════════\n');
    
    const step1Values = campaigns
      .map(c => c.booking_step_1 || 0)
      .filter(v => v > 0);
    
    const uniqueValues = [...new Set(step1Values)].length;
    
    console.log(`Campaigns with booking_step_1 > 0: ${step1Values.length}`);
    console.log(`Unique booking_step_1 values: ${uniqueValues}\n`);
    
    if (step1Values.length === 0) {
      console.log('ℹ️  All campaigns have booking_step_1 = 0');
      console.log('   Could be:');
      console.log('   - No conversions yet this month');
      console.log('   - Tracking not set up');
      console.log('   - Data still using estimates (all zeros)');
    } else if (uniqueValues === 1) {
      console.log('❌ ALL CAMPAIGNS HAVE IDENTICAL VALUES!');
      console.log(`   All have booking_step_1 = ${step1Values[0]}`);
      console.log('\n🚨 STATUS: Data is DISTRIBUTED (fix not working)');
    } else {
      console.log('✅ CAMPAIGNS HAVE DIFFERENT VALUES!');
      console.log(`   Range: ${Math.min(...step1Values)} to ${Math.max(...step1Values)}`);
      console.log(`   Standard deviation: ${calculateStdDev(step1Values).toFixed(2)}`);
      console.log('\n🎉 STATUS: Using REAL per-campaign data (fix working!)');
    }
    
    // Show sample campaigns
    console.log('\n═══════════════════════════════════════════════════');
    console.log('SAMPLE CAMPAIGNS (First 5)');
    console.log('═══════════════════════════════════════════════════\n');
    
    campaigns.slice(0, 5).forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.campaign_name || 'Unknown'}`);
      console.log(`   Spend: ${(campaign.spend || 0).toFixed(2)} PLN`);
      console.log(`   Clicks: ${campaign.clicks || 0}`);
      console.log(`   Booking Step 1: ${campaign.booking_step_1 || 0}`);
      console.log(`   Booking Step 2: ${campaign.booking_step_2 || 0}`);
      console.log(`   Reservations: ${campaign.reservations || 0}`);
      console.log('');
    });
    
    // Distribution check
    if (campaigns.length > 1 && conv.booking_step_1 > 0) {
      console.log('═══════════════════════════════════════════════════');
      console.log('DISTRIBUTION VERIFICATION');
      console.log('═══════════════════════════════════════════════════');
      
      const expectedDistributed = Math.round(conv.booking_step_1 / campaigns.length);
      const firstCampaignValue = campaigns[0].booking_step_1 || 0;
      
      console.log(`\nTotal booking_step_1: ${conv.booking_step_1}`);
      console.log(`Campaign count: ${campaigns.length}`);
      console.log(`If distributed: ${conv.booking_step_1} / ${campaigns.length} = ${expectedDistributed} each`);
      console.log(`First campaign actual: ${firstCampaignValue}\n`);
      
      if (Math.abs(firstCampaignValue - expectedDistributed) < 1) {
        console.log('❌ MATCH! First campaign = distributed average');
        console.log('   This means data is being DISTRIBUTED');
        console.log('   Fix is NOT working properly\n');
      } else {
        console.log('✅ NO MATCH! First campaign ≠ distributed average');
        console.log('   This means data is REAL per-campaign values');
        console.log('   Fix IS working!\n');
      }
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

// Run
testBelmonteViaAPI()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

