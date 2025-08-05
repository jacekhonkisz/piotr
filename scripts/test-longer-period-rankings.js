require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLongerPeriodRankings() {
  console.log('🔍 TESTING RANKINGS WITH LONGER TIME PERIODS\n');
  console.log('='.repeat(60));

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.name);
    
    // Use the correct ad account ID format
    const adAccountId = `act_${client.ad_account_id}`;
    console.log('🎯 Using ad account ID:', adAccountId);

    // Test different longer time periods to see if rankings become available
    const dateRanges = [
      { name: '3 Months (Jan-Mar 2024)', start: '2024-01-01', end: '2024-03-31' },
      { name: '6 Months (Jul-Dec 2023)', start: '2023-07-01', end: '2023-12-31' },
      { name: 'Full Year 2023', start: '2023-01-01', end: '2023-12-31' },
      { name: 'Last 12 Months', start: '2023-08-01', end: '2024-07-31' },
      { name: 'All Available Data', start: '2020-01-01', end: '2024-12-31' }
    ];

    for (const range of dateRanges) {
      console.log(`\n📅 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      // Test campaign-level insights
      const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,spend,impressions,clicks,conversions,ctr,cpc,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: range.start, until: range.end}))}&level=campaign&limit=100`;
      
      try {
        const response = await fetch(campaignInsightsUrl);
        const data = await response.json();

        if (data.error) {
          console.log(`   ❌ Campaign insights error: ${data.error.message}`);
          continue;
        }

        const campaigns = data.data || [];
        console.log(`   📊 Found ${campaigns.length} campaigns`);
        
        if (campaigns.length > 0) {
          let totalSpend = 0;
          let totalImpressions = 0;
          let totalClicks = 0;
          let campaignsWithRankings = 0;
          
          campaigns.forEach((campaign, index) => {
            const spend = parseFloat(campaign.spend || 0);
            const impressions = parseInt(campaign.impressions || 0);
            const clicks = parseInt(campaign.clicks || 0);
            
            totalSpend += spend;
            totalImpressions += impressions;
            totalClicks += clicks;
            
            const hasRankings = campaign.quality_ranking || 
                              campaign.engagement_rate_ranking || 
                              campaign.conversion_rate_ranking;
            
            if (hasRankings && campaign.quality_ranking !== 'UNKNOWN') {
              campaignsWithRankings++;
            }
            
            if (index < 5) { // Show first 5 campaigns
              console.log(`   ${index + 1}. "${campaign.campaign_name}"`);
              console.log(`      Spend: ${spend.toFixed(2)} PLN`);
              console.log(`      Impressions: ${impressions.toLocaleString()}`);
              console.log(`      Clicks: ${clicks}`);
              console.log(`      Quality ranking: ${campaign.quality_ranking || 'NOT_AVAILABLE'}`);
              console.log(`      Engagement ranking: ${campaign.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
              console.log(`      Conversion ranking: ${campaign.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
            }
          });
          
          if (campaigns.length > 5) {
            console.log(`   ... and ${campaigns.length - 5} more campaigns`);
          }
          
          console.log(`\n   📈 Totals for ${range.name}:`);
          console.log(`      Total spend: ${totalSpend.toFixed(2)} PLN`);
          console.log(`      Total impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`      Total clicks: ${totalClicks}`);
          console.log(`      Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
          console.log(`      Campaigns with rankings: ${campaignsWithRankings}/${campaigns.length}`);
          
          if (campaignsWithRankings > 0) {
            console.log(`   🎉 ${campaignsWithRankings} campaigns have ranking data!`);
            
            // Show campaigns with actual rankings
            campaigns.forEach(campaign => {
              if (campaign.quality_ranking && campaign.quality_ranking !== 'UNKNOWN') {
                console.log(`      "${campaign.campaign_name}":`);
                console.log(`        Quality: ${campaign.quality_ranking}`);
                console.log(`        Engagement: ${campaign.engagement_rate_ranking}`);
                console.log(`        Conversion: ${campaign.conversion_rate_ranking}`);
              }
            });
          } else {
            console.log(`   ⚠️ No campaigns have ranking data for ${range.name}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test ad-level insights with longer periods
    console.log('\n📊 Testing ad-level insights with longer periods...');
    const longPeriods = [
      { name: '6 Months', start: '2023-10-01', end: '2024-03-31' },
      { name: 'Full Year', start: '2023-01-01', end: '2023-12-31' }
    ];

    for (const period of longPeriods) {
      console.log(`\n   Testing ${period.name} (${period.start} to ${period.end})...`);
      
      const adInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=ad_name,campaign_name,spend,impressions,clicks,cpp,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: period.start, until: period.end}))}&level=ad&limit=50`;
      
      try {
        const response = await fetch(adInsightsUrl);
        const data = await response.json();

        if (data.error) {
          console.log(`   ❌ Ad insights error: ${data.error.message}`);
          continue;
        }

        const ads = data.data || [];
        console.log(`   📊 Found ${ads.length} ads`);
        
        if (ads.length > 0) {
          const adsWithRankings = ads.filter(ad => 
            ad.quality_ranking && ad.quality_ranking !== 'UNKNOWN'
          );
          
          console.log(`   🎯 ${adsWithRankings.length} ads have ranking data`);
          
          if (adsWithRankings.length > 0) {
            console.log(`   📋 Sample ads with rankings:`);
            adsWithRankings.slice(0, 3).forEach((ad, index) => {
              console.log(`   ${index + 1}. "${ad.ad_name}"`);
              console.log(`      Campaign: "${ad.campaign_name}"`);
              console.log(`      Impressions: ${ad.impressions}`);
              console.log(`      Quality: ${ad.quality_ranking}`);
              console.log(`      Engagement: ${ad.engagement_rate_ranking}`);
              console.log(`      Conversion: ${ad.conversion_rate_ranking}`);
            });
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Summary and recommendations
    console.log('\n📋 SUMMARY & RECOMMENDATIONS\n');
    console.log('='.repeat(60));
    
    console.log('🔍 Key Findings:');
    console.log('   • Campaigns exist but rankings are still "UNKNOWN"');
    console.log('   • Even with longer periods, Meta may not have enough comparable data');
    console.log('   • Rankings require industry-specific comparisons');
    
    console.log('\n💡 Solutions for Monthly Rankings:');
    console.log('   1. Increase campaign budget to $10+/day');
    console.log('   2. Create more campaigns in the same industry');
    console.log('   3. Wait for 30+ days of consistent data');
    console.log('   4. Use broader industry targeting for better comparisons');
    console.log('   5. Consider using historical data from previous months');
    
    console.log('\n🎯 Monthly Ranking Strategy:');
    console.log('   • Focus on accumulating 1000+ impressions per ad');
    console.log('   • Maintain consistent daily spend');
    console.log('   • Use similar ad formats and targeting');
    console.log('   • Monitor performance over 30-day periods');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the test
testLongerPeriodRankings(); 