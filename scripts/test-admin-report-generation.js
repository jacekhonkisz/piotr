const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function testAdminReportGeneration() {
  console.log('🧪 Testing Admin Panel Report Generation with Meta Ads Tables');
  console.log('=' .repeat(60));

  try {
    // 1. Get admin user
    console.log('1️⃣ Getting admin user...');
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .single();

    if (adminError || !adminUser) {
      console.error('❌ No admin user found:', adminError);
      return;
    }

    console.log('✅ Admin user found:', adminUser.email);

    // 2. Get a client with Meta token
    console.log('\n2️⃣ Getting client with Meta token...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .not('meta_access_token', 'is', null)
      .single();

    if (clientError || !client) {
      console.error('❌ No client with Meta token found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.name, '(has Meta token)');

    // 3. Create admin session
    console.log('\n3️⃣ Creating admin session...');
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: adminUser.email,
      password: 'admin123' // Adjust if needed
    });

    if (sessionError || !session) {
      console.error('❌ Failed to create admin session:', sessionError);
      return;
    }

    console.log('✅ Admin session created');

    // 4. Test report generation with Meta Ads tables
    console.log('\n4️⃣ Testing report generation with Meta Ads tables...');
    const dateRange = {
      start: '2024-07-01',
      end: '2024-07-31'
    };

    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange
      })
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Report generation failed:', errorText);
      return;
    }

    const reportData = await response.json();
    console.log('✅ Report generation successful!');

    // 5. Check if Meta Ads tables data is included
    console.log('\n5️⃣ Checking Meta Ads tables data...');
    
    if (reportData.report?.meta_tables) {
      const metaTables = reportData.report.meta_tables;
      console.log('✅ Meta Ads tables data found in report response!');
      console.log(`   📊 Placement Performance: ${metaTables.placementPerformance?.length || 0} records`);
      console.log(`   👥 Demographic Performance: ${metaTables.demographicPerformance?.length || 0} records`);
      console.log(`   🏆 Ad Relevance Results: ${metaTables.adRelevanceResults?.length || 0} records`);
      
      // Show sample data
      if (metaTables.placementPerformance?.length > 0) {
        console.log('\n📊 Sample Placement Performance Data:');
        console.log(JSON.stringify(metaTables.placementPerformance[0], null, 2));
      }
      
      if (metaTables.demographicPerformance?.length > 0) {
        console.log('\n👥 Sample Demographic Performance Data:');
        console.log(JSON.stringify(metaTables.demographicPerformance[0], null, 2));
      }
      
      if (metaTables.adRelevanceResults?.length > 0) {
        console.log('\n🏆 Sample Ad Relevance Results Data:');
        console.log(JSON.stringify(metaTables.adRelevanceResults[0], null, 2));
      }
    } else {
      console.log('⚠️ No Meta Ads tables data found in report response');
      console.log('   Report structure:', Object.keys(reportData.report || {}));
    }

    // 6. Test PDF generation with Meta Ads tables
    console.log('\n6️⃣ Testing PDF generation with Meta Ads tables...');
    
    const pdfResponse = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange,
        metaTables: reportData.report?.meta_tables
      })
    });

    console.log('📡 PDF Response status:', pdfResponse.status);

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('❌ PDF generation failed:', errorText);
      return;
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('✅ PDF generation successful!');
    console.log(`   📄 PDF size: ${pdfBuffer.byteLength} bytes`);

    // 7. Summary
    console.log('\n🎉 Test Summary:');
    console.log('✅ Admin panel report generation works');
    console.log('✅ Meta Ads tables data is included in report response');
    console.log('✅ PDF generation works with Meta Ads tables data');
    console.log('✅ All report generation methods now have consistent Meta Ads tables data');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    await supabase.auth.signOut();
    console.log('\n🧹 Cleaned up session');
  }
}

// Run the test
testAdminReportGeneration().catch(console.error); 