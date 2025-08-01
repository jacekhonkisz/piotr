require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDifferentDateRange() {
  try {
    console.log('🔍 Testing generate-report with different date range...\n');
    
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
    
    // Test with a different date range (2024-02-01 to 2024-02-29)
    const testDateRange = {
      start: '2024-02-01',
      end: '2024-02-29'
    };
    
    console.log(`🧪 Testing with date range: ${testDateRange.start} to ${testDateRange.end}`);
    
    // Test the API
    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: testDateRange
      })
    });
    
    console.log('📡 API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
    } else {
      const data = await response.json();
      console.log('✅ API Success!');
      console.log('📊 Report Summary:');
      console.log(`   - Report ID: ${data.report.id}`);
      console.log(`   - Date Range: ${data.report.date_range.start} to ${data.report.date_range.end}`);
      console.log(`   - Generation Time: ${data.report.generation_time_ms}ms`);
      console.log(`   - Campaigns: ${data.report.campaign_count}`);
      console.log(`   - Total Spend: $${data.report.account_summary.total_spend}`);
      console.log(`   - Total Impressions: ${data.report.account_summary.total_impressions}`);
      console.log(`   - Total Clicks: ${data.report.account_summary.total_clicks}`);
    }
    
  } catch (error) {
    console.error('💥 Error testing different date range:', error);
  }
}

// Run the test
testDifferentDateRange(); 