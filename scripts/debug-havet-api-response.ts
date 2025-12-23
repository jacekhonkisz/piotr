#!/usr/bin/env node
/**
 * Debug what the StandardizedDataFetcher returns for Havet
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugHavetAPIResponse() {
  console.log('\n🔍 Debugging Havet API Response Flow...\n');
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) {
    console.error('❌ Havet not found');
    return;
  }
  
  console.log(`✅ Client: ${client.name} (${client.id})\n`);
  
  // Simulate what the reports page does - check current_month_cache
  const { data: cache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .single();
    
  if (!cache?.cache_data) {
    console.log('❌ No cache data');
    return;
  }
  
  const cacheData = cache.cache_data as any;
  
  console.log('📊 What getConversionMetric would see:');
  console.log('\n1️⃣ report.conversionMetrics:');
  console.log('   ', JSON.stringify(cacheData.conversionMetrics || {}, null, 2));
  
  console.log('\n2️⃣ campaigns array (first 3):');
  const campaigns = cacheData.campaigns || [];
  campaigns.slice(0, 3).forEach((c: any, i: number) => {
    console.log(`\n   Campaign ${i+1}: ${c.campaign_name || c.name}`);
    console.log(`     spend: ${c.spend}`);
    console.log(`     booking_step_1: ${c.booking_step_1}`);
    console.log(`     booking_step_2: ${c.booking_step_2}`);
    console.log(`     booking_step_3: ${c.booking_step_3}`);
    console.log(`     reservations: ${c.reservations}`);
    console.log(`     reservation_value: ${c.reservation_value}`);
  });
  
  // Simulate getConversionMetric logic
  console.log('\n\n📊 Simulating getConversionMetric():');
  
  const testMetrics = ['booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations', 'reservation_value'] as const;
  
  testMetrics.forEach(metric => {
    const conversionValue = cacheData.conversionMetrics?.[metric];
    const campaignTotal = campaigns.reduce((sum: number, c: any) => sum + (c[metric] || 0), 0);
    
    let result: number;
    let source: string;
    
    if (conversionValue !== undefined && conversionValue > 0) {
      result = conversionValue;
      source = 'conversionMetrics';
    } else if (campaignTotal > 0) {
      result = campaignTotal;
      source = 'campaigns.reduce()';
    } else {
      result = conversionValue ?? 0;
      source = 'fallback (0)';
    }
    
    console.log(`   ${metric}: ${result} (from ${source})`);
    console.log(`     - conversionMetrics: ${conversionValue}`);
    console.log(`     - campaigns.reduce: ${campaignTotal}`);
  });
}

debugHavetAPIResponse().catch(console.error);
