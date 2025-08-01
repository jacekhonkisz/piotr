const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPdfMetaTables() {
  console.log('🧪 Testing PDF generation with Meta Ads tables...');

  try {
    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found for testing');
      return;
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.name} (${client.email})`);

    // Test date range (current month)
    const now = new Date();
    const monthStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEndDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    console.log(`📅 Testing date range: ${monthStartDate} to ${monthEndDate}`);

    // Test Meta Ads tables API
    console.log('🔍 Testing Meta Ads tables API...');
    
    const metaTablesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-meta-tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        dateStart: monthStartDate,
        dateEnd: monthEndDate,
        clientId: client.id
      })
    });

    if (metaTablesResponse.ok) {
      const metaTablesData = await metaTablesResponse.json();
      console.log('✅ Meta Ads tables API response:', {
        success: metaTablesData.success,
        placementCount: metaTablesData.data?.placementPerformance?.length || 0,
        demographicCount: metaTablesData.data?.demographicPerformance?.length || 0,
        adRelevanceCount: metaTablesData.data?.adRelevanceResults?.length || 0
      });
    } else {
      console.log('⚠️ Meta Ads tables API failed:', metaTablesResponse.status);
    }

    // Test PDF generation with Meta tables
    console.log('📄 Testing PDF generation with Meta tables...');
    
    const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-report-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: monthStartDate,
          end: monthEndDate
        },
        includeEmail: false
      })
    });

    if (pdfResponse.ok) {
      const pdfData = await pdfResponse.json();
      console.log('✅ PDF generation response:', {
        success: pdfData.success,
        message: pdfData.message,
        hasMetaTables: pdfData.metaTables ? 'Yes' : 'No'
      });
    } else {
      const errorData = await pdfResponse.json();
      console.log('❌ PDF generation failed:', errorData);
    }

    // Test download PDF endpoint
    console.log('📥 Testing download PDF endpoint...');
    
    const downloadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/download-pdf?reportId=${client.id}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN || 'test-token'}`
      }
    });

    if (downloadResponse.ok) {
      console.log('✅ Download PDF endpoint working');
      console.log('📊 PDF Content-Type:', downloadResponse.headers.get('Content-Type'));
      console.log('📏 PDF Size:', downloadResponse.headers.get('Content-Length'), 'bytes');
    } else {
      console.log('❌ Download PDF endpoint failed:', downloadResponse.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPdfMetaTables().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 