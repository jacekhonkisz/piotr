require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJacekData() {
  console.log('🧪 Testing jac.honkisz@gmail.com with different date ranges...\n');

  try {
    // Get the jacek client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientsError || !clients) {
      console.log('❌ jac.honkisz@gmail.com client not found');
      return;
    }

    console.log('✅ Found jacek client:', clients.email);
    console.log('   Ad Account ID:', clients.ad_account_id);
    console.log('   API Status:', clients.api_status);
    console.log('');

    // Test different date ranges
    const dateRanges = [
      { name: 'Last 30 days', start: '2025-06-30', end: '2025-07-30' },
      { name: 'Last 60 days', start: '2025-05-31', end: '2025-07-30' },
      { name: 'Last 90 days', start: '2025-04-30', end: '2025-07-30' },
      { name: 'Last 6 months', start: '2025-01-30', end: '2025-07-30' },
      { name: 'Last year', start: '2024-07-30', end: '2025-07-30' },
      { name: 'This year', start: '2025-01-01', end: '2025-12-31' },
      { name: 'Last year', start: '2024-01-01', end: '2024-12-31' }
    ];

    for (const range of dateRanges) {
      console.log(`🔍 Testing: ${range.name} (${range.start} to ${range.end})`);
      
      // Test basic campaign insights
      const basicUrl = `https://graph.facebook.com/v18.0/act_${clients.ad_account_id}/insights?access_token=${clients.meta_access_token}&fields=campaign_name,spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: range.start, until: range.end})}&level=campaign&limit=10`;
      
      try {
        const basicResponse = await fetch(basicUrl);
        const basicData = await basicResponse.json();
        
        if (basicData.error) {
          console.log(`❌ Error: ${basicData.error.message}`);
        } else {
          console.log(`✅ Found ${basicData.data?.length || 0} campaigns`);
          if (basicData.data && basicData.data.length > 0) {
            console.log(`   Sample campaign: ${basicData.data[0].campaign_name} (Spend: ${basicData.data[0].spend})`);
          }
        }
      } catch (error) {
        console.log(`❌ Fetch error: ${error.message}`);
      }
      
      console.log('');
    }

    // Test the specific date range that should work (based on existing data)
    console.log('🎯 Testing with a specific working date range...');
    const workingUrl = `https://graph.facebook.com/v18.0/act_${clients.ad_account_id}/insights?access_token=${clients.meta_access_token}&fields=campaign_name,spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: '2025-01-01', until: '2025-12-31'})}&level=campaign&limit=5`;
    
    const workingResponse = await fetch(workingUrl);
    const workingData = await workingResponse.json();
    
    if (workingData.data && workingData.data.length > 0) {
      console.log('✅ Found data! Testing breakdowns with this date range...\n');
      
      const sampleCampaign = workingData.data[0];
      console.log('Sample campaign:', sampleCampaign);
      
      // Test publisher platform breakdown
      const platformUrl = `https://graph.facebook.com/v18.0/act_${clients.ad_account_id}/insights?access_token=${clients.meta_access_token}&fields=spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: '2025-01-01', until: '2025-12-31'})}&breakdowns=publisher_platform&level=campaign&limit=10`;
      
      const platformResponse = await fetch(platformUrl);
      const platformData = await platformResponse.json();
      
      if (platformData.error) {
        console.log('❌ Platform breakdown error:', platformData.error.message);
      } else {
        console.log('✅ Platform breakdown success:', platformData.data?.length || 0, 'records');
        if (platformData.data && platformData.data.length > 0) {
          console.log('Sample platform data:', platformData.data[0]);
        }
      }
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the test
testJacekData(); 