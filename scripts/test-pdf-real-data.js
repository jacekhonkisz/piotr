const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFRealData() {
  console.log('🧪 Testing PDF Generation with Real Data...\n');

  try {
    // 1. Get jacek's client data
    console.log('📋 Step 1: Getting jacek client data...');
    
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client found:', {
      id: jacek.id,
      name: jacek.name,
      email: jacek.email
    });

    // 2. Test the fetch-live-data API directly (what PDF generation uses)
    console.log('\n📡 Step 2: Testing fetch-live-data API (PDF generation source)...');
    
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-pdf-generation'
      },
      body: JSON.stringify({
        dateRange: {
          start: marchStart,
          end: marchEnd
        },
        clientId: jacek.id
      })
    });

    console.log('API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ API call failed:', errorData);
      return;
    }

    const data = await response.json();
    console.log('✅ API call successful!');
    console.log('📊 Data summary:', {
      success: data.success,
      campaignCount: data.data?.campaigns?.length || 0,
      totalSpend: data.data?.stats?.totalSpend || 0,
      totalImpressions: data.data?.stats?.totalImpressions || 0,
      totalClicks: data.data?.stats?.totalClicks || 0,
      clientName: data.data?.client?.name
    });

    // 3. Check if it's real data or demo data
    console.log('\n🔍 Step 3: Analyzing data source...');
    
    if (data.data?.campaigns?.length > 0) {
      const firstCampaign = data.data.campaigns[0];
      console.log('📋 First campaign sample:', {
        campaign_name: firstCampaign.campaign_name,
        spend: firstCampaign.spend,
        impressions: firstCampaign.impressions,
        clicks: firstCampaign.clicks
      });
      
      // Check if it's demo data
      const isDemoData = firstCampaign.campaign_name === 'Summer Sale Campaign' || 
                        firstCampaign.campaign_name === 'Brand Awareness' ||
                        firstCampaign.campaign_name === 'Lead Generation';
      
      if (isDemoData) {
        console.log('⚠️ WARNING: PDF generation is still using DEMO data!');
      } else {
        console.log('✅ SUCCESS: PDF generation is using REAL data!');
      }
    }

    // 4. Test PDF generation endpoint
    console.log('\n📄 Step 4: Testing PDF generation endpoint...');
    
    const pdfResponse = await fetch('http://localhost:3000/api/generate-interactive-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-pdf-generation'
      },
      body: JSON.stringify({
        clientId: jacek.id,
        dateRange: {
          start: marchStart,
          end: marchEnd
        }
      })
    });

    console.log('PDF Generation Status:', pdfResponse.status);
    
    if (pdfResponse.ok) {
      console.log('✅ PDF generation successful!');
      console.log('📊 PDF response headers:', {
        contentType: pdfResponse.headers.get('content-type'),
        contentLength: pdfResponse.headers.get('content-length')
      });
    } else {
      const errorData = await pdfResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ PDF generation failed:', errorData);
    }

    console.log('\n🎯 Summary:');
    console.log(`   - fetch-live-data API: ${response.ok ? '✅ Success' : '❌ Failed'}`);
    console.log(`   - Data source: ${data.data?.campaigns?.length > 0 ? 'Real Data' : 'No Data'}`);
    console.log(`   - PDF generation: ${pdfResponse.ok ? '✅ Success' : '❌ Failed'}`);
    
    if (data.data?.stats?.totalSpend > 0) {
      console.log(`   - Total spend: ${data.data.stats.totalSpend} zł`);
      console.log(`   - Campaigns: ${data.data.campaigns.length}`);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testPDFRealData(); 