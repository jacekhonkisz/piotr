#!/usr/bin/env node
/**
 * Quick fix: Update May 2025 for Havet immediately
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized.js';
import { parseMetaActions } from '../src/lib/meta-actions-parser.js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateHavetMay() {
  console.log('🎯 Quick fix: Updating Havet May 2025...');
  console.log('');

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%')
    .single();

  if (!client) {
    console.error('❌ Havet not found');
    return;
  }

  const token = client.system_user_token || client.meta_access_token;
  const adAccountId = client.ad_account_id.replace('act_', '');
  const metaService = new MetaAPIServiceOptimized(token);

  // Get May 2025 monthly record
  const { data: mayRecord } = await supabase
    .from('campaign_summaries')
    .select('id')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_date', '2025-05-01')
    .eq('summary_type', 'monthly')
    .single();

  if (!mayRecord) {
    console.error('❌ May 2025 record not found');
    return;
  }

  console.log('📊 Fetching May 2025 data from Meta API...');
  
  const campaigns = await metaService.getCampaignInsights(
    adAccountId,
    '2025-05-01',
    '2025-05-31'
  );

  if (!campaigns || campaigns.length === 0) {
    console.error('❌ No campaigns found');
    return;
  }

  console.log(`✅ Fetched ${campaigns.length} campaigns`);
  console.log('');

  // Calculate totals using inline_link_clicks
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalLinkClicks = 0;
  let totalConversions = 0;

  const campaignData = campaigns.map(campaign => {
    const spend = parseFloat(campaign.spend || '0');
    const impressions = parseInt(campaign.impressions || '0');
    const linkClicks = parseInt(campaign.inline_link_clicks || campaign.clicks || '0');
    const conversions = parseInt(campaign.conversions || '0');

    totalSpend += spend;
    totalImpressions += impressions;
    totalLinkClicks += linkClicks;
    totalConversions += conversions;

    const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
    const cpc = linkClicks > 0 ? spend / linkClicks : 0;

    const funnelMetrics = parseMetaActions(campaign.actions, campaign.action_values);

    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      status: campaign.status || 'ACTIVE',
      spend,
      impressions,
      clicks: linkClicks,
      conversions,
      ctr,
      cpc,
      ...funnelMetrics
    };
  });

  const avgCtr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;

  const totalFunnelMetrics = campaignData.reduce((acc, c) => ({
    click_to_call: acc.click_to_call + (c.click_to_call || 0),
    email_contacts: acc.email_contacts + (c.email_contacts || 0),
    booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
    booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
    booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
    reservations: acc.reservations + (c.reservations || 0),
    reservation_value: acc.reservation_value + (c.reservation_value || 0)
  }), {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0
  });

  console.log('📊 Calculated values (with link clicks):');
  console.log('   Total Link Clicks:', totalLinkClicks);
  console.log('   Average CTR:', avgCtr.toFixed(2) + '%');
  console.log('   Average CPC:', avgCpc.toFixed(2), 'zł');
  console.log('');

  // Update database
  const { error } = await supabase
    .from('campaign_summaries')
    .update({
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_clicks: totalLinkClicks,
      total_conversions: totalConversions || 0,
      average_ctr: avgCtr,
      average_cpc: avgCpc,
      campaign_data: campaignData,
      ...totalFunnelMetrics,
      last_updated: new Date().toISOString()
    })
    .eq('id', mayRecord.id);

  if (error) {
    console.error('❌ Update failed:', error.message);
  } else {
    console.log('✅ May 2025 updated successfully!');
    console.log('');
    console.log('🎯 Now refresh your browser to see correct values!');
  }
}

updateHavetMay()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

