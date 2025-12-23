#!/usr/bin/env node
/**
 * Audit Havet's Meta conversion actions to understand discrepancies
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditHavetMetaActions() {
  console.log('\n🔍 Auditing Havet Meta Conversion Actions...\n');
  
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
  
  // Check December 2024 summary
  const { data: summary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_date', '2024-12-01')
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .single();
    
  if (!summary) {
    console.error('❌ No December 2024 summary found');
    return;
  }
  
  console.log('📊 DATABASE SUMMARY (December 2024):');
  console.log(`   total_spend: ${summary.total_spend.toFixed(2)} zł`);
  console.log(`   total_impressions: ${summary.total_impressions}`);
  console.log(`   total_clicks: ${summary.total_clicks}`);
  console.log(`   total_conversions: ${summary.total_conversions}`);
  console.log(`   click_to_call: ${summary.click_to_call || 0}`);
  console.log(`   email_contacts: ${summary.email_contacts || 0}`);
  console.log(`   booking_step_1: ${summary.booking_step_1}`);
  console.log(`   booking_step_2: ${summary.booking_step_2}`);
  console.log(`   booking_step_3: ${summary.booking_step_3}`);
  console.log(`   reservations: ${summary.reservations}`);
  console.log(`   reservation_value: ${summary.reservation_value.toFixed(2)} zł`);
  console.log(`   average_ctr: ${summary.average_ctr?.toFixed(4) || 'N/A'}`);
  console.log(`   average_cpc: ${summary.average_cpc?.toFixed(2) || 'N/A'} zł`);
  console.log();
  
  // Check campaign_data for raw actions
  if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
    const campaigns = summary.campaign_data;
    
    console.log(`📋 CAMPAIGN-LEVEL DATA (${campaigns.length} campaigns):\n`);
    
    // Check if any campaign has raw actions stored
    const campaignWithActions = campaigns.find((c: any) => c.actions && c.actions.length > 0);
    
    if (campaignWithActions) {
      console.log('✅ Raw actions found in campaign_data');
      console.log(`\nExample: ${campaignWithActions.campaign_name}`);
      console.log(`Actions (${campaignWithActions.actions.length} total):`);
      
      campaignWithActions.actions.forEach((action: any) => {
        console.log(`  - ${action.action_type}: ${action.value}`);
      });
    } else {
      console.log('⚠️  No raw actions stored in campaign_data');
      console.log('This means we only have the aggregated conversion counts, not the raw Meta action types');
    }
    
    // Aggregate conversion data from campaigns
    console.log('\n📊 AGGREGATED FROM CAMPAIGNS:');
    
    const totals = campaigns.reduce((acc: any, c: any) => {
      return {
        spend: acc.spend + (c.spend || 0),
        impressions: acc.impressions + (c.impressions || 0),
        clicks: acc.clicks + (c.clicks || 0),
        conversions: acc.conversions + (c.conversions || 0),
        click_to_call: acc.click_to_call + (c.click_to_call || 0),
        email_contacts: acc.email_contacts + (c.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
        reservations: acc.reservations + (c.reservations || 0),
        reservation_value: acc.reservation_value + (c.reservation_value || 0),
      };
    }, {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
    });
    
    console.log(`   SUM spend: ${totals.spend.toFixed(2)} zł`);
    console.log(`   SUM impressions: ${totals.impressions}`);
    console.log(`   SUM clicks: ${totals.clicks}`);
    console.log(`   SUM conversions: ${totals.conversions}`);
    console.log(`   SUM click_to_call: ${totals.click_to_call}`);
    console.log(`   SUM email_contacts: ${totals.email_contacts}`);
    console.log(`   SUM booking_step_1: ${totals.booking_step_1}`);
    console.log(`   SUM booking_step_2: ${totals.booking_step_2}`);
    console.log(`   SUM booking_step_3: ${totals.booking_step_3}`);
    console.log(`   SUM reservations: ${totals.reservations}`);
    console.log(`   SUM reservation_value: ${totals.reservation_value.toFixed(2)} zł`);
    
    // Calculate CTR and CPC
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
    const cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
    
    console.log(`   CALCULATED CTR: ${(ctr * 100).toFixed(2)}%`);
    console.log(`   CALCULATED CPC: ${cpc.toFixed(2)} zł`);
    
    console.log('\n🔍 VERIFICATION:');
    console.log(`   Summary total_spend: ${summary.total_spend.toFixed(2)} zł`);
    console.log(`   Campaign SUM spend: ${totals.spend.toFixed(2)} zł`);
    console.log(`   Match: ${Math.abs(summary.total_spend - totals.spend) < 0.01 ? '✅' : '❌'}`);
    
    console.log(`\n   Summary reservation_value: ${summary.reservation_value.toFixed(2)} zł`);
    console.log(`   Campaign SUM reservation_value: ${totals.reservation_value.toFixed(2)} zł`);
    console.log(`   Match: ${Math.abs(summary.reservation_value - totals.reservation_value) < 0.01 ? '✅' : '❌'}`);
  }
  
  console.log('\n\n💡 INSIGHTS:');
  console.log('  - If CTR/CPC show as 0 in your table, campaigns might not have these fields populated');
  console.log('  - CTR should be calculated as: (clicks / impressions) * 100');
  console.log('  - CPC should be calculated as: spend / clicks');
  console.log('  - These should be calculated dynamically, not stored');
}

auditHavetMetaActions().catch(console.error);

