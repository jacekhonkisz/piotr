#!/usr/bin/env node

/**
 * Debug the actual structure of Belmonte's cache data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugCache() {
  console.log('🔍 DEBUGGING BELMONTE CACHE STRUCTURE\n');
  
  // Get Belmonte client
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  const clientId = clients[0].id;
  console.log(`Client: ${clients[0].name} (${clientId})\n`);
  
  // Get current month
  const now = new Date();
  const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Get cache entry
  const { data: cache, error } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .single();
  
  if (error) {
    console.log('❌ No cache found:', error.message);
    return;
  }
  
  console.log('📦 CACHE RECORD STRUCTURE:');
  console.log('─────────────────────────────');
  console.log('Top-level keys:', Object.keys(cache));
  
  console.log('\n📊 CACHE.DATA STRUCTURE:');
  console.log('─────────────────────────────');
  
  const data = cache.data;
  if (data) {
    console.log('data keys:', Object.keys(data));
    
    if (data.stats) {
      console.log('\n📈 data.stats:', JSON.stringify(data.stats, null, 2));
    }
    
    if (data.conversionMetrics) {
      console.log('\n🎯 data.conversionMetrics:', JSON.stringify(data.conversionMetrics, null, 2));
    }
    
    if (data.campaigns) {
      console.log('\n📋 data.campaigns count:', data.campaigns.length);
      if (data.campaigns.length > 0) {
        console.log('First campaign:', JSON.stringify(data.campaigns[0], null, 2));
      }
    }
    
    if (data.dateRange) {
      console.log('\n📅 data.dateRange:', data.dateRange);
    }
  } else {
    console.log('⚠️ cache.data is empty or undefined');
  }
  
  // Check all top-level properties
  console.log('\n📦 ALL CACHE PROPERTIES:');
  console.log('─────────────────────────────');
  for (const key of Object.keys(cache)) {
    const val = cache[key];
    if (typeof val === 'object' && val !== null) {
      console.log(`${key}: [object with ${Object.keys(val).length} keys]`);
    } else {
      console.log(`${key}: ${val}`);
    }
  }
  
  // Check if the entire record has the data directly
  console.log('\n📊 DIRECT CACHE PROPERTIES (not nested):');
  console.log('─────────────────────────────');
  console.log('campaigns:', cache.campaigns?.length || 'N/A');
  console.log('totalSpend:', cache.totalSpend || cache.total_spend || 'N/A');
  console.log('stats:', cache.stats ? JSON.stringify(cache.stats, null, 2) : 'N/A');
}

debugCache();


