require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEmailLogsRealData() {
  console.log('🧪 Testing Email Logs Real Data Implementation...\n');

  try {
    // Test 1: Check if email_logs table exists and has data
    console.log('1. Checking email_logs table structure and data...');
    
    const { data: emailLogs, error: emailLogsError } = await supabase
      .from('email_logs')
      .select('*')
      .limit(5);

    if (emailLogsError) {
      console.log('   ❌ Error accessing email_logs table:', emailLogsError.message);
    } else {
      console.log(`   ✅ email_logs table accessible (${emailLogs.length} records found)`);
      
      if (emailLogs.length > 0) {
        console.log('   📋 Sample email log record:');
        console.log('   ', JSON.stringify(emailLogs[0], null, 2));
      }
    }

    // Test 2: Test the full query with joins (like the frontend does)
    console.log('\n2. Testing full query with joins...');
    
    const { data: fullQuery, error: fullQueryError } = await supabase
      .from('email_logs')
      .select(`
        *,
        reports (
          client_id,
          clients (
            id,
            name,
            email
          )
        )
      `)
      .order('sent_at', { ascending: false })
      .limit(3);

    if (fullQueryError) {
      console.log('   ❌ Error with full query:', fullQueryError.message);
    } else {
      console.log(`   ✅ Full query successful (${fullQuery.length} records)`);
      
      if (fullQuery.length > 0) {
        console.log('   📋 Sample full query result:');
        console.log('   ', JSON.stringify(fullQuery[0], null, 2));
      }
    }

    // Test 3: Check if there are any reports to join with
    console.log('\n3. Checking reports table for join data...');
    
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select(`
        id,
        client_id,
        clients (
          id,
          name,
          email
        )
      `)
      .limit(3);

    if (reportsError) {
      console.log('   ❌ Error accessing reports table:', reportsError.message);
    } else {
      console.log(`   ✅ Reports table accessible (${reports.length} records)`);
      
      if (reports.length > 0) {
        console.log('   📋 Sample report with client:');
        console.log('   ', JSON.stringify(reports[0], null, 2));
      }
    }

    // Test 4: Check if email_logs have report_id values
    console.log('\n4. Checking email_logs report_id values...');
    
    const { data: emailLogsWithReports, error: reportIdError } = await supabase
      .from('email_logs')
      .select('id, report_id, recipient_email')
      .not('report_id', 'is', null)
      .limit(5);

    if (reportIdError) {
      console.log('   ❌ Error checking report_id:', reportIdError.message);
    } else {
      console.log(`   ✅ Found ${emailLogsWithReports.length} email logs with report_id`);
      
      if (emailLogsWithReports.length > 0) {
        console.log('   📋 Sample email log with report_id:');
        console.log('   ', JSON.stringify(emailLogsWithReports[0], null, 2));
      }
    }

    console.log('\n✅ Email Logs Real Data Test Complete!');
    
    if (emailLogs.length === 0) {
      console.log('\n⚠️  Note: No email logs found in database. This is normal if no emails have been sent yet.');
      console.log('   The implementation will work once emails are sent through the system.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEmailLogsRealData(); 