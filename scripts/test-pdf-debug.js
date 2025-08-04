const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFDebug() {
  console.log('🧪 Testing PDF Generation with Debug Logs...\n');

  try {
    // Get jacek's client data
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client found:', {
      id: jacek.id,
      name: jacek.name,
      email: jacek.email
    });

    // Test PDF generation
    console.log('\n📄 Testing PDF generation...');
    
    const response = await fetch('http://localhost:3000/api/generate-interactive-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-pdf-generation'
      },
      body: JSON.stringify({
        clientId: jacek.id,
        dateRange: {
          start: '2024-03-01',
          end: '2024-03-31'
        }
      })
    });

    console.log('PDF Generation Status:', response.status);
    
    if (response.ok) {
      console.log('✅ PDF generation successful!');
      console.log('📊 Response headers:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      // Check if it's a PDF
      const contentType = response.headers.get('content-type');
      if (contentType === 'application/pdf') {
        console.log('✅ Response is a valid PDF file');
      } else {
        console.log('⚠️ Response is not a PDF:', contentType);
      }
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ PDF generation failed:', errorData);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testPDFDebug(); 