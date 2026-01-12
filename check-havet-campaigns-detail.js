/**
 * Deep dive into Havet's cache data to understand the zeros
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const HAVET_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';

async function checkHavetCampaigns() {
  console.log('🔍 HAVET DETAILED CAMPAIGN ANALYSIS');
  console.log('='.repeat(80));

  // 1. Get Google Ads cache
  const { data: googleCache } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', HAVET_ID)
    .single();

  if (googleCache) {
    console.log('\n📊 GOOGLE ADS CACHE:');
    console.log(`   Period: ${googleCache.period_id}`);
    console.log(`   Updated: ${new Date(googleCache.last_updated).toLocaleString()}`);
    console.log(`   Stats:`, googleCache.cache_data?.stats);
    console.log(`   Campaigns: ${googleCache.cache_data?.campaigns?.length || 0}`);
    
    // Check campaign statuses
    const campaigns = googleCache.cache_data?.campaigns || [];
    const activeWithSpend = campaigns.filter(c => c.spend > 0);
    const activeWithImpressions = campaigns.filter(c => c.impressions > 0);
    const paused = campaigns.filter(c => c.status === 'PAUSED');
    const enabled = campaigns.filter(c => c.status === 'ENABLED');
    
    console.log(`\n   Campaign breakdown:`);
    console.log(`   - Total: ${campaigns.length}`);
    console.log(`   - With spend > 0: ${activeWithSpend.length}`);
    console.log(`   - With impressions > 0: ${activeWithImpressions.length}`);
    console.log(`   - Status PAUSED: ${paused.length}`);
    console.log(`   - Status ENABLED: ${enabled.length}`);
    
    // List first few campaigns
    console.log(`\n   First 10 campaigns:`);
    campaigns.slice(0, 10).forEach((c, i) => {
      console.log(`   ${i+1}. ${c.campaignName || c.campaign_name}`);
      console.log(`      Status: ${c.status} | Spend: ${c.spend} | Impressions: ${c.impressions}`);
    });
    
    // Check for ENABLED campaigns
    if (enabled.length > 0) {
      console.log(`\n   ENABLED campaigns:`);
      enabled.slice(0, 5).forEach((c, i) => {
        console.log(`   ${i+1}. ${c.campaignName || c.campaign_name}`);
        console.log(`      Spend: ${c.spend} | Impressions: ${c.impressions} | Clicks: ${c.clicks}`);
      });
    }
  } else {
    console.log('\n❌ No Google Ads cache found for Havet');
  }

  // 2. Get Meta cache
  const { data: metaCache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', HAVET_ID)
    .single();

  if (metaCache) {
    console.log('\n📊 META ADS CACHE:');
    console.log(`   Period: ${metaCache.period_id}`);
    console.log(`   Updated: ${new Date(metaCache.last_updated).toLocaleString()}`);
    console.log(`   Stats:`, metaCache.cache_data?.stats);
    console.log(`   Conversion Metrics:`, metaCache.cache_data?.conversionMetrics);
    console.log(`   Campaigns: ${metaCache.cache_data?.campaigns?.length || 0}`);
    
    const campaigns = metaCache.cache_data?.campaigns || [];
    const activeWithSpend = campaigns.filter(c => c.spend > 0);
    
    console.log(`\n   Campaign breakdown:`);
    console.log(`   - Total: ${campaigns.length}`);
    console.log(`   - With spend > 0: ${activeWithSpend.length}`);
    
    console.log(`\n   All campaigns:`);
    campaigns.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.campaignName || c.name}`);
      console.log(`      Spend: ${c.spend} | Status: ${c.status}`);
      console.log(`      Funnel: ${c.booking_step_1}→${c.booking_step_2}→${c.booking_step_3}→${c.reservations}`);
    });
  } else {
    console.log('\n❌ No Meta cache found for Havet');
  }

  // 3. Check historical data for Havet
  console.log('\n📚 HISTORICAL DATA (campaign_summaries):');
  
  const { data: historicalGoogle } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, total_impressions, booking_step_1, reservations')
    .eq('client_id', HAVET_ID)
    .eq('platform', 'google')
    .order('summary_date', { ascending: false })
    .limit(6);

  console.log('\n   Google Ads history:');
  historicalGoogle?.forEach(h => {
    console.log(`   ${h.summary_date}: Spend: ${h.total_spend?.toFixed(2)} | Impr: ${h.total_impressions} | Step1: ${h.booking_step_1} | Reservations: ${h.reservations}`);
  });

  const { data: historicalMeta } = await supabase
    .from('campaign_summaries')
    .select('summary_date, total_spend, total_impressions, booking_step_1, reservations')
    .eq('client_id', HAVET_ID)
    .eq('platform', 'meta')
    .order('summary_date', { ascending: false })
    .limit(6);

  console.log('\n   Meta Ads history:');
  historicalMeta?.forEach(h => {
    console.log(`   ${h.summary_date}: Spend: ${h.total_spend?.toFixed(2)} | Impr: ${h.total_impressions} | Step1: ${h.booking_step_1} | Reservations: ${h.reservations}`);
  });

  // 4. What should we conclude?
  console.log('\n' + '='.repeat(80));
  console.log('📋 ANALYSIS:');
  
  const hasHistoricalGoogleSpend = historicalGoogle?.some(h => h.total_spend > 0);
  const hasHistoricalMetaSpend = historicalMeta?.some(h => h.total_spend > 0);
  const hasCurrentGoogleSpend = googleCache?.cache_data?.stats?.totalSpend > 0;
  const hasCurrentMetaSpend = metaCache?.cache_data?.stats?.totalSpend > 0;
  
  if (hasHistoricalGoogleSpend && !hasCurrentGoogleSpend) {
    console.log('⚠️ Google Ads: Havet HAD historical spend but current month shows ZERO');
    console.log('   → This could mean: campaigns paused in January OR API issue');
  }
  
  if (hasHistoricalMetaSpend && !hasCurrentMetaSpend) {
    console.log('⚠️ Meta Ads: Havet HAD historical spend but current month shows ZERO');
    console.log('   → This could mean: campaigns paused in January OR API issue');
  }

  console.log('\n' + '='.repeat(80));
}

checkHavetCampaigns().catch(console.error);

