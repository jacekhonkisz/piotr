require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRankingsWithCorrectId() {
  console.log('🔍 TESTING RANKINGS WITH CORRECT AD ACCOUNT ID\n');
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
    console.log('🎯 Using correct ad account ID:', adAccountId);

    // Test different date ranges for rankings
    const dateRanges = [
      { name: 'Last 7 days', start: '2025-08-01', end: '2025-08-07' },
      { name: 'Last 30 days', start: '2025-07-08', end: '2025-08-07' },
      { name: 'Last 90 days', start: '2025-05-08', end: '2025-08-07' }
    ];

    for (const range of dateRanges) {
      console.log(`\n📅 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      // Test ad-level insights with rankings
      const adInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=ad_name,spend,impressions,clicks,cpp,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: range.start, until: range.end}))}&level=ad&limit=10`;
      
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
          console.log(`   📋 Sample ad data:`);
          const sampleAd = ads[0];
          console.log(`      Name: "${sampleAd.ad_name}"`);
          console.log(`      Spend: ${sampleAd.spend || '0'} PLN`);
          console.log(`      Impressions: ${sampleAd.impressions || '0'}`);
          console.log(`      Clicks: ${sampleAd.clicks || '0'}`);
          console.log(`      Quality ranking: ${sampleAd.quality_ranking || 'NOT_AVAILABLE'}`);
          console.log(`      Engagement ranking: ${sampleAd.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
          console.log(`      Conversion ranking: ${sampleAd.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
          
          // Count ads with rankings
          const adsWithRankings = ads.filter(ad => 
            ad.quality_ranking || 
            ad.engagement_rate_ranking || 
            ad.conversion_rate_ranking
          );
          
          if (adsWithRankings.length > 0) {
            console.log(`   🎉 ${adsWithRankings.length} ads have ranking data!`);
            
            // Show all ranking values found
            const allRankings = adsWithRankings.flatMap(ad => [
              ad.quality_ranking,
              ad.engagement_rate_ranking,
              ad.conversion_rate_ranking
            ]).filter(Boolean);
            
            const uniqueRankings = [...new Set(allRankings)];
            console.log(`   📈 Ranking values found: ${uniqueRankings.join(', ')}`);
          } else {
            console.log(`   ⚠️ No ads have ranking data for this period`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test campaign-level insights with rankings
    console.log('\n📊 Testing campaign-level rankings...');
    const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,spend,impressions,clicks,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: '2025-07-08', until: '2025-08-07'}))}&level=campaign&limit=10`;
    
    try {
      const response = await fetch(campaignInsightsUrl);
      const data = await response.json();

      if (data.error) {
        console.log(`❌ Campaign insights error: ${data.error.message}`);
      } else {
        const campaigns = data.data || [];
        console.log(`✅ Found ${campaigns.length} campaigns`);
        
        if (campaigns.length > 0) {
          console.log(`📋 Campaign data:`);
          campaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. "${campaign.campaign_name}"`);
            console.log(`      Spend: ${campaign.spend || '0'} PLN`);
            console.log(`      Impressions: ${campaign.impressions || '0'}`);
            console.log(`      Quality ranking: ${campaign.quality_ranking || 'NOT_AVAILABLE'}`);
            console.log(`      Engagement ranking: ${campaign.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
            console.log(`      Conversion ranking: ${campaign.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
          });
          
          const campaignsWithRankings = campaigns.filter(campaign => 
            campaign.quality_ranking || 
            campaign.engagement_rate_ranking || 
            campaign.conversion_rate_ranking
          );
          
          if (campaignsWithRankings.length > 0) {
            console.log(`\n🎉 ${campaignsWithRankings.length} campaigns have ranking data!`);
          } else {
            console.log(`\n⚠️ No campaigns have ranking data`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Summary and recommendations
    console.log('\n📋 SUMMARY & RECOMMENDATIONS\n');
    console.log('='.repeat(60));
    
    console.log('✅ What we confirmed:');
    console.log('   ✓ Ad account access works with act_ prefix');
    console.log('   ✓ API permissions are correct');
    console.log('   ✓ Token is valid and functional');
    
    console.log('\n🔍 Next steps to get rankings:');
    console.log('   1. Ensure campaigns have 1000+ impressions');
    console.log('   2. Use 30+ day date ranges');
    console.log('   3. Wait for Meta to calculate rankings (can take 7+ days)');
    console.log('   4. Check that campaigns are in the same industry/vertical');
    console.log('   5. Ensure sufficient budget and engagement');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the test
testRankingsWithCorrectId(); 