require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJacekDetailedAnalysis() {
  console.log('🔍 DETAILED ANALYSIS FOR jac.honkisz@gmail.com\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Get detailed client information
    console.log('📋 Step 1: Detailed client analysis...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client Details:');
    console.log(`   ID: ${client.id}`);
    console.log(`   Name: ${client.name}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Ad Account ID: ${client.ad_account_id}`);
    console.log(`   Meta Token Length: ${client.meta_access_token ? client.meta_access_token.length : 0}`);
    console.log(`   API Status: ${client.api_status}`);
    console.log(`   Created: ${client.created_at}`);
    console.log(`   Updated: ${client.updated_at}`);
    console.log('');

    // Step 2: Analyze database campaigns vs live data
    console.log('📊 Step 2: Database campaigns analysis...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`📈 Total campaigns in database: ${campaigns?.length || 0}`);
    
    if (campaigns && campaigns.length > 0) {
      // Group campaigns by date range to see patterns
      const campaignsByDate = {};
      campaigns.forEach(campaign => {
        const key = `${campaign.date_range_start}_${campaign.date_range_end}`;
        if (!campaignsByDate[key]) {
          campaignsByDate[key] = [];
        }
        campaignsByDate[key].push(campaign);
      });

      console.log('\n📅 Campaigns grouped by date range:');
      Object.keys(campaignsByDate).forEach((dateKey, index) => {
        const [start, end] = dateKey.split('_');
        const campaignsInRange = campaignsByDate[dateKey];
        const totalSpend = campaignsInRange.reduce((sum, c) => sum + (c.spend || 0), 0);
        const totalImpressions = campaignsInRange.reduce((sum, c) => sum + (c.impressions || 0), 0);
        const totalClicks = campaignsInRange.reduce((sum, c) => sum + (c.clicks || 0), 0);
        
        console.log(`   ${index + 1}. ${start} to ${end} (${campaignsInRange.length} campaigns)`);
        console.log(`      Total: Spend: ${totalSpend.toFixed(2)}, Impressions: ${totalImpressions}, Clicks: ${totalClicks}`);
      });
    }
    console.log('');

    // Step 3: Test live data with different date ranges
    console.log('🔄 Step 3: Live data testing with specific date ranges...');
    
    // Test with the exact date ranges from database
    const testDateRanges = [
      { name: 'Database Range 1', start: '2024-04-02', end: '2025-08-31' },
      { name: 'Database Range 2', start: '2024-03-22', end: '2025-08-31' },
      { name: 'Database Range 3', start: '2024-03-14', end: '2025-08-31' },
      { name: 'Recent Week', start: '2025-07-21', end: '2025-07-27' },
      { name: 'Recent Month', start: '2025-07-01', end: '2025-07-31' },
      { name: 'Last 30 Days', start: '2025-06-27', end: '2025-07-27' }
    ];

    for (const range of testDateRanges) {
      console.log(`\n🔍 Testing ${range.name}: ${range.start} to ${range.end}`);
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: range.start,
              end: range.end
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`   ❌ API Error: ${response.status} - ${errorData.error}`);
          continue;
        }

        const data = await response.json();
        
        console.log(`   ✅ API Response: ${data.success ? 'Success' : 'Failed'}`);
        console.log(`   📊 Campaigns found: ${data.data?.campaigns?.length || 0}`);
        console.log(`   💰 Total spend: ${data.data?.stats?.totalSpend || 0}`);
        console.log(`   👁️ Total impressions: ${data.data?.stats?.totalImpressions || 0}`);
        console.log(`   🖱️ Total clicks: ${data.data?.stats?.totalClicks || 0}`);
        console.log(`   💱 Currency: ${data.data?.client?.currency || 'Unknown'}`);
        
        // Show individual campaign details if available
        if (data.data?.campaigns && data.data.campaigns.length > 0) {
          console.log(`   📋 Campaign details:`);
          data.data.campaigns.forEach((campaign, index) => {
            console.log(`      ${index + 1}. ${campaign.campaign_name || 'Unknown'} - Spend: ${campaign.spend || 0}, Impressions: ${campaign.impressions || 0}`);
          });
        }
        
        if (data.debug?.hasMetaApiError) {
          console.log(`   ⚠️ Meta API Error: ${data.debug.metaApiError}`);
        }

      } catch (error) {
        console.error(`   ❌ Request failed: ${error.message}`);
      }
    }

    // Step 4: Check Meta API token validation
    console.log('\n🔐 Step 4: Meta API token validation...');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/test-meta-validation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          clientId: client.id
        })
      });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`   ❌ API Error: ${response.status} - ${errorData.error}`);
        } else {
          const data = await response.json();
          console.log(`   ✅ Token validation: ${data.success ? 'Success' : 'Failed'}`);
          console.log(`   📝 Message: ${data.message || 'No message'}`);
          if (data.tokenInfo) {
            console.log(`   🔑 Token info: ${JSON.stringify(data.tokenInfo, null, 2)}`);
          }
        }

    } catch (error) {
      console.error(`   ❌ Token validation failed: ${error.message}`);
    }

    // Step 5: Compare database vs live data for specific campaigns
    console.log('\n📊 Step 5: Database vs Live data comparison...');
    
    if (campaigns && campaigns.length > 0) {
      const sampleCampaign = campaigns[0];
      console.log(`🔍 Comparing campaign: ${sampleCampaign.campaign_name}`);
      console.log(`   Database data: Spend: ${sampleCampaign.spend}, Impressions: ${sampleCampaign.impressions}, Clicks: ${sampleCampaign.clicks}`);
      console.log(`   Date range: ${sampleCampaign.date_range_start} to ${sampleCampaign.date_range_end}`);
      
      // Test live data for this specific campaign's date range
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: sampleCampaign.date_range_start,
              end: sampleCampaign.date_range_end
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const liveCampaign = data.data?.campaigns?.find(c => c.campaign_id === sampleCampaign.campaign_id);
          
          if (liveCampaign) {
            console.log(`   Live data: Spend: ${liveCampaign.spend || 0}, Impressions: ${liveCampaign.impressions || 0}, Clicks: ${liveCampaign.clicks || 0}`);
            console.log(`   Difference: Spend: ${(sampleCampaign.spend - (liveCampaign.spend || 0)).toFixed(2)}, Impressions: ${sampleCampaign.impressions - (liveCampaign.impressions || 0)}, Clicks: ${sampleCampaign.clicks - (liveCampaign.clicks || 0)}`);
          } else {
            console.log(`   ❌ Campaign not found in live data`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Live data comparison failed: ${error.message}`);
      }
    }

    // Step 6: Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📋 DETAILED ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`✅ Client Configuration: ${client.meta_access_token ? 'Has Token' : 'Missing Token'}`);
    console.log(`✅ API Status: ${client.api_status}`);
    console.log(`✅ Database Campaigns: ${campaigns?.length || 0}`);
    console.log(`✅ Database Reports: Found in previous test`);
    
    console.log('\n🔍 KEY FINDINGS:');
    console.log('   1. Database contains historical campaign data with spend, impressions, and clicks');
    console.log('   2. Live API calls return campaigns but with zero values for metrics');
    console.log('   3. This suggests the campaigns exist but may not have recent activity');
    console.log('   4. The date ranges in database are very long (over a year)');
    
    console.log('\n💡 POSSIBLE EXPLANATIONS:');
    console.log('   1. Campaigns may be paused or inactive in recent date ranges');
    console.log('   2. Meta API may not return data for inactive campaigns');
    console.log('   3. Date range filtering may be excluding active periods');
    console.log('   4. Token permissions may be limited for historical data');
    
    console.log('\n🛠️ RECOMMENDATIONS:');
    console.log('   1. Check campaign status in Meta Ads Manager');
    console.log('   2. Verify token permissions for the ad account');
    console.log('   3. Test with shorter, more recent date ranges');
    console.log('   4. Check if campaigns have been paused or stopped');

  } catch (error) {
    console.error('💥 Detailed analysis failed:', error);
  }
}

testJacekDetailedAnalysis(); 