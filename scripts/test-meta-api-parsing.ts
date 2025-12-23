#!/usr/bin/env node
/**
 * Test script to check what Meta API returns and how it's parsed
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { enhanceCampaignsWithConversions, aggregateConversionMetrics } from '../src/lib/meta-actions-parser';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMetaAPIParsing() {
  console.log('\n🧪 TESTING META API PARSING\n');
  console.log('='.repeat(60));
  
  // Get Havet client
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token')
    .ilike('name', '%havet%')
    .single();
    
  if (!client) {
    console.error('❌ Havet not found');
    return;
  }
  
  console.log(`✅ Client: ${client.name}`);
  console.log(`   Ad Account: ${client.ad_account_id}`);
  
  // Use system_user_token if available, otherwise meta_access_token
  const metaToken = client.system_user_token || client.meta_access_token;
  if (!metaToken) {
    console.error('❌ No Meta token available');
    return;
  }
  
  const metaService = new MetaAPIServiceOptimized(metaToken);
  
  // Test with a recent period (December 2025)
  const startDate = '2025-12-01';
  const endDate = '2025-12-23';
  
  console.log(`\n📡 Fetching from Meta API: ${startDate} to ${endDate}`);
  
  const adAccountId = client.ad_account_id!.startsWith('act_') 
    ? client.ad_account_id!.substring(4)
    : client.ad_account_id!;
    
  try {
    // Fetch raw campaign insights
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      startDate,
      endDate,
      0  // timeIncrement = 0 for period totals
    );
    
    console.log(`\n✅ Received ${rawCampaignInsights.length} campaigns from Meta API`);
    
    if (rawCampaignInsights.length === 0) {
      console.log('⚠️ No campaigns returned');
      return;
    }
    
    // Check first campaign's raw actions
    const firstCampaign = rawCampaignInsights[0];
    console.log(`\n📋 First Campaign: ${firstCampaign.campaign_name || firstCampaign.name}`);
    console.log(`   Has actions array: ${!!firstCampaign.actions}`);
    console.log(`   Has action_values array: ${!!firstCampaign.action_values}`);
    
    if (firstCampaign.actions && Array.isArray(firstCampaign.actions)) {
      console.log(`\n   Actions (${firstCampaign.actions.length} total):`);
      
      // Find the key action types
      const keyActions = ['omni_search', 'omni_view_content', 'omni_initiated_checkout', 'omni_purchase'];
      const foundActions: any[] = [];
      
      firstCampaign.actions.forEach((action: any) => {
        const actionType = String(action.action_type || '').toLowerCase();
        if (keyActions.some(key => actionType.includes(key))) {
          foundActions.push({ type: action.action_type, value: action.value });
        }
      });
      
      if (foundActions.length > 0) {
        console.log(`\n   ✅ Found key funnel actions:`);
        foundActions.forEach(a => {
          console.log(`      - ${a.type}: ${a.value}`);
        });
      } else {
        console.log(`\n   ⚠️ No key funnel actions found!`);
        console.log(`   All action types:`);
        firstCampaign.actions.slice(0, 10).forEach((a: any) => {
          console.log(`      - ${a.action_type}: ${a.value}`);
        });
      }
    } else {
      console.log(`\n   ⚠️ No actions array in campaign data`);
    }
    
    // Now parse using the parser
    console.log(`\n📊 PARSING WITH meta-actions-parser:`);
    
    const enhancedCampaigns = enhanceCampaignsWithConversions(rawCampaignInsights);
    
    console.log(`\n   First campaign after parsing:`);
    const firstEnhanced = enhancedCampaigns[0];
    console.log(`      booking_step_1: ${firstEnhanced.booking_step_1 || 0}`);
    console.log(`      booking_step_2: ${firstEnhanced.booking_step_2 || 0}`);
    console.log(`      booking_step_3: ${firstEnhanced.booking_step_3 || 0}`);
    console.log(`      reservations: ${firstEnhanced.reservations || 0}`);
    console.log(`      reservation_value: ${firstEnhanced.reservation_value || 0}`);
    
    // Aggregate all campaigns
    const aggregated = aggregateConversionMetrics(enhancedCampaigns);
    
    console.log(`\n📊 AGGREGATED TOTALS (all campaigns):`);
    console.log(`      booking_step_1: ${aggregated.booking_step_1}`);
    console.log(`      booking_step_2: ${aggregated.booking_step_2}`);
    console.log(`      booking_step_3: ${aggregated.booking_step_3}`);
    console.log(`      reservations: ${aggregated.reservations}`);
    console.log(`      reservation_value: ${aggregated.reservation_value}`);
    
    // Compare with database
    console.log(`\n📊 COMPARING WITH DATABASE:`);
    
    const { data: dbSummary } = await supabase
      .from('campaign_summaries')
      .select('booking_step_1, booking_step_2, booking_step_3, reservations, reservation_value')
      .eq('client_id', client.id)
      .eq('summary_date', '2025-12-01')
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .single();
      
    if (dbSummary) {
      console.log(`   Database (Dec 2025):`);
      console.log(`      booking_step_1: ${dbSummary.booking_step_1}`);
      console.log(`      booking_step_2: ${dbSummary.booking_step_2}`);
      console.log(`      booking_step_3: ${dbSummary.booking_step_3}`);
      console.log(`      reservations: ${dbSummary.reservations}`);
      console.log(`      reservation_value: ${dbSummary.reservation_value}`);
      
      console.log(`\n   ✅ Match:`);
      console.log(`      step1: ${aggregated.booking_step_1 === dbSummary.booking_step_1 ? '✅' : '❌'}`);
      console.log(`      step2: ${aggregated.booking_step_2 === dbSummary.booking_step_2 ? '✅' : '❌'}`);
      console.log(`      step3: ${aggregated.booking_step_3 === dbSummary.booking_step_3 ? '✅' : '❌'}`);
      console.log(`      reservations: ${aggregated.reservations === dbSummary.reservations ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

testMetaAPIParsing().catch(console.error);

