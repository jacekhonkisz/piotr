/**
 * Check Havet's Meta Ads CTR and CPC for January 2026 directly from API
 * Shows what the API returns and how it's being processed
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const HAVET_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';

async function checkHavetJanuary2026FromAPI() {
  console.log('🔍 HAVET JANUARY 2026 CTR & CPC - DIRECT API CHECK');
  console.log('='.repeat(80));
  console.log();

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .eq('id', HAVET_ID)
    .single();

  if (!client) {
    console.log('❌ Client not found');
    return;
  }

  console.log(`📋 Client: ${client.name} (${client.id})`);
  console.log(`📱 Ad Account ID: ${client.ad_account_id}`);
  console.log();

  // Check which token is available
  const metaToken = client.system_user_token || client.meta_access_token;
  if (!metaToken) {
    console.log('❌ No Meta token available');
    return;
  }

  console.log(`🔑 Using token: ${client.system_user_token ? 'system_user_token' : 'meta_access_token'}`);
  console.log();

  // Initialize Meta API service (dynamic import for TypeScript)
  const { MetaAPIServiceOptimized } = await import('./src/lib/meta-api-optimized.js');
  const metaService = new MetaAPIServiceOptimized(metaToken);

  // Validate token
  const tokenValidation = await metaService.validateToken();
  if (!tokenValidation.valid) {
    console.log(`❌ Invalid token: ${tokenValidation.error}`);
    return;
  }

  console.log('✅ Token is valid');
  console.log();

  // Fetch data for January 2026
  const dateStart = '2026-01-01';
  const dateEnd = '2026-01-31';
  
  console.log(`📅 Fetching data from Meta API: ${dateStart} to ${dateEnd}`);
  console.log();

  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;

  try {
    // Fetch campaign insights
    const campaigns = await metaService.getCampaignInsights(adAccountId, dateStart, dateEnd, 0);

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ No campaigns returned from Meta API');
      return;
    }

    console.log(`✅ Fetched ${campaigns.length} campaigns from Meta API`);
    console.log();

    // Show raw API data for first few campaigns
    console.log('📊 RAW API DATA (First 3 campaigns):');
    console.log('-'.repeat(80));
    campaigns.slice(0, 3).forEach((campaign, index) => {
      console.log(`\nCampaign ${index + 1}: ${campaign.campaign_name || campaign.campaign_id}`);
      console.log(`  Spend: ${campaign.spend || 0}`);
      console.log(`  Impressions: ${campaign.impressions || 0}`);
      console.log(`  Clicks: ${campaign.clicks || 0}`);
      console.log(`  inline_link_clicks: ${campaign.inline_link_clicks || 'N/A'}`);
      console.log(`  CTR (from API): ${campaign.ctr || 'N/A'}`);
      console.log(`  inline_link_click_ctr (from API): ${campaign.inline_link_click_ctr || 'N/A'}`);
      console.log(`  CPC (from API): ${campaign.cpc || 'N/A'}`);
      console.log(`  cost_per_inline_link_click (from API): ${campaign.cost_per_inline_link_click || 'N/A'}`);
    });

    console.log();
    console.log('='.repeat(80));
    console.log();

    // Process data the same way standardized-data-fetcher does
    console.log('🔄 PROCESSING DATA (Same as standardized-data-fetcher.ts):');
    console.log('-'.repeat(80));

    const processedCampaigns = campaigns.map((campaign) => {
      const spend = parseFloat(campaign.spend || '0');
      const impressions = parseInt(campaign.impressions || '0');
      const clicks = parseInt(campaign.inline_link_clicks || campaign.clicks || '0');
      
      // This is how we're currently processing it (using API values directly)
      const ctr = parseFloat(campaign.inline_link_click_ctr || campaign.ctr || '0');
      const cpc = parseFloat(campaign.cost_per_inline_link_click || campaign.cpc || '0');

      return {
        campaign_id: campaign.campaign_id || campaign.id,
        campaign_name: campaign.campaign_name || campaign.name,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        // Also show what we'd get if we calculated
        calculated_ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        calculated_cpc: clicks > 0 ? spend / clicks : 0
      };
    });

    // Show processed data
    console.log('\nProcessed Campaigns (First 3):');
    processedCampaigns.slice(0, 3).forEach((campaign, index) => {
      console.log(`\n${index + 1}. ${campaign.campaign_name}`);
      console.log(`   Spend: ${campaign.spend.toFixed(2)} zł`);
      console.log(`   Impressions: ${campaign.impressions.toLocaleString()}`);
      console.log(`   Clicks (link clicks): ${campaign.clicks.toLocaleString()}`);
      console.log(`   CTR (from API): ${campaign.ctr.toFixed(2)}%`);
      console.log(`   CTR (calculated): ${campaign.calculated_ctr.toFixed(2)}%`);
      console.log(`   CPC (from API): ${campaign.cpc.toFixed(2)} zł`);
      console.log(`   CPC (calculated): ${campaign.calculated_cpc.toFixed(2)} zł`);
    });

    // Calculate totals
    const totalSpend = processedCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalImpressions = processedCampaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = processedCampaigns.reduce((sum, c) => sum + c.clicks, 0);

    // Overall stats (calculated from totals)
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    console.log();
    console.log('='.repeat(80));
    console.log();
    console.log('📊 OVERALL STATS (Calculated from totals):');
    console.log('-'.repeat(80));
    console.log(`   Total Spend: ${totalSpend.toFixed(2)} zł`);
    console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`   Total Clicks (link clicks): ${totalClicks.toLocaleString()}`);
    console.log();
    console.log('   🎯 MAIN CTR & CPC FOR JANUARY 2026:');
    console.log(`      Average CTR: ${averageCtr.toFixed(2)}%`);
    console.log(`      Average CPC: ${averageCpc.toFixed(2)} zł`);
    console.log();

    // Also check what's in current_month_cache
    console.log('='.repeat(80));
    console.log();
    console.log('💾 CURRENT MONTH CACHE (What\'s stored in database):');
    console.log('-'.repeat(80));
    
    const { data: cache } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', HAVET_ID)
      .single();

    if (cache) {
      console.log(`   Last Updated: ${new Date(cache.last_updated).toLocaleString()}`);
      console.log(`   Period: ${cache.period_id}`);
      console.log(`   Total Spend: ${parseFloat(cache.total_spend || 0).toFixed(2)} zł`);
      console.log(`   Total Impressions: ${(cache.total_impressions || 0).toLocaleString()}`);
      console.log(`   Total Clicks: ${(cache.total_clicks || 0).toLocaleString()}`);
      console.log(`   Average CTR: ${parseFloat(cache.average_ctr || 0).toFixed(2)}%`);
      console.log(`   Average CPC: ${parseFloat(cache.average_cpc || 0).toFixed(2)} zł`);
    } else {
      console.log('   ⚠️ No data in current_month_cache');
    }

  } catch (error) {
    console.error('❌ Error fetching from Meta API:', error);
    console.error(error.stack);
  }
}

checkHavetJanuary2026FromAPI().catch(console.error);

