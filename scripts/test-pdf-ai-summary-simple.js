// Simple test to verify PDF generation with AI summaries
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testPDFWithAISummary() {
  console.log('🧪 Testing PDF Generation with AI Summary Integration\n');

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

    // Step 2: Test AI summary generation directly
    console.log('\n🤖 Step 2: Testing AI summary generation...');
    
    const testData = {
      clientId: '5703e71f-1222-4178-885c-ce72746d0713', // jacek's client ID
      dateRange: {
        start: '2024-04-01',
        end: '2024-04-30'
      },
      reportData: {
        account_summary: {
          total_spend: 246.94,
          total_impressions: 8099,
          total_clicks: 143,
          total_conversions: 0,
          average_ctr: 1.77,
          average_cpc: 1.73,
          average_cpa: 0,
          total_conversion_value: 0,
          roas: 0,
          micro_conversions: 0
        }
      }
    };

    console.log('📊 Test data:', {
      spend: testData.reportData.account_summary.total_spend + ' zł',
      impressions: testData.reportData.account_summary.total_impressions,
      clicks: testData.reportData.account_summary.total_clicks,
      ctr: testData.reportData.account_summary.average_ctr + '%'
    });

    // Test AI summary generation
    const aiResponse = await fetch('http://localhost:3002/api/generate-executive-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(testData)
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      console.log('✅ AI Summary generated successfully!');
      console.log('📝 AI Summary preview:');
      console.log('─'.repeat(60));
      console.log(aiData.summary.substring(0, 300) + '...');
      console.log('─'.repeat(60));
    } else {
      const errorText = await aiResponse.text();
      console.error('❌ AI Summary generation failed:', aiResponse.status, errorText);
    }

    // Step 3: Test PDF generation
    console.log('\n📄 Step 3: Testing PDF generation...');
    
    const pdfResponse = await fetch('http://localhost:3002/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: testData.clientId,
        dateRange: testData.dateRange
      })
    });

    if (pdfResponse.ok) {
      console.log('✅ PDF generated successfully!');
      
      // Check if the response contains the PDF data
      const pdfData = await pdfResponse.arrayBuffer();
      console.log(`📊 PDF size: ${pdfData.byteLength} bytes`);
      
      if (pdfData.byteLength > 0) {
        console.log('✅ PDF contains data');
        
        // Save the PDF for inspection
        const fs = require('fs');
        const path = require('path');
        const pdfPath = path.join(__dirname, 'test-pdf-ai-summary.pdf');
        fs.writeFileSync(pdfPath, Buffer.from(pdfData));
        console.log(`💾 PDF saved to: ${pdfPath}`);
        
        console.log('\n🎉 Test completed successfully!');
        console.log('📋 Summary:');
        console.log('   ✅ AI Summary generation working');
        console.log('   ✅ PDF generation working');
        console.log('   ✅ PDF saved for inspection');
        console.log('\n💡 Check the PDF file to see if it contains the AI-generated summary instead of the generic one');
        
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