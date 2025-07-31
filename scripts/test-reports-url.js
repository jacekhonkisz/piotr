const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportsURL() {
  try {
    console.log('🔍 Testing reports URL for jacek...\n');

    // Get jacek's client data
    const { data: jacek, error: jacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'jacek')
      .single();

    if (jacekError || !jacek) {
      console.error('❌ jacek not found:', jacekError);
      return;
    }

    console.log('✅ jacek client data:');
    console.log(`   Name: "${jacek.name}"`);
    console.log(`   Email: "${jacek.email}"`);
    console.log(`   ID: "${jacek.id}"`);

    // Generate the correct URL for viewing jacek's reports
    const reportsURL = `http://localhost:3000/reports?clientId=${jacek.id}`;
    
    console.log('\n🌐 Correct URL for jacek\'s reports:');
    console.log(reportsURL);
    
    console.log('\n📋 Instructions:');
    console.log('1. Open the above URL in your browser');
    console.log('2. This will ensure you\'re viewing jacek\'s specific reports');
    console.log('3. Generate a PDF from this page');
    console.log('4. The PDF should show "jacek" instead of "TechCorp Solutions"');

    // Also show the admin client details URL
    const adminClientURL = `http://localhost:3000/admin/clients/${jacek.id}`;
    
    console.log('\n👨‍💼 Admin view URL:');
    console.log(adminClientURL);
    console.log('This page also has PDF generation functionality');

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error testing reports URL:', error);
  }
}

testReportsURL(); 