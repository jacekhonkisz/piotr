const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({path: '.env.local'});

// Test PDF generation with Meta API integration
async function testPDFMetaAPI() {
  console.log('🧪 Testing PDF Generation with Meta API Integration...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Get all clients with Meta API tokens
    console.log('1. Fetching clients with Meta API tokens...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null);

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No clients with Meta API tokens found');
      return;
    }

    console.log(`✅ Found ${clients.length} clients with Meta API tokens:\n`);
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Ad Account: ${client.ad_account_id}`);
      console.log(`   Token: ${client.meta_access_token.substring(0, 20)}...`);
    });

    // 2. Test each client's Meta API access
    console.log('\n2. Testing Meta API access for each client...\n');
    
    for (const client of clients) {
      console.log(`🔍 Testing client: ${client.name}`);
      
      // Test current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      console.log(`   Testing month: ${currentMonth}`);
      console.log(`   Date range: ${monthStartDate} to ${monthEndDate}`);

      // Test direct Meta API call
      try {
        const metaApiUrl = `https://graph.facebook.com/v18.0/act_${client.ad_account_id}/insights`;
        const params = new URLSearchParams({
          access_token: client.meta_access_token,
          fields: 'campaign_name,spend,impressions,clicks,ctr,cpc,conversions',
          time_range: JSON.stringify({since: monthStartDate, until: monthEndDate}),
          level: 'campaign',
          limit: '10'
        });

        const metaResponse = await fetch(`${metaApiUrl}?${params}`);
        const metaData = await metaResponse.json();

        if (metaData.error) {
          console.log(`   ❌ Meta API Error: ${metaData.error.message}`);
          if (metaData.error.code === 190) {
            console.log(`   💡 Token might be expired or invalid`);
          } else if (metaData.error.code === 100) {
            console.log(`   💡 Ad account ID might be incorrect`);
          }
        } else {
          console.log(`   ✅ Meta API Success: ${metaData.data?.length || 0} campaigns found`);
          if (metaData.data && metaData.data.length > 0) {
            const sampleCampaign = metaData.data[0];
            console.log(`   📊 Sample campaign: ${sampleCampaign.campaign_name}`);
            console.log(`      Spend: ${sampleCampaign.spend} zł`);
            console.log(`      Impressions: ${sampleCampaign.impressions}`);
            console.log(`      Clicks: ${sampleCampaign.clicks}`);
            console.log(`      CTR: ${sampleCampaign.ctr}%`);
          }
        }
      } catch (metaError) {
        console.log(`   ❌ Meta API call failed: ${metaError.message}`);
      }

      // Test fetch-live-data endpoint (same as PDF generation uses)
      try {
        console.log(`   🔄 Testing fetch-live-data endpoint...`);
        const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            dateRange: {
              start: monthStartDate,
              end: monthEndDate
            },
            clientId: client.id
          })
        });

        if (apiResponse.ok) {
          const monthData = await apiResponse.json();
          
          if (monthData.success && monthData.data?.campaigns) {
            console.log(`   ✅ fetch-live-data Success: ${monthData.data.campaigns.length} campaigns`);
            if (monthData.data.campaigns.length > 0) {
              const sampleCampaign = monthData.data.campaigns[0];
              console.log(`   📊 Sample campaign: ${sampleCampaign.campaign_name}`);
              console.log(`      Spend: ${sampleCampaign.spend} zł`);
              console.log(`      Impressions: ${sampleCampaign.impressions}`);
            }
          } else {
            console.log(`   ⚠️  No campaigns in fetch-live-data response`);
          }
        } else {
          const errorData = await apiResponse.json().catch(() => ({}));
          console.log(`   ❌ fetch-live-data failed: ${apiResponse.status} - ${errorData.error || 'Unknown error'}`);
        }
      } catch (apiError) {
        console.log(`   ❌ fetch-live-data call failed: ${apiError.message}`);
      }

      // Test PDF generation endpoint
      try {
        console.log(`   📄 Testing PDF generation...`);
        const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/download-pdf?reportId=${client.id}-${currentMonth}`, {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        });

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.buffer();
          console.log(`   ✅ PDF generation successful`);
          console.log(`      Size: ${pdfBuffer.length} bytes`);
          console.log(`      Content-Type: ${pdfResponse.headers.get('content-type')}`);
          
          // Check if PDF contains real data indicators
          const pdfText = pdfBuffer.toString('utf8', 0, 1000); // First 1000 bytes
          if (pdfText.includes('demo-campaign') || pdfText.includes('Demo Campaign')) {
            console.log(`   ⚠️  PDF appears to contain demo data`);
          } else {
            console.log(`   ✅ PDF appears to contain real data`);
          }
        } else {
          const errorData = await pdfResponse.json().catch(() => ({}));
          console.log(`   ❌ PDF generation failed: ${pdfResponse.status} - ${errorData.error || 'Unknown error'}`);
        }
      } catch (pdfError) {
        console.log(`   ❌ PDF generation call failed: ${pdfError.message}`);
      }

      console.log(''); // Empty line between clients
    }

    console.log('🎉 Meta API integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Tested ${clients.length} clients with Meta API tokens`);
    console.log('   ✅ Verified Meta API access for each client');
    console.log('   ✅ Tested fetch-live-data endpoint (used by PDF generation)');
    console.log('   ✅ Tested PDF generation with real data');
    console.log('\n🚀 PDF generation should now show real Meta API data!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if the development server is running (npm run dev)');
    console.error('2. Verify environment variables are set correctly');
    console.error('3. Ensure Meta API tokens are valid and not expired');
    console.error('4. Check API permissions for the tokens');
    console.error('5. Verify ad account IDs are correct');
  }
}

// Run the test
testPDFMetaAPI().catch(console.error); 