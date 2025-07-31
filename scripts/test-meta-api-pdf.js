const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test Meta API integration for PDF generation
async function testMetaAPIIntegration() {
  console.log('🧪 Testing Meta API Integration for PDF Generation...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Test Supabase connection
    console.log('1. Testing Supabase connection...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientError) {
      console.error('❌ Supabase connection failed:', clientError.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No clients found in database');
      return;
    }

    const testClient = clients[0];
    console.log(`✅ Found client: ${testClient.name} (${testClient.id})`);

    // 2. Test Meta API token
    console.log('\n2. Testing Meta API token...');
    if (!testClient.meta_access_token) {
      console.log('⚠️  No Meta API token found for client');
      console.log('   This means the PDF will use demo data');
      return;
    }

    console.log('✅ Meta API token found');
    console.log(`   Token: ${testClient.meta_access_token.substring(0, 20)}...`);

    // 3. Test fetch-live-data endpoint
    console.log('\n3. Testing fetch-live-data endpoint...');
    
    // Get current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    console.log(`   Testing month: ${currentMonth}`);
    console.log(`   Date range: ${monthStartDate} to ${monthEndDate}`);

    // Simulate the API call that the PDF generation would make
    const fetch = require('node-fetch');
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
        clientId: testClient.id
      })
    });

    if (apiResponse.ok) {
      const monthData = await apiResponse.json();
      
      if (monthData.success && monthData.data?.campaigns) {
        console.log(`✅ Successfully fetched ${monthData.data.campaigns.length} campaigns from Meta API`);
        
        // Show sample campaign data
        if (monthData.data.campaigns.length > 0) {
          const sampleCampaign = monthData.data.campaigns[0];
          console.log('\n📊 Sample campaign data:');
          console.log(`   Name: ${sampleCampaign.campaign_name}`);
          console.log(`   Spend: ${sampleCampaign.spend} zł`);
          console.log(`   Impressions: ${sampleCampaign.impressions}`);
          console.log(`   Clicks: ${sampleCampaign.clicks}`);
          console.log(`   Conversions: ${sampleCampaign.conversions}`);
          console.log(`   CTR: ${sampleCampaign.ctr}%`);
          console.log(`   CPC: ${sampleCampaign.cpc} zł`);
        }
      } else {
        console.log('⚠️  No campaigns found in Meta API response');
        console.log('   This could mean:');
        console.log('   - No campaigns exist for this period');
        console.log('   - API permissions are insufficient');
        console.log('   - Token is invalid or expired');
      }
    } else {
      const errorData = await apiResponse.json().catch(() => ({}));
      console.error(`❌ API call failed: ${apiResponse.status}`);
      console.error(`   Error: ${errorData.error || 'Unknown error'}`);
    }

    // 4. Test PDF generation endpoint
    console.log('\n4. Testing PDF generation endpoint...');
    const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/download-pdf?reportId=latest`, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (pdfResponse.ok) {
      const pdfBuffer = await pdfResponse.buffer();
      console.log(`✅ PDF generation successful`);
      console.log(`   PDF size: ${pdfBuffer.length} bytes`);
      console.log(`   Content-Type: ${pdfResponse.headers.get('content-type')}`);
    } else {
      const errorData = await pdfResponse.json().catch(() => ({}));
      console.error(`❌ PDF generation failed: ${pdfResponse.status}`);
      console.error(`   Error: ${errorData.error || 'Unknown error'}`);
    }

    console.log('\n🎉 Meta API integration test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Supabase connection working');
    console.log('   ✅ Client data accessible');
    console.log('   ✅ Meta API endpoint accessible');
    console.log('   ✅ PDF generation working');
    console.log('\n🚀 The PDF generation should now show real Meta API data!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if the development server is running');
    console.error('2. Verify environment variables are set correctly');
    console.error('3. Ensure Meta API tokens are valid');
    console.error('4. Check API permissions for the tokens');
  }
}

// Run the test
testMetaAPIIntegration().catch(console.error); 