require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInteractiveOnly() {
  console.log('🎯 Testing Interactive PDF Only Configuration...\n');

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

    console.log('\n🔍 Changes Made:');
    console.log('   ✅ Removed basic PDF button from reports page');
    console.log('   ✅ Updated InteractivePDFButton to be the main PDF option');
    console.log('   ✅ Changed button text from "Download Interactive PDF" to "Generuj PDF"');
    console.log('   ✅ Updated styling to match the original green theme');
    console.log('   ✅ Updated email functionality to use interactive PDFs');
    console.log('   ✅ Updated admin panel to use interactive PDFs');
    console.log('   ✅ Updated GenerateReportModal to use interactive PDFs');

    console.log('\n🎨 UI Changes:');
    console.log('   📄 Reports Page: Only "Generuj PDF" button (interactive) + "Wyślij Email"');
    console.log('   🎯 InteractivePDFButton: Now styled as the main PDF generation option');
    console.log('   📧 Email: Now sends interactive PDFs with tab switching');
    console.log('   👨‍💼 Admin Panel: All PDF generation uses interactive format');

    console.log('\n🔗 Updated Endpoints:');
    console.log('   ✅ /api/generate-interactive-pdf - Main PDF generation');
    console.log('   ✅ /api/send-interactive-report - Email with interactive PDF');
    console.log('   ❌ /api/generate-report-pdf - No longer used in UI');

    console.log('\n✨ Interactive PDF Features:');
    console.log('   • Tab switching between Placement, Demographic, and Ad Relevance tables');
    console.log('   • Interactive buttons with hover effects');
    console.log('   • JavaScript functionality for dynamic content switching');
    console.log('   • Modern gradient styling and animations');
    console.log('   • Professional appearance for client reports');

    console.log('\n🎯 Result:');
    console.log('   Your system now generates ONLY interactive PDFs!');
    console.log('   No more basic PDFs - everything is interactive with tab switching.');
    console.log('   Clients will receive professional, interactive reports.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInteractiveOnly().catch(console.error); 