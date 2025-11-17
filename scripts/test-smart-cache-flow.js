#!/usr/bin/env node

/**
 * Test the exact flow of smart-cache-helper to find the issue
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSmartCacheFlow() {
  console.log('🧪 TESTING SMART CACHE FLOW');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Get client
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .limit(1);
    
    const client = clients[0];
    console.log(`✅ Client: ${client.name}\n`);
    
    // Simulate what smart-cache-helper does
    const { fetchFreshCurrentMonthData } = require('../src/lib/smart-cache-helper.ts');
    
    console.log('📋 Calling fetchFreshCurrentMonthData...');
    console.log('   (This is what the dashboard calls)\n');
    
    const result = await fetchFreshCurrentMonthData(client);
    
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RESULT');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Campaigns: ${result.campaigns?.length || 0}`);
    console.log(`Total Spend: ${result.stats?.totalSpend || 0}`);
    console.log(`Total Clicks: ${result.stats?.totalClicks || 0}`);
    console.log(`Conversion Metrics:`, result.conversionMetrics);
    console.log('');
    
    if (result.campaigns && result.campaigns.length > 0) {
      console.log('✅ SUCCESS! Got campaigns with data');
      console.log('\nFirst campaign:');
      console.log(JSON.stringify(result.campaigns[0], null, 2));
    } else {
      console.log('❌ FAILED! No campaigns returned');
      console.log('\nThis means the issue is in:');
      console.log('- getCampaignInsights() call');
      console.log('- enhanceCampaignsWithConversions() parsing');
      console.log('- Or campaignsForCache construction');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testSmartCacheFlow();


