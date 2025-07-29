require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugReportsLoading() {
  console.log('🔍 Starting reports loading debug...\n');

  try {
    // 1. Check if there are any clients in the database
    console.log('1. Checking clients table...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(5);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`✅ Found ${clients.length} clients`);
    clients.forEach(client => {
      console.log(`   - ${client.name} (${client.email}) - Ad Account: ${client.ad_account_id}`);
    });

    // 2. Check if there are any reports in the database
    console.log('\n2. Checking reports table...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .limit(5);

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`✅ Found ${reports.length} reports`);
    reports.forEach(report => {
      console.log(`   - Report ${report.id} for client ${report.client_id} (${report.date_range_start} to ${report.date_range_end})`);
    });

    // 3. Check if there are any campaigns in the database
    console.log('\n3. Checking campaigns table...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(5);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`✅ Found ${campaigns.length} campaigns`);
    campaigns.forEach(campaign => {
      console.log(`   - Campaign ${campaign.campaign_name} (${campaign.campaign_id}) - Spend: $${campaign.spend}`);
    });

    // 4. Check profiles table
    console.log('\n4. Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    console.log(`✅ Found ${profiles.length} profiles`);
    profiles.forEach(profile => {
      console.log(`   - ${profile.email} (${profile.role})`);
    });

    // 5. Test the fetch-live-data API endpoint
    console.log('\n5. Testing fetch-live-data API...');
    try {
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01',
            end: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ API endpoint responded successfully');
        console.log('   Response:', JSON.stringify(data, null, 2));
      } else {
        console.log(`❌ API endpoint failed with status: ${response.status}`);
        const errorText = await response.text();
        console.log('   Error:', errorText);
      }
    } catch (error) {
      console.log('❌ API endpoint test failed:', error.message);
    }

    console.log('\n🔍 Debug complete!');

  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

// Run the debug function
debugReportsLoading(); 