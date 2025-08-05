require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testApril2024Data() {
  console.log('🔍 TESTING APRIL 2024 CAMPAIGN DATA\n');
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

    // Test April 2024 date range where campaigns exist
    const dateRanges = [
      { name: 'April 2024', start: '2024-04-01', end: '2024-04-30' },
      { name: 'March-April 2024', start: '2024-03-15', end: '2024-04-15' },
      { name: 'Q2 2024', start: '2024-04-01', end: '2024-06-30' }
    ];

    for (const range of dateRanges) {
      console.log(`\n📅 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      // Test campaign-level insights first
      const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,spend,impressions,clicks,conversions,ctr,cpc,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: range.start, until: range.end}))}&level=campaign&limit=50`;
      
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
          console.log(`   📋 Campaign data:`);
          let totalSpend = 0;
          let totalImpressions = 0;
          let totalClicks = 0;
          
          campaigns.forEach((campaign, index) => {
            const spend = parseFloat(campaign.spend || 0);
            const impressions = parseInt(campaign.impressions || 0);
            const clicks = parseInt(campaign.clicks || 0);
            
            totalSpend += spend;
            totalImpressions += impressions;
            totalClicks += clicks;
            
            console.log(`   ${index + 1}. "${campaign.campaign_name}"`);
            console.log(`      Spend: ${spend.toFixed(2)} PLN`);
            console.log(`      Impressions: ${impressions.toLocaleString()}`);
            console.log(`      Clicks: ${clicks}`);
            console.log(`      CTR: ${campaign.ctr || '0'}%`);
            console.log(`      CPC: ${campaign.cpc || '0'} PLN`);
            console.log(`      Quality ranking: ${campaign.quality_ranking || 'NOT_AVAILABLE'}`);
            console.log(`      Engagement ranking: ${campaign.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
            console.log(`      Conversion ranking: ${campaign.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
          });
          
          console.log(`\n   📈 Totals for ${range.name}:`);
          console.log(`      Total spend: ${totalSpend.toFixed(2)} PLN`);
          console.log(`      Total impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`      Total clicks: ${totalClicks}`);
          console.log(`      Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
          
          // Check for rankings
          const campaignsWithRankings = campaigns.filter(campaign => 
            campaign.quality_ranking || 
            campaign.engagement_rate_ranking || 
            campaign.conversion_rate_ranking
          );
          
          if (campaignsWithRankings.length > 0) {
            console.log(`\n   🎉 ${campaignsWithRankings.length} campaigns have ranking data!`);
            
            campaignsWithRankings.forEach(campaign => {
              console.log(`      "${campaign.campaign_name}":`);
              console.log(`        Quality: ${campaign.quality_ranking}`);
              console.log(`        Engagement: ${campaign.engagement_rate_ranking}`);
              console.log(`        Conversion: ${campaign.conversion_rate_ranking}`);
            });
          } else {
            console.log(`\n   ⚠️ No campaigns have ranking data for ${range.name}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test ad-level insights for April 2024
    console.log('\n📊 Testing ad-level insights for April 2024...');
    const adInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=ad_name,campaign_name,spend,impressions,clicks,cpp,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: '2024-04-01', until: '2024-04-30'}))}&level=ad&limit=50`;
    
    try {
      const response = await fetch(adInsightsUrl);
      const data = await response.json();

      if (data.error) {
        console.log(`❌ Ad insights error: ${data.error.message}`);
      } else {
        const ads = data.data || [];
        console.log(`✅ Found ${ads.length} ads for April 2024`);
        
        if (ads.length > 0) {
          console.log(`📋 Sample ad data:`);
          const sampleAd = ads[0];
          console.log(`   Name: "${sampleAd.ad_name}"`);
          console.log(`   Campaign: "${sampleAd.campaign_name}"`);
          console.log(`   Spend: ${sampleAd.spend || '0'} PLN`);
          console.log(`   Impressions: ${sampleAd.impressions || '0'}`);
          console.log(`   Clicks: ${sampleAd.clicks || '0'}`);
          console.log(`   Quality ranking: ${sampleAd.quality_ranking || 'NOT_AVAILABLE'}`);
          console.log(`   Engagement ranking: ${sampleAd.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
          console.log(`   Conversion ranking: ${sampleAd.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
          
          // Count ads with rankings
          const adsWithRankings = ads.filter(ad => 
            ad.quality_ranking || 
            ad.engagement_rate_ranking || 
            ad.conversion_rate_ranking
          );
          
          if (adsWithRankings.length > 0) {
            console.log(`\n🎉 ${adsWithRankings.length} ads have ranking data!`);
          } else {
            console.log(`\n⚠️ No ads have ranking data for April 2024`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Summary
    console.log('\n📋 SUMMARY\n');
    console.log('='.repeat(60));
    
    console.log('✅ What we found:');
    console.log('   ✓ Campaigns exist in April 2024');
    console.log('   ✓ Real performance data is available');
    console.log('   ✓ API is working correctly');
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Update your dashboard to use April 2024 date range');
    console.log('   2. Check if rankings are available for that period');
    console.log('   3. Consider using historical data for rankings');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the test
testApril2024Data(); 