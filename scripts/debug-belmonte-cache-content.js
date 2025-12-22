#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugCache() {
  console.log('🔍 BELMONTE CACHE CONTENT\n');
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const clientId = clients[0].id;
  const now = new Date();
  const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const { data: cache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .single();
  
  console.log('Last Updated:', cache.last_updated);
  console.log('\n📦 CACHE_DATA STRUCTURE:');
  console.log('─────────────────────────────');
  
  const cacheData = cache.cache_data;
  console.log('Keys:', Object.keys(cacheData));
  
  if (cacheData.stats) {
    console.log('\n📈 STATS:', JSON.stringify(cacheData.stats, null, 2));
  }
  
  if (cacheData.conversionMetrics) {
    console.log('\n🎯 CONVERSION METRICS:', JSON.stringify(cacheData.conversionMetrics, null, 2));
  }
  
  if (cacheData.campaigns) {
    console.log('\n📋 CAMPAIGNS:', cacheData.campaigns.length);
    if (cacheData.campaigns.length > 0) {
      const first = cacheData.campaigns[0];
      console.log('First campaign keys:', Object.keys(first));
      console.log('First campaign:', JSON.stringify(first, null, 2).substring(0, 1000));
    }
  }
  
  if (cacheData.dateRange) {
    console.log('\n📅 DATE RANGE:', cacheData.dateRange);
  }
}

debugCache();


