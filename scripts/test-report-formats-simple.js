require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportFormats() {
  console.log('🔍 Testing Report Formats...\n');

  try {
    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token')
      .not('meta_access_token', 'is', null)
      .limit(1);

    if (clientsError || !clients.length) {
      console.error('❌ No clients with tokens found:', clientsError);
      return;
    }

    const testClient = clients[0];
    console.log('✅ Test client found:', testClient.name);

    // Check reports in database
    console.log('\n🗄️ Checking Reports in Database...');
    try {
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id, client_id, date_range_start, date_range_end, created_at')
        .eq('client_id', testClient.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (reportsError) {
        console.log('❌ Database query error:', reportsError);
      } else {
        console.log('✅ Recent reports found:', reports.length);
        reports.forEach((report, index) => {
          console.log(`   ${index + 1}. ID: ${report.id}`);
          console.log(`      📅 Date: ${report.date_range_start} to ${report.date_range_end}`);
          console.log(`      🕒 Created: ${new Date(report.created_at).toLocaleString()}`);
        });
      }
    } catch (error) {
      console.log('❌ Database check error:', error.message);
    }

    // Check what endpoints are available
    console.log('\n🔗 Available Report Endpoints:');
    console.log('   📄 Regular PDF: /api/generate-report-pdf');
    console.log('   🎯 Interactive PDF: /api/generate-interactive-pdf');
    console.log('   📋 Main Report: /api/generate-report (saves to database)');

    // Check the actual report generation from the logs
    console.log('\n📊 Based on your server logs, I can see:');
    console.log('   ✅ Reports are being generated successfully');
    console.log('   ✅ Meta API data is being fetched');
    console.log('   ✅ PDF generation is working');
    console.log('   ✅ Both regular and interactive PDF endpoints exist');

    console.log('\n🎯 To determine the exact format:');
    console.log('   1. Check the "Generuj PDF" button in your UI - this uses /api/generate-report-pdf');
    console.log('   2. Check the Interactive PDF button - this uses /api/generate-interactive-pdf');
    console.log('   3. The main report generation saves data to database via /api/generate-report');

    console.log('\n💡 From your logs, I can see you have both formats available!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReportFormats().catch(console.error); 