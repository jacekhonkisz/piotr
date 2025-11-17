#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllBelmonteCache() {
  console.log('🔍 CHECKING ALL BELMONTE CACHE ENTRIES\n');
  
  try {
    // Get Belmonte client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%');
    
    console.log(`Found ${clients?.length || 0} Belmonte clients:`);
    clients?.forEach(c => console.log(`  - ${c.name} (${c.id})`));
    console.log('');
    
    if (!clients || clients.length === 0) return;
    
    const clientId = clients[0].id;
    const currentPeriod = new Date().toISOString().substring(0, 7);
    
    // Check ALL cache entries (not just single)
    console.log(`📅 Looking for period: ${currentPeriod}\n`);
    
    const { data: allCache, error } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId);
    
    console.log(`📦 Total cache entries for Belmonte: ${allCache?.length || 0}\n`);
    
    if (allCache && allCache.length > 0) {
      allCache.forEach((cache, index) => {
        console.log(`Cache Entry #${index + 1}:`);
        console.log(`  Period: ${cache.period_id}`);
        console.log(`  Last Updated: ${cache.last_updated}`);
        console.log(`  Age: ${Math.floor((Date.now() - new Date(cache.last_updated).getTime()) / 1000)}s`);
        console.log(`  Campaigns: ${cache.cache_data?.campaigns?.length || 0}`);
        console.log(`  Has stats: ${!!cache.cache_data?.stats}`);
        console.log(`  Has conversionMetrics: ${!!cache.cache_data?.conversionMetrics}`);
        console.log('');
      });
    } else {
      console.log('❌ NO CACHE ENTRIES FOUND AT ALL!');
      console.log('\nThis means:');
      console.log('  - Cache was deleted successfully earlier');
      console.log('  - Dashboard has not been loaded since deletion');
      console.log('  - OR dashboard load failed to create new cache');
      console.log('\n💡 Action: Load the dashboard to trigger cache creation');
    }
    
    // Check current week cache too
    console.log('\n🔍 Checking current_week_cache:');
    const { data: weekCache } = await supabase
      .from('current_week_cache')
      .select('*')
      .eq('client_id', clientId);
    
    console.log(`  Week cache entries: ${weekCache?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllBelmonteCache();


