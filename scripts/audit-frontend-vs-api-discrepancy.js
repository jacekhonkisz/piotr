// Comprehensive audit to understand discrepancy between frontend and API data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditFrontendVsAPIDiscrepancy() {
  console.log('🔍 Comprehensive Audit: Frontend vs API Data Discrepancy\n');

  try {
    // 1. Get client data
    console.log('📋 Step 1: Getting client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at, ad_account_id, meta_access_token')
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientError);
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at,
      ad_account_id: client.ad_account_id,
      hasToken: !!client.meta_access_token
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found');
      return;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // 2. Test specific months that show discrepancy
    console.log('\n📅 Step 2: Testing specific months with discrepancy...');
    
    const testMonths = [
      { year: 2024, month: 2, name: 'February 2024' }, // Shows 0 in frontend, but we found 24.91 PLN
      { year: 2024, month: 4, name: 'April 2024' }     // Shows 247 PLN in frontend
    ];

    for (const monthInfo of testMonths) {
      console.log(`\n🔍 Testing ${monthInfo.name}...`);
      
      // Method 1: Direct Meta API call (like our test script)
      console.log(`📡 Method 1: Direct Meta API call for ${monthInfo.name}...`);
      const startDate = `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}-01`;
      const endDate = new Date(monthInfo.year, monthInfo.month, 0).toISOString().split('T')[0];
      
      const directApiUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${startDate}","until":"${endDate}"}&level=campaign`;
      
      try {
        const directResponse = await fetch(directApiUrl);
        const directData = await directResponse.json();
        
        if (directData.data && directData.data.length > 0) {
          const totalSpend = directData.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
          console.log(`✅ Direct API - ${monthInfo.name}: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Campaigns:`, directData.data.map(c => ({
            name: c.campaign_name,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks
          })));
        } else {
          console.log(`⚠️ Direct API - ${monthInfo.name}: No data`);
        }
      } catch (error) {
        console.log(`❌ Direct API error for ${monthInfo.name}:`, error.message);
      }

      // Method 2: Simulate frontend API call (with time_increment=1 for daily breakdown)
      console.log(`📡 Method 2: Frontend-style API call for ${monthInfo.name}...`);
      const frontendApiUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=1&level=campaign`;
      
      try {
        const frontendResponse = await fetch(frontendApiUrl);
        const frontendData = await frontendResponse.json();
        
        if (frontendData.data && frontendData.data.length > 0) {
          // Group by campaign and aggregate daily data (like the frontend does)
          const campaignMap = new Map();
          
          frontendData.data.forEach(insight => {
            const campaignId = insight.campaign_id;
            if (!campaignMap.has(campaignId)) {
              campaignMap.set(campaignId, {
                campaign_id: campaignId,
                campaign_name: insight.campaign_name || 'Unknown Campaign',
                impressions: 0,
                clicks: 0,
                spend: 0,
                conversions: 0
              });
            }
            
            const campaign = campaignMap.get(campaignId);
            campaign.impressions += parseInt(insight.impressions) || 0;
            campaign.clicks += parseInt(insight.clicks) || 0;
            campaign.spend += parseFloat(insight.spend) || 0;
            campaign.conversions += parseInt(insight.conversions) || 0;
          });
          
          const aggregatedCampaigns = Array.from(campaignMap.values());
          const totalSpend = aggregatedCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
          
          console.log(`✅ Frontend-style API - ${monthInfo.name}: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Aggregated campaigns:`, aggregatedCampaigns.map(c => ({
            name: c.campaign_name,
            spend: c.spend.toFixed(2),
            impressions: c.impressions,
            clicks: c.clicks
          })));
        } else {
          console.log(`⚠️ Frontend-style API - ${monthInfo.name}: No data`);
        }
      } catch (error) {
        console.log(`❌ Frontend-style API error for ${monthInfo.name}:`, error.message);
      }

      // Method 3: Test with monthly insights method (like the backend uses)
      console.log(`📡 Method 3: Monthly insights method for ${monthInfo.name}...`);
      const monthlyApiUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=30&level=campaign`;
      
      try {
        const monthlyResponse = await fetch(monthlyApiUrl);
        const monthlyData = await monthlyResponse.json();
        
        if (monthlyData.data && monthlyData.data.length > 0) {
          const totalSpend = monthlyData.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0);
          console.log(`✅ Monthly insights API - ${monthInfo.name}: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Campaigns:`, monthlyData.data.map(c => ({
            name: c.campaign_name,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks
          })));
        } else {
          console.log(`⚠️ Monthly insights API - ${monthInfo.name}: No data`);
        }
      } catch (error) {
        console.log(`❌ Monthly insights API error for ${monthInfo.name}:`, error.message);
      }

      // Small delay between months
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Test the exact date ranges that the frontend uses
    console.log('\n📅 Step 3: Testing exact frontend date ranges...');
    
    const frontendDateRanges = [
      {
        name: 'February 2024 (Frontend)',
        start: '2024-02-01',
        end: '2024-02-29', // February 2024 was a leap year
        expectedFrontend: '0 PLN',
        expectedAPI: '24.91 PLN'
      },
      {
        name: 'April 2024 (Frontend)',
        start: '2024-04-01', 
        end: '2024-04-30',
        expectedFrontend: '247 PLN',
        expectedAPI: 'Unknown'
      }
    ];

    for (const range of frontendDateRanges) {
      console.log(`\n🔍 Testing ${range.name}...`);
      console.log(`📅 Date range: ${range.start} to ${range.end}`);
      console.log(`🎯 Expected frontend: ${range.expectedFrontend}`);
      console.log(`🎯 Expected API: ${range.expectedAPI}`);
      
      const testUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${range.start}","until":"${range.end}"}&time_increment=1&level=campaign`;
      
      try {
        const response = await fetch(testUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          // Aggregate like the frontend does
          const campaignMap = new Map();
          
          data.data.forEach(insight => {
            const campaignId = insight.campaign_id;
            if (!campaignMap.has(campaignId)) {
              campaignMap.set(campaignId, {
                campaign_id: campaignId,
                campaign_name: insight.campaign_name || 'Unknown Campaign',
                impressions: 0,
                clicks: 0,
                spend: 0,
                conversions: 0
              });
            }
            
            const campaign = campaignMap.get(campaignId);
            campaign.impressions += parseInt(insight.impressions) || 0;
            campaign.clicks += parseInt(insight.clicks) || 0;
            campaign.spend += parseFloat(insight.spend) || 0;
            campaign.conversions += parseInt(insight.conversions) || 0;
          });
          
          const aggregatedCampaigns = Array.from(campaignMap.values());
          const totalSpend = aggregatedCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
          
          console.log(`✅ Actual result: ${totalSpend.toFixed(2)} PLN`);
          console.log(`   Campaigns found: ${aggregatedCampaigns.length}`);
          
          if (Math.abs(totalSpend - parseFloat(range.expectedFrontend.replace(' PLN', ''))) > 0.01) {
            console.log(`⚠️ DISCREPANCY DETECTED! Frontend shows ${range.expectedFrontend} but API returns ${totalSpend.toFixed(2)} PLN`);
          } else {
            console.log(`✅ Results match expected frontend value`);
          }
        } else {
          console.log(`⚠️ No data found for ${range.name}`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${range.name}:`, error.message);
      }
    }

    // 4. Summary and analysis
    console.log('\n📊 Step 4: Analysis Summary...');
    console.log('🔍 Key findings:');
    console.log('- Direct API calls vs Frontend API calls may use different parameters');
    console.log('- Time increment settings affect data aggregation');
    console.log('- Date range boundaries may differ between methods');
    console.log('- Campaign filtering or status may affect results');
    
    console.log('\n💡 Recommendations:');
    console.log('1. Standardize API call parameters across all methods');
    console.log('2. Ensure consistent date range handling');
    console.log('3. Verify campaign status filtering');
    console.log('4. Check for caching differences');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditFrontendVsAPIDiscrepancy(); 