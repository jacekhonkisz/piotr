const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

async function debugPDFGeneration() {
  try {
    console.log('🔍 Debugging PDF generation...\n');

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

    // Get TechCorp's client data
    const { data: techcorp, error: techcorpError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'TechCorp Solutions')
      .single();

    if (techcorpError || !techcorp) {
      console.error('❌ TechCorp not found:', techcorpError);
      return;
    }

    console.log('\n✅ TechCorp client data:');
    console.log(`   Name: "${techcorp.name}"`);
    console.log(`   Email: "${techcorp.email}"`);
    console.log(`   ID: "${techcorp.id}"`);

    // Test the generate-report-pdf endpoint with jacek's data
    console.log('\n📤 Testing generate-report-pdf endpoint with jacek...');
    
    const response = await fetch('http://localhost:3000/api/generate-report-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        clientId: jacek.id,
        monthId: '2024-07',
        includeEmail: false
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      console.log(`✅ PDF generated successfully (${pdfBuffer.byteLength} bytes)`);
      
      // Save the PDF for inspection
      const fs = require('fs');
      fs.writeFileSync('debug-jacek-report.pdf', Buffer.from(pdfBuffer));
      console.log('📄 PDF saved as debug-jacek-report.pdf');
    } else {
      const errorText = await response.text();
      console.error('❌ PDF generation failed:', errorText);
    }

    console.log('\n✅ Debug completed!');

  } catch (error) {
    console.error('❌ Error debugging PDF generation:', error);
  }
}

debugPDFGeneration(); 