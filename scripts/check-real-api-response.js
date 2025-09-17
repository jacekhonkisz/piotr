const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRealAPIResponse() {
  console.log('🔍 CHECKING REAL API RESPONSE...\n');

  try {
    // Get jacek's client data
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

    // Test the API with different date ranges
    const testRanges = [
      { name: 'March 2024', start: '2024-03-01', end: '2024-03-31' },
      { name: 'April 2024', start: '2024-04-01', end: '2024-04-30' },
      { name: 'February 2024', start: '2024-02-01', end: '2024-02-29' },
      { name: 'Current Month', start: '2024-12-01', end: '2024-12-31' }
    ];

    for (const range of testRanges) {
      console.log(`\n📅 Testing ${range.name} (${range.start} to ${range.end})...`);
      
      try {
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-for-pdf-generation'
          },
          body: JSON.stringify({
            dateRange: {
              start: range.start,
              end: range.end
            },
            clientId: jacek.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${range.name} API Response:`);
          console.log(`   Success: ${data.success}`);
          console.log(`   Campaigns: ${data.data?.campaigns?.length || 0}`);
          console.log(`   Total Spend: ${data.data?.stats?.totalSpend || 0} zł`);
          console.log(`   Total Impressions: ${data.data?.stats?.totalImpressions || 0}`);
          console.log(`   Total Clicks: ${data.data?.stats?.totalClicks || 0}`);
          
          if (data.data?.campaigns?.length > 0) {
            console.log(`   First campaign: ${data.data.campaigns[0].campaign_name} - ${data.data.campaigns[0].spend} zł`);
          }
        } else {
          console.log(`❌ ${range.name} API failed: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${range.name} API error: ${error.message}`);
      }
    }

    // Also check what happens when we query the database directly for a single date range
    console.log('\n🔍 Checking database for single date range (2024-03-01 to 2024-05-01)...');
    
    const { data: singleRangeCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('date_range_start', '2024-03-01')
      .eq('date_range_end', '2024-05-01');

    if (singleRangeCampaigns && singleRangeCampaigns.length > 0) {
      const spend = singleRangeCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const impressions = singleRangeCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const clicks = singleRangeCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log(`📊 Single date range totals:`);
      console.log(`   Campaigns: ${singleRangeCampaigns.length}`);
      console.log(`   Spend: ${spend.toFixed(2)} zł`);
      console.log(`   Impressions: ${impressions.toLocaleString()}`);
      console.log(`   Clicks: ${clicks.toLocaleString()}`);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkRealAPIResponse(); 