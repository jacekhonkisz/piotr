/**
 * Live Fetch: Havet Meta Ads CTR/CPC for January 2026
 * Fetches account-level and campaign-level insights directly from Meta API
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchHavetJanuaryCTRCPC() {
  console.log('📊 LIVE FETCH: Havet Meta Ads CTR/CPC for January 2026\n');
  console.log('='.repeat(70));

  try {
    // 1. Get Havet client
    console.log('1️⃣ Finding Havet client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id')
      .ilike('name', '%havet%')
      .single();

    if (clientError || !client) {
      console.error('❌ Error finding Havet client:', clientError?.message);
      return;
    }

    console.log(`✅ Client found: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Ad Account ID: ${client.ad_account_id || 'NOT SET'}`);
    console.log(`   Has Meta Token: ${client.meta_access_token ? '✅ YES' : '❌ NO'}`);
    console.log(`   Has System Token: ${client.system_user_token ? '✅ YES' : '❌ NO'}`);
    console.log('-'.repeat(70));

    if (!client.ad_account_id) {
      console.error('❌ Ad Account ID not configured for Havet');
      return;
    }

    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      console.error('❌ No Meta token available for Havet');
      return;
    }

    // 2. Initialize Meta API Service
    console.log('\n2️⃣ Initializing Meta API Service...');
    const metaService = new MetaAPIServiceOptimized(metaToken);
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4) 
      : client.ad_account_id;

    console.log(`   Ad Account ID (cleaned): ${adAccountId}`);
    console.log('-'.repeat(70));

    // 3. Date range for January 2026
    const dateStart = '2026-01-01';
    const dateEnd = '2026-01-31';
    
    console.log(`\n3️⃣ Fetching data for: ${dateStart} to ${dateEnd}`);
    console.log('-'.repeat(70));

    // 4. Try to fetch account-level insights first
    console.log('\n4️⃣ Fetching ACCOUNT-LEVEL insights (overall CTR/CPC)...');
    let accountInsights: any = null;
    try {
      accountInsights = await metaService.getAccountInsights(adAccountId, dateStart, dateEnd);
      
      if (accountInsights) {
        console.log('✅ Account-level insights received from API:');
        console.log('   Raw response:', JSON.stringify(accountInsights, null, 2));
        console.log('\n   📊 EXTRACTED VALUES:');
        console.log(`   - Spend: ${accountInsights.spend || 'N/A'}`);
        console.log(`   - Impressions: ${accountInsights.impressions || 'N/A'}`);
        console.log(`   - Clicks: ${accountInsights.clicks || 'N/A'}`);
        console.log(`   - Inline Link Clicks: ${accountInsights.inline_link_clicks || 'N/A'}`);
        console.log(`   - CTR: ${accountInsights.ctr || 'N/A'}`);
        console.log(`   - Inline Link Click CTR: ${accountInsights.inline_link_click_ctr || 'N/A'}%`);
        console.log(`   - CPC: ${accountInsights.cpc || 'N/A'}`);
        console.log(`   - Cost Per Inline Link Click: ${accountInsights.cost_per_inline_link_click || 'N/A'} zł`);
        console.log(`   - CPM: ${accountInsights.cpm || 'N/A'}`);
        console.log(`   - Reach: ${accountInsights.reach || 'N/A'}`);
        console.log(`   - Frequency: ${accountInsights.frequency || 'N/A'}`);
        console.log(`   - Conversions: ${accountInsights.conversions || 'N/A'}`);
      } else {
        console.log('⚠️  Account-level insights not available (API may not support level=account)');
      }
    } catch (accountError: any) {
      console.log('⚠️  Account-level insights fetch failed:', accountError.message);
      console.log('   This is expected if Meta API doesn\'t support account-level insights');
    }

    // 5. Fetch campaign-level insights
    console.log('\n5️⃣ Fetching CAMPAIGN-LEVEL insights...');
    const campaignInsights = await metaService.getCampaignInsights(adAccountId, dateStart, dateEnd, 0);
    
    console.log(`✅ Fetched ${campaignInsights.length} campaigns\n`);

    if (campaignInsights.length === 0) {
      console.log('⚠️  No campaign data returned from API');
      return;
    }

    // 6. Calculate totals from campaigns
    console.log('6️⃣ Calculating totals from campaign data...');
    const totalSpend = campaignInsights.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
    const totalImpressions = campaignInsights.reduce((sum, c) => sum + parseFloat(c.impressions || 0), 0);
    const totalClicks = campaignInsights.reduce((sum, c) => sum + parseFloat(c.clicks || 0), 0);
    const totalInlineLinkClicks = campaignInsights.reduce((sum, c) => sum + parseFloat(c.inline_link_clicks || 0), 0);
    
    // Calculate weighted averages from campaign API values
    let weightedCtrSum = 0;
    let weightedCpcSum = 0;
    let totalClickWeight = 0;
    
    campaignInsights.forEach(campaign => {
      const campaignClicks = parseFloat(campaign.inline_link_clicks || campaign.clicks || 0);
      const campaignCtr = parseFloat(campaign.inline_link_click_ctr || campaign.ctr || 0);
      const campaignCpc = parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || 0);
      
      if (campaignClicks > 0) {
        weightedCtrSum += campaignCtr * campaignClicks;
        weightedCpcSum += campaignCpc * campaignClicks;
        totalClickWeight += campaignClicks;
      }
    });
    
    const weightedAverageCtr = totalClickWeight > 0 ? weightedCtrSum / totalClickWeight : 0;
    const weightedAverageCpc = totalClickWeight > 0 ? weightedCpcSum / totalClickWeight : 0;
    
    // Calculate from totals (fallback method)
    const calculatedCtr = totalImpressions > 0 ? (totalInlineLinkClicks / totalImpressions) * 100 : 0;
    const calculatedCpc = totalInlineLinkClicks > 0 ? totalSpend / totalInlineLinkClicks : 0;

    console.log('\n📊 OVERALL SUMMARY (January 2026):');
    console.log('='.repeat(70));
    console.log(`Total Spend: ${totalSpend.toFixed(2)} zł`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks (all): ${totalClicks.toLocaleString()}`);
    console.log(`Total Inline Link Clicks: ${totalInlineLinkClicks.toLocaleString()}`);
    console.log('\n📈 CTR (Click-Through Rate):');
    console.log(`   - Weighted Average from Campaign API Values: ${weightedAverageCtr.toFixed(2)}%`);
    console.log(`   - Calculated from Totals: ${calculatedCtr.toFixed(2)}%`);
    console.log('\n💰 CPC (Cost Per Click):');
    console.log(`   - Weighted Average from Campaign API Values: ${weightedAverageCpc.toFixed(2)} zł`);
    console.log(`   - Calculated from Totals: ${calculatedCpc.toFixed(2)} zł`);

    // 7. Show top 10 campaigns with their API values
    console.log('\n7️⃣ TOP 10 CAMPAIGNS (by spend) with API CTR/CPC values:');
    console.log('='.repeat(70));
    
    const sortedCampaigns = campaignInsights
      .map(c => ({
        name: c.campaign_name || 'Unknown',
        spend: parseFloat(c.spend || 0),
        impressions: parseFloat(c.impressions || 0),
        clicks: parseFloat(c.clicks || 0),
        inlineLinkClicks: parseFloat(c.inline_link_clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        inlineLinkClickCtr: parseFloat(c.inline_link_click_ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        costPerInlineLinkClick: parseFloat(c.cost_per_inline_link_click || 0)
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    sortedCampaigns.forEach((campaign, index) => {
      console.log(`\n${index + 1}. ${campaign.name}`);
      console.log(`   Spend: ${campaign.spend.toFixed(2)} zł`);
      console.log(`   Impressions: ${campaign.impressions.toLocaleString()}`);
      console.log(`   Inline Link Clicks: ${campaign.inlineLinkClicks.toLocaleString()}`);
      console.log(`   CTR (all clicks): ${campaign.ctr.toFixed(2)}%`);
      console.log(`   CTR (link clicks) - FROM API: ${campaign.inlineLinkClickCtr.toFixed(2)}%`);
      console.log(`   CPC (all clicks): ${campaign.cpc.toFixed(2)} zł`);
      console.log(`   CPC (link clicks) - FROM API: ${campaign.costPerInlineLinkClick.toFixed(2)} zł`);
    });

    // 8. Summary
    console.log('\n\n📋 SUMMARY:');
    console.log('='.repeat(70));
    console.log('✅ Account-level insights: ' + (accountInsights ? 'Available' : 'Not available'));
    console.log(`✅ Campaign-level insights: ${campaignInsights.length} campaigns`);
    console.log(`✅ Total campaigns with data: ${campaignInsights.filter(c => parseFloat(c.spend || 0) > 0).length}`);
    console.log('\n💡 RECOMMENDED VALUES TO USE:');
    console.log(`   CTR: ${accountInsights?.inline_link_click_ctr ? accountInsights.inline_link_click_ctr + '%' : weightedAverageCtr.toFixed(2) + '% (weighted from campaigns)'}`);
    console.log(`   CPC: ${accountInsights?.cost_per_inline_link_click ? accountInsights.cost_per_inline_link_click + ' zł' : weightedAverageCpc.toFixed(2) + ' zł (weighted from campaigns)'}`);

  } catch (error: any) {
    console.error('\n❌ Error fetching data:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the script
fetchHavetJanuaryCTRCPC()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

