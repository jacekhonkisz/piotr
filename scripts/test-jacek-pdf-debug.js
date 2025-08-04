const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJacekPDFDebug() {
  console.log('🔍 Testing Jacek PDF Generation Debug...\n');

  try {
    // 1. Get jacek's client data
    console.log('📋 Step 1: Getting jacek client data...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client found:', {
      id: jacek.id,
      name: jacek.name,
      email: jacek.email,
      ad_account_id: jacek.ad_account_id,
      hasMetaToken: !!jacek.meta_access_token
    });

    // 2. Test fetch-live-data API directly
    console.log('\n📡 Step 2: Testing fetch-live-data API...');
    
    // Get jacek session for API calls
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('✅ Admin session obtained');

    // Test March 2024 data
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';

    const apiResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: marchStart,
          end: marchEnd
        },
        clientId: jacek.id
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('❌ API call failed:', errorData);
      return;
    }

    const apiData = await apiResponse.json();
    console.log('✅ API response received:', {
      success: apiData.success,
      campaignCount: apiData.data?.campaigns?.length || 0,
      totalSpend: apiData.data?.stats?.totalSpend || 0,
      totalImpressions: apiData.data?.stats?.totalImpressions || 0,
      totalClicks: apiData.data?.stats?.totalClicks || 0,
      debug: apiData.debug
    });

    // 3. Test PDF generation API
    console.log('\n📄 Step 3: Testing PDF generation API...');
    
    const pdfResponse = await fetch('http://localhost:3000/api/generate-interactive-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: jacek.id,
        dateRange: {
          start: marchStart,
          end: marchEnd
        }
      })
    });

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json();
      console.error('❌ PDF generation failed:', errorData);
      return;
    }

    console.log('✅ PDF generation successful');
    console.log('📊 PDF response headers:', {
      contentType: pdfResponse.headers.get('content-type'),
      contentLength: pdfResponse.headers.get('content-length')
    });

    // 4. Check database for existing campaigns
    console.log('\n💾 Step 4: Checking database for existing campaigns...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('date_range_start', marchStart)
      .eq('date_range_end', marchEnd);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    } else {
      console.log('✅ Database campaigns found:', {
        count: campaigns?.length || 0,
        campaigns: campaigns?.map(c => ({
          id: c.id,
          campaign_name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks
        })) || []
      });
    }

    console.log('\n🎯 Summary:');
    console.log(`   - Jacek Client ID: ${jacek.id}`);
    console.log(`   - API Data Available: ${apiData.success ? 'Yes' : 'No'}`);
    console.log(`   - Campaigns in API: ${apiData.data?.campaigns?.length || 0}`);
    console.log(`   - Campaigns in DB: ${campaigns?.length || 0}`);
    console.log(`   - PDF Generation: ${pdfResponse.ok ? 'Success' : 'Failed'}`);

  } catch (error) {
    console.error('💥 Error in test:', error);
  }
}

testJacekPDFDebug(); 