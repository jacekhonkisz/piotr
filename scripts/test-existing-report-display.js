require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExistingReportDisplay() {
  try {
    console.log('🔍 Testing existing report display functionality...\n');
    
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
    
    // Test with a date range that already has a report (2024-01-01 to 2024-12-31)
    const existingDateRange = {
      start: '2024-01-01',
      end: '2024-12-31'
    };
    
    console.log(`🧪 Testing with existing date range: ${existingDateRange.start} to ${existingDateRange.end}`);
    console.log('💡 This should return the existing report instead of an error\n');
    
    // Test the API
    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: existingDateRange
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
      
      if (data.report.is_existing) {
        console.log('\n🎉 SUCCESS: Existing report was retrieved instead of showing an error!');
        console.log('📈 Account Summary:');
        console.log(`   - Total Spend: $${data.report.account_summary.total_spend}`);
        console.log(`   - Total Impressions: ${data.report.account_summary.total_impressions}`);
        console.log(`   - Total Clicks: ${data.report.account_summary.total_clicks}`);
        console.log(`   - Average CTR: ${data.report.account_summary.average_ctr.toFixed(2)}%`);
        console.log(`   - Average CPC: $${data.report.account_summary.average_cpc.toFixed(2)}`);
        console.log(`   - Active Campaigns: ${data.report.account_summary.active_campaigns}`);
        console.log(`   - Total Campaigns: ${data.report.account_summary.total_campaigns}`);
      } else {
        console.log('\n⚠️  WARNING: Report was generated as new instead of retrieving existing');
      }
    }
    
  } catch (error) {
    console.error('💥 Error testing existing report display:', error);
  }
}

// Run the test
testExistingReportDisplay(); 