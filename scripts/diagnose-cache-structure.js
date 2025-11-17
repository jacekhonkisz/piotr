#!/usr/bin/env node

/**
 * Diagnose Cache Structure - What's Actually in the Cache?
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseCacheStructure() {
  console.log('🔍 DIAGNOSING CACHE STRUCTURE');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // Get Belmonte client
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
    console.log(`✅ Client: ${client.name} (${client.id})\n`);
    
    // Get current cache
    const currentPeriod = new Date().toISOString().substring(0, 7);
    const { data: cache, error } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod)
      .single();
    
    if (error || !cache) {
      console.error('❌ No cache found for current month');
      console.error('Error:', error?.message);
      return;
    }
    
    const data = cache.cache_data;
    
    console.log('📦 CACHE METADATA');
    console.log('═══════════════════════════════════════════');
    console.log(`Period: ${cache.period_id}`);
    console.log(`Last Updated: ${cache.last_updated}`);
    console.log(`Age: ${Math.floor((Date.now() - new Date(cache.last_updated).getTime()) / 1000)} seconds\n`);
    
    console.log('🔑 TOP-LEVEL KEYS IN CACHE_DATA');
    console.log('═══════════════════════════════════════════');
    const keys = Object.keys(data || {});
    console.log(`Found ${keys.length} keys:`, keys.join(', '));
    console.log('');
    
    console.log('📊 CAMPAIGNS ANALYSIS');
    console.log('═══════════════════════════════════════════');
    
    if (!data.campaigns) {
      console.log('❌ NO "campaigns" key found in cache_data!');
      console.log('\n🔍 Available data structure:');
      console.log(JSON.stringify(Object.keys(data), null, 2));
      return;
    }
    
    if (!Array.isArray(data.campaigns)) {
      console.log(`❌ campaigns is not an array! Type: ${typeof data.campaigns}`);
      return;
    }
    
    console.log(`✅ campaigns is an array with ${data.campaigns.length} items\n`);
    
    if (data.campaigns.length === 0) {
      console.log('⚠️  campaigns array is EMPTY!');
      console.log('\n🔍 Checking what else is in cache:');
      
      if (data.stats) {
        console.log('\n📊 stats object found:');
        console.log(JSON.stringify(data.stats, null, 2));
      }
      
      if (data.conversionMetrics) {
        console.log('\n📊 conversionMetrics object found:');
        console.log(JSON.stringify(data.conversionMetrics, null, 2));
      }
      
      if (data.totals) {
        console.log('\n📊 totals object found:');
        console.log(JSON.stringify(data.totals, null, 2));
      }
      
      console.log('\n❓ WHY IS campaigns EMPTY?');
      console.log('Possible reasons:');
      console.log('1. getCampaignInsights() returned empty array');
      console.log('2. API error was caught and empty array assigned');
      console.log('3. Data was stored before fix was applied');
      console.log('4. campaignInsights variable was empty when building cache');
      
      return;
    }
    
    // Analyze campaigns structure
    console.log('📋 FIRST CAMPAIGN STRUCTURE:');
    console.log('═══════════════════════════════════════════');
    const firstCampaign = data.campaigns[0];
    console.log(JSON.stringify(firstCampaign, null, 2));
    console.log('');
    
    // Check for funnel metrics
    console.log('🔍 FUNNEL METRICS CHECK:');
    console.log('═══════════════════════════════════════════');
    
    const hasFunnelMetrics = firstCampaign.booking_step_1 !== undefined;
    console.log(`Has booking_step_1: ${hasFunnelMetrics ? '✅' : '❌'}`);
    console.log(`Has booking_step_2: ${firstCampaign.booking_step_2 !== undefined ? '✅' : '❌'}`);
    console.log(`Has reservations: ${firstCampaign.reservations !== undefined ? '✅' : '❌'}`);
    
    if (!hasFunnelMetrics) {
      console.log('\n❌ PROBLEM: Campaigns missing funnel metrics!');
      console.log('This means:');
      console.log('- Cache was created before fix was applied, OR');
      console.log('- enhanceCampaignsWithConversions() was not called, OR');
      console.log('- Parsing failed silently');
      
      console.log('\n💡 SOLUTION: Clear cache and let it refetch with fixed code');
    }
    
    console.log('\n🔢 CAMPAIGN VALUES VARIANCE:');
    console.log('═══════════════════════════════════════════');
    
    const step1Values = data.campaigns
      .map(c => c.booking_step_1 || 0)
      .filter(v => v > 0);
    
    const uniqueValues = [...new Set(step1Values)].length;
    
    console.log(`Campaigns with step1 > 0: ${step1Values.length}`);
    console.log(`Unique step1 values: ${uniqueValues}`);
    
    if (step1Values.length === 0) {
      console.log('Status: ℹ️  All zeros (no conversions or not parsed)');
    } else if (uniqueValues === 1) {
      console.log(`Status: ❌ ALL IDENTICAL (value: ${step1Values[0]})`);
      console.log('❌ This is DISTRIBUTED data (bug!)');
    } else {
      console.log(`Status: ✅ VARIANCE (min: ${Math.min(...step1Values)}, max: ${Math.max(...step1Values)})`);
      console.log('✅ This is REAL per-campaign data!');
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ DIAGNOSIS COMPLETE');
    console.log('═══════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseCacheStructure();


