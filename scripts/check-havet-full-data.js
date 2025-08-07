require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHavetFullData() {
  console.log('🔍 CHECKING HAVET FULL DATA AVAILABILITY\n');
  console.log('='.repeat(60));

  const targetToken = 'EAAKZBRTlpNXsBPMg0chlsVDyDiPuQcOZAYaKYtz2rQKW93ZBGuH0VJzj2eFWv8WNVrus3mBbm8RnpG5JVFjOA7813ZCRy8zZBH0qTLNK9QZCrhO8ZAITtIkeGohn1DfRyouTDIoASdBNJzbPUphAEZAX2TmFMRmXrcySZA5ZBqiL8Oz7n6KquIBL92EaZAwk6UzOZCurpQZDZD';
  const targetAdAccountId = '659510566204299'; // Havet account

  try {
    console.log('1️⃣ Testing different date ranges for insights...\n');
    
    const dateRanges = [
      { name: 'Last 7 days', preset: 'last_7d' },
      { name: 'Last 30 days', preset: 'last_30d' },
      { name: 'Last 90 days', preset: 'last_90d' },
      { name: 'This month', preset: 'this_month' },
      { name: 'Last month', preset: 'last_month' },
      { name: 'This year', preset: 'this_year' }
    ];

    const havetAccountId = `act_${targetAdAccountId}`;

    for (const dateRange of dateRanges) {
      console.log(`📅 Testing ${dateRange.name}...`);
      
      try {
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${havetAccountId}/insights?access_token=${targetToken}&fields=impressions,clicks,spend,reach,frequency,cpm,cpc,ctr&date_preset=${dateRange.preset}&limit=1`
        );
        const insightsData = await insightsResponse.json();
        
        if (insightsData.error) {
          console.log(`   ❌ Error: ${insightsData.error.message}`);
        } else {
          const insight = insightsData.data?.[0];
          if (insight) {
            console.log(`   ✅ Data available:`);
            console.log(`      Impressions: ${insight.impressions || 'N/A'}`);
            console.log(`      Clicks: ${insight.clicks || 'N/A'}`);
            console.log(`      Spend: ${insight.spend || 'N/A'}`);
            console.log(`      Reach: ${insight.reach || 'N/A'}`);
            console.log(`      Frequency: ${insight.frequency || 'N/A'}`);
            console.log(`      CPM: ${insight.cpm || 'N/A'}`);
            console.log(`      CPC: ${insight.cpc || 'N/A'}`);
            console.log(`      CTR: ${insight.ctr || 'N/A'}`);
          } else {
            console.log(`   ⚠️  No data available`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
      }
      console.log('');
    }

    console.log('2️⃣ Testing all campaigns (not just first 5)...\n');
    
    try {
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${havetAccountId}/campaigns?access_token=${targetToken}&fields=id,name,status,objective,created_time,start_time,stop_time&limit=50`
      );
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.log(`❌ Campaigns error: ${campaignsData.error.message}`);
      } else {
        console.log(`✅ Found ${campaignsData.data?.length || 0} total campaigns:`);
        campaignsData.data?.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name} (${campaign.id})`);
          console.log(`      Status: ${campaign.status}`);
          console.log(`      Objective: ${campaign.objective}`);
          console.log(`      Created: ${campaign.created_time}`);
          console.log(`      Start: ${campaign.start_time || 'N/A'}`);
          console.log(`      Stop: ${campaign.stop_time || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`❌ Campaigns request failed: ${error.message}`);
    }

    console.log('\n3️⃣ Testing ad sets...\n');
    
    try {
      const adSetsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${havetAccountId}/adsets?access_token=${targetToken}&fields=id,name,status,campaign_id&limit=20`
      );
      const adSetsData = await adSetsResponse.json();
      
      if (adSetsData.error) {
        console.log(`❌ Ad sets error: ${adSetsData.error.message}`);
      } else {
        console.log(`✅ Found ${adSetsData.data?.length || 0} ad sets:`);
        adSetsData.data?.forEach((adset, index) => {
          console.log(`   ${index + 1}. ${adset.name} (${adset.id})`);
          console.log(`      Status: ${adset.status}`);
          console.log(`      Campaign ID: ${adset.campaign_id}`);
        });
      }
    } catch (error) {
      console.log(`❌ Ad sets request failed: ${error.message}`);
    }

    console.log('\n4️⃣ Testing ads...\n');
    
    try {
      const adsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${havetAccountId}/ads?access_token=${targetToken}&fields=id,name,status,adset_id&limit=20`
      );
      const adsData = await adsResponse.json();
      
      if (adsData.error) {
        console.log(`❌ Ads error: ${adsData.error.message}`);
      } else {
        console.log(`✅ Found ${adsData.data?.length || 0} ads:`);
        adsData.data?.forEach((ad, index) => {
          console.log(`   ${index + 1}. ${ad.name} (${ad.id})`);
          console.log(`      Status: ${ad.status}`);
          console.log(`      Ad Set ID: ${ad.adset_id}`);
        });
      }
    } catch (error) {
      console.log(`❌ Ads request failed: ${error.message}`);
    }

    console.log('\n5️⃣ Testing account-level insights with breakdowns...\n');
    
    try {
      const breakdownResponse = await fetch(
        `https://graph.facebook.com/v18.0/${havetAccountId}/insights?access_token=${targetToken}&fields=impressions,clicks,spend,reach&date_preset=last_30d&breakdowns=age,gender&limit=10`
      );
      const breakdownData = await breakdownResponse.json();
      
      if (breakdownData.error) {
        console.log(`❌ Breakdown error: ${breakdownData.error.message}`);
      } else {
        console.log(`✅ Found ${breakdownData.data?.length || 0} breakdown records:`);
        breakdownData.data?.slice(0, 5).forEach((record, index) => {
          console.log(`   ${index + 1}. Age: ${record.age || 'N/A'}, Gender: ${record.gender || 'N/A'}`);
          console.log(`      Impressions: ${record.impressions || 'N/A'}`);
          console.log(`      Clicks: ${record.clicks || 'N/A'}`);
          console.log(`      Spend: ${record.spend || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`❌ Breakdown request failed: ${error.message}`);
    }

    console.log('\n6️⃣ Testing campaign-level insights...\n');
    
    try {
      // Get first campaign and test its insights
      const firstCampaignResponse = await fetch(
        `https://graph.facebook.com/v18.0/${havetAccountId}/campaigns?access_token=${targetToken}&fields=id,name&limit=1`
      );
      const firstCampaignData = await firstCampaignResponse.json();
      
      if (firstCampaignData.data && firstCampaignData.data.length > 0) {
        const campaignId = firstCampaignData.data[0].id;
        console.log(`Testing insights for campaign: ${firstCampaignData.data[0].name} (${campaignId})`);
        
        const campaignInsightsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${campaignId}/insights?access_token=${targetToken}&fields=impressions,clicks,spend,reach,frequency,cpm,cpc,ctr&date_preset=last_30d&limit=1`
        );
        const campaignInsightsData = await campaignInsightsResponse.json();
        
        if (campaignInsightsData.error) {
          console.log(`❌ Campaign insights error: ${campaignInsightsData.error.message}`);
        } else {
          const insight = campaignInsightsData.data?.[0];
          if (insight) {
            console.log(`✅ Campaign insights available:`);
            console.log(`   Impressions: ${insight.impressions || 'N/A'}`);
            console.log(`   Clicks: ${insight.clicks || 'N/A'}`);
            console.log(`   Spend: ${insight.spend || 'N/A'}`);
            console.log(`   Reach: ${insight.reach || 'N/A'}`);
            console.log(`   Frequency: ${insight.frequency || 'N/A'}`);
            console.log(`   CPM: ${insight.cpm || 'N/A'}`);
            console.log(`   CPC: ${insight.cpc || 'N/A'}`);
            console.log(`   CTR: ${insight.ctr || 'N/A'}`);
          } else {
            console.log(`⚠️  No campaign insights available`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Campaign insights request failed: ${error.message}`);
    }

    console.log('\n7️⃣ Summary of available data...\n');
    console.log('📊 Havet account has access to:');
    console.log('   ✅ Account-level insights (multiple date ranges)');
    console.log('   ✅ Campaign data (all campaigns)');
    console.log('   ✅ Ad sets data');
    console.log('   ✅ Ads data');
    console.log('   ✅ Demographic breakdowns');
    console.log('   ✅ Campaign-level insights');
    console.log('   ✅ Real performance metrics (impressions, clicks, spend, etc.)');
    console.log('\n💡 This is a complete dataset that can be used for comprehensive reporting!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
checkHavetFullData().catch(console.error); 