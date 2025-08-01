require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFEmailFunctionality() {
  console.log('🧪 Testing PDF Email Functionality...\n');

  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError) {
      throw new Error(`Database connection failed: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  No clients found in database');
      return;
    }

    const testClient = clients[0];
    console.log(`✅ Found test client: ${testClient.name} (${testClient.email})`);

    // 2. Test sent_reports table
    console.log('\n2. Testing sent_reports table...');
    const { data: sentReports, error: sentReportsError } = await supabase
      .from('sent_reports')
      .select('*')
      .eq('client_id', testClient.id)
      .limit(5);

    if (sentReportsError) {
      console.log(`⚠️  Error accessing sent_reports: ${sentReportsError.message}`);
    } else {
      console.log(`✅ Found ${sentReports?.length || 0} sent reports for client`);
    }

    // 3. Test storage bucket
    console.log('\n3. Testing storage bucket...');
    const { data: storageBuckets, error: storageError } = await supabase.storage.listBuckets();
    
    if (storageError) {
      console.log(`⚠️  Error accessing storage: ${storageError.message}`);
    } else {
      const reportsBucket = storageBuckets?.find(bucket => bucket.name === 'reports');
      if (reportsBucket) {
        console.log('✅ Reports storage bucket exists');
      } else {
        console.log('⚠️  Reports storage bucket not found');
      }
    }

    // 4. Test email logs table
    console.log('\n4. Testing email logs table...');
    
    // Try the query directly
    const { data: emailLogs, error: emailLogsError } = await supabase
      .from('email_logs')
      .select('*')
      .limit(5);

    if (emailLogsError) {
      console.log(`⚠️  Error accessing email_logs: ${emailLogsError.message}`);
      
      // Try alternative approach - check if table exists
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'email_logs');
      
      if (tablesError) {
        console.log(`⚠️  Could not check if email_logs table exists: ${tablesError.message}`);
      } else if (tables && tables.length > 0) {
        console.log('✅ Email logs table exists, but query failed');
      } else {
        console.log('❌ Email logs table does not exist');
      }
    } else {
      console.log(`✅ Found ${emailLogs?.length || 0} email logs`);
    }

    // 5. Test reports table
    console.log('\n5. Testing reports table...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', testClient.id)
      .limit(5);

    if (reportsError) {
      console.log(`⚠️  Error accessing reports: ${reportsError.message}`);
    } else {
      console.log(`✅ Found ${reports?.length || 0} reports for client`);
    }

    console.log('\n🎉 PDF Email Functionality Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`- Test Client: ${testClient.name}`);
    console.log(`- Sent Reports: ${sentReports?.length || 0}`);
    console.log(`- Email Logs: ${emailLogs?.length || 0}`);
    console.log(`- Reports: ${reports?.length || 0}`);
    console.log(`- Storage Bucket: ${storageBuckets?.find(b => b.name === 'reports') ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPDFEmailFunctionality(); 