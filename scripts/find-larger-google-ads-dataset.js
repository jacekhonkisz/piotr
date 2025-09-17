#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findLargerDataset() {
  console.log('🔍 SEARCHING FOR LARGER GOOGLE ADS DATASET\n');
  
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('google_ads_enabled', true)
      .limit(1);
      
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }
    
    const client = clients[0];
    console.log('📊 Client:', client.name);
    
    // Check ALL Google Ads campaigns (not just August)
    console.log('\n🔍 Checking ALL Google Ads campaigns in database:');
    const { data: allCampaigns } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });
      
    if (allCampaigns && allCampaigns.length > 0) {
      console.log(`   Found ${allCampaigns.length} total campaigns`);
      
      const allTotals = allCampaigns.reduce((acc, campaign) => {
        acc.spend += parseFloat(campaign.spend || 0);
        acc.impressions += parseInt(campaign.impressions || 0);
        acc.clicks += parseInt(campaign.clicks || 0);
        acc.reservations += parseInt(campaign.reservations || 0);
        return acc;
      }, { spend: 0, impressions: 0, clicks: 0, reservations: 0 });
      
      console.log('   ALL campaigns totals:');
      console.log(`      Total spend: ${allTotals.spend.toFixed(2)} PLN`);
      console.log(`      Total impressions: ${allTotals.impressions.toLocaleString()}`);
      console.log(`      Total clicks: ${allTotals.clicks.toLocaleString()}`);
      console.log(`      Total reservations: ${allTotals.reservations}`);
      
      // Show date ranges
      console.log('\n   Date ranges:');
      allCampaigns.forEach((campaign, i) => {
        console.log(`      ${i + 1}. ${campaign.date_range_start} to ${campaign.date_range_end} (${campaign.spend} PLN)`);
      });
    }
    
    // Check if there are other Google Ads related tables
    console.log('\n🔍 Checking other potential data sources:');
    
    // Check google_ads_campaign_summaries
    const { data: summaries } = await supabase
      .from('google_ads_campaign_summaries')
      .select('*')
      .eq('client_id', client.id);
      
    if (summaries && summaries.length > 0) {
      console.log(`   Found ${summaries.length} campaign summaries`);
      summaries.forEach((summary, i) => {
        console.log(`      ${i + 1}. ${summary.period_start} to ${summary.period_end}:`);
        console.log(`         Spend: ${summary.total_spend} PLN`);
        console.log(`         Impressions: ${summary.total_impressions}`);
        console.log(`         Clicks: ${summary.total_clicks}`);
        console.log(`         Reservations: ${summary.total_reservations}`);
      });
    } else {
      console.log('   No campaign summaries found');
    }
    
    // Check ALL cache tables
    const cacheQueries = [
      { table: 'google_ads_current_month_cache', name: 'Monthly Cache' },
      { table: 'google_ads_current_week_cache', name: 'Weekly Cache' }
    ];
    
    for (const cacheQuery of cacheQueries) {
      const { data: cacheData } = await supabase
        .from(cacheQuery.table)
        .select('*')
        .eq('client_id', client.id);
        
      if (cacheData && cacheData.length > 0) {
        console.log(`\n   ${cacheQuery.name}: ${cacheData.length} entries`);
        cacheData.forEach((cache, i) => {
          const data = cache.cache_data;
          console.log(`      ${i + 1}. Period: ${cache.period_id}, Updated: ${cache.last_updated}`);
          if (data?.stats) {
            console.log(`         Stats: ${data.stats.totalSpend} PLN, ${data.stats.totalImpressions} imp, ${data.stats.totalClicks} clicks`);
          }
          if (data?.conversionMetrics) {
            console.log(`         Conversions: ${data.conversionMetrics.reservations || 0} reservations`);
          }
          
          // Check if this matches the report values
          if (data?.stats) {
            const spendMatch = Math.abs(data.stats.totalSpend - 15800) < 100;
            const impressionsMatch = Math.abs(data.stats.totalImpressions - 370000) < 1000;
            const clicksMatch = Math.abs(data.stats.totalClicks - 7400) < 100;
            
            if (spendMatch && impressionsMatch && clicksMatch) {
              console.log('         🎯 MATCH FOUND! This cache data matches the report values!');
            }
          }
        });
      } else {
        console.log(`\n   ${cacheQuery.name}: No data found`);
      }
    }
    
    // Check if the report might be using a different client
    console.log('\n🔍 Checking if there are other clients with Google Ads data:');
    const { data: allGoogleAdsClients } = await supabase
      .from('clients')
      .select('id, name, google_ads_enabled')
      .eq('google_ads_enabled', true);
      
    if (allGoogleAdsClients && allGoogleAdsClients.length > 1) {
      console.log(`   Found ${allGoogleAdsClients.length} clients with Google Ads enabled:`);
      
      for (const otherClient of allGoogleAdsClients) {
        if (otherClient.id !== client.id) {
          console.log(`\n   Checking client: ${otherClient.name}`);
          
          const { data: otherCampaigns } = await supabase
            .from('google_ads_campaigns')
            .select('*')
            .eq('client_id', otherClient.id);
            
          if (otherCampaigns && otherCampaigns.length > 0) {
            const otherTotals = otherCampaigns.reduce((acc, campaign) => {
              acc.spend += parseFloat(campaign.spend || 0);
              acc.impressions += parseInt(campaign.impressions || 0);
              acc.clicks += parseInt(campaign.clicks || 0);
              acc.reservations += parseInt(campaign.reservations || 0);
              return acc;
            }, { spend: 0, impressions: 0, clicks: 0, reservations: 0 });
            
            console.log(`      Campaigns: ${otherCampaigns.length}`);
            console.log(`      Totals: ${otherTotals.spend.toFixed(2)} PLN, ${otherTotals.impressions} imp, ${otherTotals.clicks} clicks`);
            
            // Check if this matches the report values
            const spendMatch = Math.abs(otherTotals.spend - 15800) < 100;
            const impressionsMatch = Math.abs(otherTotals.impressions - 370000) < 1000;
            const clicksMatch = Math.abs(otherTotals.clicks - 7400) < 100;
            
            if (spendMatch && impressionsMatch && clicksMatch) {
              console.log('      🎯 MATCH FOUND! This client has data matching the report values!');
            }
          } else {
            console.log('      No campaigns found');
          }
        }
      }
    }
    
    console.log('\n🔍 CONCLUSION:');
    console.log('   Report shows: 15,800 PLN, 370,000 impressions, 7,400 clicks, 82 reservations');
    console.log('   Database shows: 2,140.75 PLN, 77,000 impressions, 1,530 clicks, 17 reservations');
    console.log('\n   Possible explanations:');
    console.log('   1. Report is using live API data (not database)');
    console.log('   2. Report is using cached data from a different time period');
    console.log('   3. Report is aggregating data from multiple sources');
    console.log('   4. There is a data source we have not discovered yet');
    console.log('   5. The report is using test/demo data');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findLargerDataset().catch(console.error);
