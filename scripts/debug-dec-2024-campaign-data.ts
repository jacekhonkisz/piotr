#!/usr/bin/env node
/**
 * Debug December 2024 campaign_data JSON
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDec2024() {
  console.log('\n🔍 Debugging December 2024 campaign_data for Havet...\n');
  
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) return;
  
  const { data: summary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2024-12-01')
    .single();
    
  if (!summary) {
    console.log('❌ No summary found for Dec 2024');
    return;
  }
  
  console.log('📊 December 2024 Summary:');
  console.log(`   total_spend: ${summary.total_spend}`);
  console.log(`   booking_step_1: ${summary.booking_step_1}`);
  console.log(`   booking_step_2: ${summary.booking_step_2}`);
  console.log(`   booking_step_3: ${summary.booking_step_3}`);
  console.log(`   reservations: ${summary.reservations}`);
  console.log(`   reservation_value: ${summary.reservation_value}`);
  console.log(`   data_source: ${summary.data_source}`);
  console.log(`   last_updated: ${summary.last_updated}`);
  
  // Check campaign_data JSON
  const campaignData = summary.campaign_data;
  if (Array.isArray(campaignData) && campaignData.length > 0) {
    console.log(`\n📋 campaign_data has ${campaignData.length} campaigns`);
    
    // Check first campaign
    const c = campaignData[0];
    console.log(`\n   First campaign: ${c.campaign_name || c.name}`);
    console.log(`     booking_step_1: ${c.booking_step_1}`);
    console.log(`     booking_step_2: ${c.booking_step_2}`);
    console.log(`     booking_step_3: ${c.booking_step_3}`);
    console.log(`     reservations: ${c.reservations}`);
    console.log(`     reservation_value: ${c.reservation_value}`);
    
    // Look for raw actions
    if (c.actions) {
      console.log(`\n   Raw actions (${c.actions.length} total):`);
      c.actions.forEach((a: any) => {
        if (a.action_type.includes('purchase') || 
            a.action_type.includes('checkout') || 
            a.action_type.includes('view_content') ||
            a.action_type.includes('search')) {
          console.log(`     - ${a.action_type}: ${a.value}`);
        }
      });
    } else {
      console.log(`\n   ⚠️ No raw actions stored in campaign_data`);
    }
    
    // Aggregate from campaigns
    let totalB1 = 0, totalB2 = 0, totalB3 = 0, totalRes = 0, totalResValue = 0;
    campaignData.forEach((c: any) => {
      totalB1 += c.booking_step_1 || 0;
      totalB2 += c.booking_step_2 || 0;
      totalB3 += c.booking_step_3 || 0;
      totalRes += c.reservations || 0;
      totalResValue += c.reservation_value || 0;
    });
    
    console.log('\n📊 Aggregated from campaign_data JSON:');
    console.log(`   SUM booking_step_1: ${totalB1}`);
    console.log(`   SUM booking_step_2: ${totalB2}`);
    console.log(`   SUM booking_step_3: ${totalB3}`);
    console.log(`   SUM reservations: ${totalRes}`);
    console.log(`   SUM reservation_value: ${totalResValue}`);
    
  } else {
    console.log(`\n⚠️ No campaign_data stored`);
  }
}

debugDec2024().catch(console.error);
