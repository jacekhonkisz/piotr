require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWeeklyMonthlyReports() {
  console.log('🧪 TESTING WEEKLY AND MONTHLY REPORTS FOR jac.honkisz@gmail.com\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Get jacek's client data
    console.log('📋 Step 1: Getting jacek client data...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ jac.honkisz@gmail.com client not found:', clientError);
      return;
    }

    console.log('✅ Jacek client found:');
    console.log(`   ID: ${client.id}`);
    console.log(`   Name: ${client.name}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Ad Account ID: ${client.ad_account_id}`);
    console.log(`   Meta Token: ${client.meta_access_token ? 'Present' : 'Missing'}`);
    console.log(`   API Status: ${client.api_status || 'Unknown'}`);
    console.log('');

    // Step 2: Check existing reports in database
    console.log('📊 Step 2: Checking existing reports in database...');
    
    const { data: existingReports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .order('generated_at', { ascending: false });

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`📈 Found ${existingReports?.length || 0} existing reports in database`);
    
    if (existingReports && existingReports.length > 0) {
      console.log('\n📋 Recent reports:');
      existingReports.slice(0, 5).forEach((report, index) => {
        console.log(`   ${index + 1}. ${report.report_type || 'Unknown'} - ${report.generated_at}`);
      });
    }
    console.log('');

    // Step 3: Test weekly data fetching
    console.log('📅 Step 3: Testing weekly data fetching...');
    
    const weeklyDateRanges = [
      { name: 'Last Week', start: '2025-07-21', end: '2025-07-27' },
      { name: 'Previous Week', start: '2025-07-14', end: '2025-07-20' },
      { name: 'Two Weeks Ago', start: '2025-07-07', end: '2025-07-13' }
    ];

    for (const range of weeklyDateRanges) {
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
        
        if (data.debug?.hasMetaApiError) {
          console.log(`   ⚠️ Meta API Error: ${data.debug.metaApiError}`);
        }

      } catch (error) {
        console.error(`   ❌ Request failed: ${error.message}`);
      }
    }

    // Step 4: Test monthly data fetching
    console.log('\n📅 Step 4: Testing monthly data fetching...');
    
    const monthlyDateRanges = [
      { name: 'Current Month', start: '2025-07-01', end: '2025-07-31' },
      { name: 'Previous Month', start: '2025-06-01', end: '2025-06-30' },
      { name: 'Two Months Ago', start: '2025-05-01', end: '2025-05-31' }
    ];

    for (const range of monthlyDateRanges) {
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
        
        if (data.debug?.hasMetaApiError) {
          console.log(`   ⚠️ Meta API Error: ${data.debug.metaApiError}`);
        }

      } catch (error) {
        console.error(`   ❌ Request failed: ${error.message}`);
      }
    }

    // Step 5: Test background data collection
    console.log('\n🔄 Step 5: Testing background data collection endpoints...');
    
    const backgroundEndpoints = [
      '/api/background/collect-weekly',
      '/api/background/collect-monthly'
    ];

    for (const endpoint of backgroundEndpoints) {
      console.log(`\n🔍 Testing ${endpoint}...`);
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${endpoint}`, {
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
          continue;
        }

        const data = await response.json();
        console.log(`   ✅ Background collection: ${data.success ? 'Success' : 'Failed'}`);
        console.log(`   📝 Message: ${data.message || 'No message'}`);

      } catch (error) {
        console.error(`   ❌ Request failed: ${error.message}`);
      }
    }

    // Step 6: Check campaigns table for historical data
    console.log('\n📊 Step 6: Checking campaigns table for historical data...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false })
      .limit(10);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    } else {
      console.log(`📈 Found ${campaigns?.length || 0} campaigns in database`);
      
      if (campaigns && campaigns.length > 0) {
        console.log('\n📋 Recent campaigns:');
        campaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.campaign_name || 'Unknown'} - ${campaign.date_range_start} to ${campaign.date_range_end}`);
          console.log(`      Spend: ${campaign.spend || 0}, Impressions: ${campaign.impressions || 0}, Clicks: ${campaign.clicks || 0}`);
        });
      }
    }

    // Step 7: Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`✅ Client Status: ${client.meta_access_token ? 'Has Meta Token' : 'Missing Meta Token'}`);
    console.log(`✅ API Status: ${client.api_status || 'Unknown'}`);
    console.log(`✅ Database Reports: ${existingReports?.length || 0} found`);
    console.log(`✅ Database Campaigns: ${campaigns?.length || 0} found`);
    
    if (!client.meta_access_token) {
      console.log('\n⚠️ RECOMMENDATIONS:');
      console.log('   1. Add Meta Access Token for jac.honkisz@gmail.com');
      console.log('   2. Verify ad account permissions');
      console.log('   3. Test token validity');
    } else {
      console.log('\n✅ System appears to be properly configured for jac.honkisz@gmail.com');
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testWeeklyMonthlyReports(); 