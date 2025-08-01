require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJulySpecificData() {
  try {
    console.log('🔍 Testing July-specific data generation...\n');
    
    // Get the TechCorp client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();
    
    if (clientError || !client) {
      console.error('❌ TechCorp client not found:', clientError);
      return;
    }
    
    // Get admin user for testing
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ No admin users found');
      return;
    }
    
    const user = users[0];
    
    // Create session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: 'password123'
    });
    
    if (sessionError || !session) {
      console.error('❌ Failed to create session:', sessionError);
      return;
    }
    
    // Test with July 2024 date range
    const julyDateRange = {
      start: '2024-07-01',
      end: '2024-07-31'
    };
    
    console.log(`🧪 Testing July 2024 date range: ${julyDateRange.start} to ${julyDateRange.end}`);
    console.log('💡 This should generate fresh data for July specifically, not return full year data\n');
    
    // Test the API
    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: julyDateRange
      })
    });
    
    console.log('📡 API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
    } else {
      const data = await response.json();
      console.log('✅ API Success!');
      console.log('📊 Report Details:');
      console.log(`   - Report ID: ${data.report.id}`);
      console.log(`   - Date Range: ${data.report.date_range.start} to ${data.report.date_range.end}`);
      console.log(`   - Generated At: ${data.report.generated_at}`);
      console.log(`   - Generation Time: ${data.report.generation_time_ms}ms`);
      console.log(`   - Campaigns: ${data.report.campaign_count}`);
      console.log(`   - Is Existing Report: ${data.report.is_existing ? '✅ Yes' : '❌ No'}`);
      
      console.log('\n📈 Account Summary:');
      console.log(`   - Total Spend: $${data.report.account_summary.total_spend}`);
      console.log(`   - Total Impressions: ${data.report.account_summary.total_impressions}`);
      console.log(`   - Total Clicks: ${data.report.account_summary.total_clicks}`);
      console.log(`   - Average CTR: ${data.report.account_summary.average_ctr.toFixed(2)}%`);
      console.log(`   - Average CPC: $${data.report.account_summary.average_cpc.toFixed(2)}`);
      console.log(`   - Active Campaigns: ${data.report.account_summary.active_campaigns}`);
      console.log(`   - Total Campaigns: ${data.report.account_summary.total_campaigns}`);
      
      // Check if this is July-specific data
      const isJulyData = data.report.date_range.start === '2024-07-01' && data.report.date_range.end === '2024-07-31';
      
      if (isJulyData) {
        console.log('\n🎉 SUCCESS: July-specific data was generated!');
        console.log('💡 The frequency and other metrics should now be specific to July 2024 only');
      } else {
        console.log('\n⚠️  WARNING: Data is not July-specific');
        console.log('💡 The date range does not match July 2024');
      }
      
      // Check the database to see what was actually stored
      console.log('\n🔍 Checking database for stored data...');
      const { data: storedReport, error: storedError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', data.report.id)
        .single();
      
      if (storedError) {
        console.error('❌ Error fetching stored report:', storedError);
      } else {
        console.log('📋 Stored Report:');
        console.log(`   - Date Range: ${storedReport.date_range_start} to ${storedReport.date_range_end}`);
        console.log(`   - Generated: ${storedReport.generated_at}`);
        
        // Get stored campaigns
        const { data: storedCampaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', client.id)
          .eq('date_range_start', storedReport.date_range_start)
          .eq('date_range_end', storedReport.date_range_end);
        
        if (campaignsError) {
          console.error('❌ Error fetching stored campaigns:', campaignsError);
        } else {
          console.log(`\n📊 Stored Campaigns (${storedCampaigns.length}):`);
          storedCampaigns.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.campaign_name}`);
            console.log(`      - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
            console.log(`      - Frequency: ${campaign.frequency || 'N/A'}`);
            console.log(`      - Reach: ${campaign.reach || 'N/A'}`);
            console.log(`      - Spend: $${campaign.spend}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Error testing July-specific data:', error);
  }
}

// Run the test
testJulySpecificData(); 