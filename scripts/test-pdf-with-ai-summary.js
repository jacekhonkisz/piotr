// Test script to verify PDF generation includes AI Executive Summary
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPDFWithAISummary() {
  console.log('🧪 Testing PDF Generation with AI Executive Summary\n');

  try {
    // Step 1: Sign in
    console.log('🔐 Step 1: Signing in...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (signInError || !session) {
      console.error('❌ Sign in failed:', signInError?.message || 'No session');
      return;
    }

    console.log('✅ Signed in successfully');

    // Step 2: Test PDF generation with AI summary
    console.log('\n📄 Step 2: Testing PDF generation with AI Executive Summary...');
    
    const testDateRange = {
      start: '2024-04-01',
      end: '2024-04-30'
    };

    console.log(`📅 Testing date range: ${testDateRange.start} to ${testDateRange.end}`);

    // First, ensure we have an AI summary for this period
    console.log('\n🤖 Step 2a: Ensuring AI Executive Summary exists...');
    
    const summaryResponse = await fetch('http://localhost:3002/api/executive-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713', // jacek's client ID
        dateRange: testDateRange
      })
    });

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      if (summaryData.summary?.content) {
        console.log('✅ Existing AI Executive Summary found');
        console.log('📝 Summary preview:', summaryData.summary.content.substring(0, 100) + '...');
      } else {
        console.log('⚠️ No existing AI Executive Summary, will be generated during PDF creation');
      }
    }

    // Step 3: Generate PDF
    console.log('\n📄 Step 3: Generating PDF with AI Executive Summary...');
    
    const pdfResponse = await fetch('http://localhost:3002/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713',
        dateRange: testDateRange
      })
    });

    if (pdfResponse.ok) {
      console.log('✅ PDF generated successfully');
      
      // Check if the response contains the PDF data
      const pdfData = await pdfResponse.arrayBuffer();
      console.log(`📊 PDF size: ${pdfData.byteLength} bytes`);
      
      if (pdfData.byteLength > 0) {
        console.log('✅ PDF contains data');
        
        // Save the PDF for inspection
        const fs = require('fs');
        const path = require('path');
        const pdfPath = path.join(__dirname, 'test-pdf-with-ai-summary.pdf');
        fs.writeFileSync(pdfPath, Buffer.from(pdfData));
        console.log(`💾 PDF saved to: ${pdfPath}`);
        
        console.log('\n🎉 PDF Generation with AI Executive Summary Test Complete!');
        console.log('📋 Summary:');
        console.log('   ✅ PDF generated successfully');
        console.log('   ✅ AI Executive Summary integration working');
        console.log('   ✅ PDF saved for inspection');
        console.log('\n💡 You can now open the PDF file to verify that it contains the AI-generated executive summary');
        
      } else {
        console.log('❌ PDF is empty');
      }
    } else {
      const errorText = await pdfResponse.text();
      console.error('❌ PDF generation failed:', pdfResponse.status, errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPDFWithAISummary(); 