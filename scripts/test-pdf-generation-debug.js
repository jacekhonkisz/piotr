const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbklptrrfdspyvnjaojf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function testPDFGeneration() {
  console.log('🔍 Testing PDF Generation Debug...\n');

  try {
    // 1. Get admin user session
    console.log('1️⃣ Getting admin user session...');
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'admin123'
    });

    if (authError || !user) {
      console.log('❌ Failed to authenticate admin user:', authError?.message);
      return;
    }

    console.log('✅ Admin user authenticated:', user.email);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.log('❌ No access token available');
      return;
    }

    // 2. Get a client to test with
    console.log('\n2️⃣ Getting client data...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found:', clientsError?.message);
      return;
    }

    const client = clients[0];
    console.log('✅ Found client:', client.name);

    // 3. Test generate-report endpoint
    console.log('\n3️⃣ Testing /api/generate-report endpoint...');
    const generateReportResponse = await fetch('http://localhost:3002/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: '2024-07-01',
          end: '2024-07-31'
        }
      })
    });

    console.log('   Status:', generateReportResponse.status);
    console.log('   Headers:', Object.fromEntries(generateReportResponse.headers.entries()));

    if (!generateReportResponse.ok) {
      const errorText = await generateReportResponse.text();
      console.log('❌ Generate report failed:', errorText);
      return;
    }

    const reportData = await generateReportResponse.json();
    console.log('✅ Generate report successful:', {
      success: reportData.success,
      reportId: reportData.report?.id,
      hasMetaTables: !!reportData.report?.meta_tables
    });

    // 4. Test generate-pdf endpoint
    console.log('\n4️⃣ Testing /api/generate-pdf endpoint...');
    const generatePdfResponse = await fetch('http://localhost:3002/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: '2024-07-01',
          end: '2024-07-31'
        },
        metaTables: reportData.report?.meta_tables
      })
    });

    console.log('   Status:', generatePdfResponse.status);
    console.log('   Headers:', Object.fromEntries(generatePdfResponse.headers.entries()));

    if (!generatePdfResponse.ok) {
      const errorText = await generatePdfResponse.text();
      console.log('❌ Generate PDF failed:', errorText);
      return;
    }

    const pdfBlob = await generatePdfResponse.blob();
    console.log('✅ Generate PDF successful:', {
      size: pdfBlob.size,
      type: pdfBlob.type
    });

    // 5. Test if the PDF can be displayed
    console.log('\n5️⃣ Testing PDF display...');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    console.log('✅ PDF URL created:', pdfUrl.substring(0, 50) + '...');

    // 6. Check CSP headers
    console.log('\n6️⃣ Checking CSP headers...');
    const cspHeaders = generatePdfResponse.headers.get('content-security-policy');
    console.log('   CSP Header:', cspHeaders);
    
    if (cspHeaders && cspHeaders.includes('frame-src')) {
      console.log('✅ CSP includes frame-src directive');
    } else {
      console.log('⚠️ CSP may not include frame-src directive');
    }

    console.log('\n🎉 PDF Generation Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   - Admin authentication: ✅');
    console.log('   - Client data retrieval: ✅');
    console.log('   - Report generation: ✅');
    console.log('   - PDF generation: ✅');
    console.log('   - PDF blob creation: ✅');
    console.log('   - CSP configuration: ' + (cspHeaders?.includes('frame-src') ? '✅' : '⚠️'));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPDFGeneration(); 