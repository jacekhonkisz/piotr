#!/usr/bin/env node
/**
 * Debug script to see what Meta action types Havet actually sends
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugHavetActions() {
  console.log('\n🔍 Debugging Havet Meta Action Types...\n');
  
  // Find Havet client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token')
    .ilike('name', '%havet%')
    .single();
  
  if (clientError || !clients) {
    console.error('❌ Havet client not found:', clientError);
    return;
  }
  
  console.log(`✅ Found client: ${clients.name} (${clients.id})`);
  console.log(`   Ad Account ID: ${clients.ad_account_id}`);
  console.log(`   Has Meta Token: ${!!clients.meta_access_token}\n`);
  
  // Check campaign_summaries for Havet
  const { data: summaries, error: summaryError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clients.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .order('summary_date', { ascending: false })
    .limit(3);
    
  if (summaryError) {
    console.error('❌ Error fetching summaries:', summaryError);
    return;
  }
  
  console.log(`📊 Found ${summaries?.length || 0} monthly summaries:\n`);
  
  summaries?.forEach((s, i) => {
    console.log(`--- ${s.summary_date} ---`);
    console.log(`  Spend: ${s.total_spend?.toFixed(2)} zł`);
    console.log(`  Impressions: ${s.total_impressions}`);
    console.log(`  Clicks: ${s.total_clicks}`);
    console.log(`  Booking Step 1: ${s.booking_step_1}`);
    console.log(`  Booking Step 2: ${s.booking_step_2}`);
    console.log(`  Booking Step 3: ${s.booking_step_3}`);
    console.log(`  Reservations: ${s.reservations}`);
    console.log(`  Reservation Value: ${s.reservation_value?.toFixed(2)} zł`);
    
    // Check if campaign_data exists and has actions
    if (s.campaign_data) {
      const campaigns = Array.isArray(s.campaign_data) ? s.campaign_data : [];
      console.log(`  Campaigns: ${campaigns.length}`);
      
      // Look at first campaign's raw actions
      if (campaigns.length > 0 && campaigns[0].actions) {
        console.log(`\n  📋 First campaign raw action types:`);
        const actionTypes = campaigns[0].actions.map((a: any) => a.action_type);
        actionTypes.forEach((at: string) => console.log(`     - ${at}`));
      }
    }
    console.log();
  });
  
  // Also check current_month_cache
  const { data: cache, error: cacheError } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clients.id)
    .single();
    
  if (cache?.cache_data) {
    console.log('\n📦 Current Month Cache:');
    const cacheData = cache.cache_data as any;
    console.log(`  Period: ${cache.period_id}`);
    console.log(`  Total Spend: ${cacheData?.stats?.totalSpend?.toFixed(2) || 0} zł`);
    console.log(`  Campaigns: ${cacheData?.campaigns?.length || 0}`);
    
    // Look for actions in cached campaigns
    const campaigns = cacheData?.campaigns || [];
    if (campaigns.length > 0) {
      console.log(`\n  📋 First cached campaign conversion metrics:`);
      const c = campaigns[0];
      console.log(`     Name: ${c.campaign_name || c.name}`);
      console.log(`     booking_step_1: ${c.booking_step_1}`);
      console.log(`     booking_step_2: ${c.booking_step_2}`);
      console.log(`     booking_step_3: ${c.booking_step_3}`);
      console.log(`     reservations: ${c.reservations}`);
      console.log(`     reservation_value: ${c.reservation_value}`);
      
      if (c.actions) {
        console.log(`\n  📋 Raw action_types in cached campaign:`);
        c.actions.forEach((a: any) => {
          console.log(`     - ${a.action_type}: ${a.value}`);
        });
      }
    }
  }
}

debugHavetActions().catch(console.error);
