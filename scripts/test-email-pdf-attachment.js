const fetch = require('node-fetch');

async function testEmailWithPDFAttachment() {
  console.log('🧪 Testing Email with PDF Attachment');
  console.log('====================================');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  // Test data - using Jacek client ID
  const testData = {
    clientId: '5703e71f-1222-4178-885c-ce72746d0713', // Jacek's client ID
    dateRange: {
      start: '2025-07-31',
      end: '2025-08-30'
    },
    customMessage: '🧪 This is a TEST email for Jacek to verify PDF attachment functionality. Please check that a PDF is attached to this email.',
    includePdf: true,
    campaigns: [], // Will be fetched automatically
    totals: null, // Will be calculated automatically
    client: null, // Will be fetched automatically
    metaTables: null // Will be fetched automatically
  };

  try {
    console.log('📤 Testing email with PDF attachment...');
    console.log('   Client ID:', testData.clientId);
    console.log('   Date Range:', `${testData.dateRange.start} to ${testData.dateRange.end}`);
    console.log('   Include PDF:', testData.includePdf);

    const response = await fetch(`${baseUrl}/api/send-custom-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Email with PDF attachment sent successfully!');
      console.log('   Message:', result.message);
      console.log('   Sent to:', result.sentTo);
      if (result.failed && result.failed.length > 0) {
        console.log('⚠️  Failed recipients:', result.failed);
      }
      
      console.log('\n📋 What to check in the received email:');
      console.log('   1. ✉️  Email should contain the test message above');
      console.log('   2. 📊 Email should contain Polish summary (podsumowanie)');
      console.log('   3. 📎 Email should have PDF attachment named: Meta_Ads_Performance_Report_' + new Date().toISOString().split('T')[0] + '.pdf');
      console.log('   4. 📄 PDF should contain complete report with charts and tables');
      
    } else {
      console.log('❌ Email test failed:');
      console.log('   Error:', result.error);
      console.log('   Details:', result.details);
      
      if (result.error?.includes('Client not found')) {
        console.log('\n💡 Fix: Jacek client not found in database');
        console.log('   Check if client ID 5703e71f-1222-4178-885c-ce72746d0713 exists in clients table');
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n📋 Test completed');
}

// Test PDF generation separately
async function testPDFGeneration() {
  console.log('\n🔧 Testing PDF Generation Separately');
  console.log('===================================');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const testData = {
    clientId: '5703e71f-1222-4178-885c-ce72746d0713', // Jacek's client ID
    dateRange: {
      start: '2025-07-31',
      end: '2025-08-30'
    }
  };

  try {
    console.log('📄 Testing PDF generation API...');
    
    const response = await fetch(`${baseUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      const pdfSize = pdfBuffer.byteLength;
      
      console.log('✅ PDF generation successful!');
      console.log('   PDF Size:', pdfSize, 'bytes');
      console.log('   PDF Size:', Math.round(pdfSize / 1024), 'KB');
      console.log('   PDF Size:', Math.round(pdfSize / 1024 / 1024 * 100) / 100, 'MB');
      
      if (pdfSize > 0) {
        console.log('✅ PDF has content and would be attachable to emails');
      } else {
        console.log('⚠️  PDF is empty - there might be an issue');
      }
      
    } else {
      const errorData = await response.json();
      console.log('❌ PDF generation failed:');
      console.log('   Error:', errorData.error);
      console.log('   Details:', errorData.details);
    }

  } catch (error) {
    console.error('❌ PDF test failed:', error.message);
  }
}

// Run both tests
async function runAllTests() {
  await testPDFGeneration();
  await testEmailWithPDFAttachment();
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Script is configured for Jacek client (5703e71f-1222-4178-885c-ce72746d0713)');
  console.log('2. Test results above show PDF generation and email sending status');
  console.log('3. Check jac.honkisz@gmail.com inbox for the test email with PDF attachment');
  console.log('4. Verify the PDF opens and contains Jacek\'s report data');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testEmailWithPDFAttachment, testPDFGeneration }; 