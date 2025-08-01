require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSentReports() {
  console.log('🧪 Testing Sent Reports functionality...\n');

  try {
    // 1. Check if sent_reports table exists
    console.log('1. Checking sent_reports table...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('sent_reports')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing sent_reports table:', tableError.message);
      return;
    }
    console.log('✅ sent_reports table exists and is accessible\n');

    // 2. Get all sent reports
    console.log('2. Fetching all sent reports...');
    const { data: sentReports, error: fetchError } = await supabase
      .from('sent_reports')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          company
        ),
        reports (
          id,
          date_range_start,
          date_range_end
        )
      `)
      .order('sent_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching sent reports:', fetchError.message);
      return;
    }

    console.log(`✅ Found ${sentReports.length} sent reports\n`);

    // 3. Display sample data
    if (sentReports.length > 0) {
      console.log('3. Sample sent report data:');
      const sample = sentReports[0];
      console.log({
        id: sample.id,
        clientName: sample.clients?.name,
        clientEmail: sample.clients?.email,
        reportPeriod: sample.report_period,
        sentAt: sample.sent_at,
        status: sample.status,
        fileSizeBytes: sample.file_size_bytes
      });
      console.log('');
    }

    // 4. Test grouping by date
    console.log('4. Testing grouping by date...');
    const groupedByDate = {};
    sentReports.forEach(report => {
      const sentDate = new Date(report.sent_at);
      const dateKey = sentDate.toLocaleDateString('pl-PL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(report);
    });

    console.log('✅ Grouped by date:');
    Object.entries(groupedByDate).forEach(([date, reports]) => {
      console.log(`   ${date}: ${reports.length} reports`);
    });
    console.log('');

    // 5. Test grouping by client
    console.log('5. Testing grouping by client...');
    const groupedByClient = {};
    sentReports.forEach(report => {
      const clientName = report.clients?.name || 'Unknown Client';
      
      if (!groupedByClient[clientName]) {
        groupedByClient[clientName] = [];
      }
      groupedByClient[clientName].push(report);
    });

    console.log('✅ Grouped by client:');
    Object.entries(groupedByClient).forEach(([client, reports]) => {
      console.log(`   ${client}: ${reports.length} reports`);
    });
    console.log('');

    // 6. Test 12-month filter
    console.log('6. Testing 12-month filter...');
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const { data: recentReports, error: recentError } = await supabase
      .from('sent_reports')
      .select('*')
      .gte('sent_at', twelveMonthsAgo.toISOString())
      .order('sent_at', { ascending: false });

    if (recentError) {
      console.error('❌ Error fetching recent reports:', recentError.message);
      return;
    }

    console.log(`✅ Found ${recentReports.length} reports in last 12 months\n`);

    // 7. Test status distribution
    console.log('7. Testing status distribution...');
    const statusCounts = {};
    sentReports.forEach(report => {
      statusCounts[report.status] = (statusCounts[report.status] || 0) + 1;
    });

    console.log('✅ Status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} reports`);
    });
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Total sent reports: ${sentReports.length}`);
    console.log(`   - Reports in last 12 months: ${recentReports.length}`);
    console.log(`   - Date groups: ${Object.keys(groupedByDate).length}`);
    console.log(`   - Client groups: ${Object.keys(groupedByClient).length}`);
    console.log(`   - Status types: ${Object.keys(statusCounts).length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSentReports(); 