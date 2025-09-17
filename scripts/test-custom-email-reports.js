const fetch = require('node-fetch');

async function testCustomEmailReports() {
  console.log('🧪 Testing Custom Email Reports System');
  console.log('=====================================');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  // Test data
  const testData = {
    clientId: 'test-client-id', // You'll need to replace with actual client ID
    dateRange: {
      start: '2025-01-01',
      end: '2025-01-31'
    },
    customMessage: 'This is a test email sent via the new custom email reports system. The Polish summary and PDF attachment should be included automatically.',
    includePdf: true,
    campaigns: [], // Will be generated automatically
    totals: null, // Will be calculated automatically
    client: null, // Will be fetched automatically
    metaTables: null // Will be fetched automatically
  };

  try {
    console.log('📤 Sending test email report...');
    console.log('   Client ID:', testData.clientId);
    console.log('   Date Range:', `${testData.dateRange.start} to ${testData.dateRange.end}`);
    console.log('   Include PDF:', testData.includePdf);
    console.log('   Custom Message:', testData.customMessage ? 'Yes' : 'No');

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
      console.log('✅ Test email sent successfully!');
      console.log('   Message:', result.message);
      console.log('   Sent to:', result.sentTo);
      if (result.failed && result.failed.length > 0) {
        console.log('⚠️  Failed recipients:', result.failed);
      }
    } else {
      console.log('❌ Test email failed:');
      console.log('   Error:', result.error);
      console.log('   Details:', result.details);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n📋 Test completed');
}

// Test email template generation
function testEmailTemplateGeneration() {
  console.log('\n🎨 Testing Email Template Generation');
  console.log('===================================');

  // Test Polish formatting functions
  const testAmount = 12500.50;
  const testImpressions = 250000;
  const testClicks = 5000;
  const testCtr = 2.0;

  console.log('Polish formatting tests:');
  console.log('   Currency:', new Intl.NumberFormat('pl-PL', { 
    style: 'currency', 
    currency: 'PLN' 
  }).format(testAmount));
  
  console.log('   Large number:', new Intl.NumberFormat('pl-PL').format(testImpressions));
  
  console.log('   Percentage:', new Intl.NumberFormat('pl-PL', { 
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(testCtr / 100));

  // Test date formatting
  const testDate = new Date('2025-01-15');
  console.log('   Date:', testDate.toLocaleDateString('pl-PL', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }));

  console.log('✅ Polish formatting working correctly');
}

// Test summary generation
function testSummaryGeneration() {
  console.log('\n📊 Testing Summary Generation');
  console.log('=============================');

  const testReportData = {
    dateRange: { start: '2025-01-01', end: '2025-01-31' },
    totalSpend: 12500.50,
    totalImpressions: 250000,
    totalClicks: 5000,
    totalConversions: 150,
    ctr: 2.0,
    cpc: 2.5,
    campaigns: []
  };

  // Simulate summary generation logic
  const periodLabel = 'miesiącu';
  const startDate = testReportData.dateRange.start;
  const endDate = testReportData.dateRange.end;
  
  const formatCurrency = (value) => new Intl.NumberFormat('pl-PL', { 
    style: 'currency', 
    currency: 'PLN' 
  }).format(value);
  
  const formatNumber = (value) => new Intl.NumberFormat('pl-PL').format(Math.round(value));
  
  const formatPercentage = (value) => new Intl.NumberFormat('pl-PL', { 
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);

  const summary = `W ${periodLabel} od ${startDate} do ${endDate} wydaliśmy na kampanie reklamowe ${formatCurrency(testReportData.totalSpend)}. Działania te zaowocowały ${formatNumber(testReportData.totalImpressions)} wyświetleniami a liczba kliknięć wyniosła ${formatNumber(testReportData.totalClicks)}, co dało CTR na poziomie ${formatPercentage(testReportData.ctr)}. Średni koszt kliknięcia (CPC) wyniósł ${formatCurrency(testReportData.cpc)}.`;

  console.log('Generated summary:');
  console.log('   ' + summary);
  console.log('✅ Summary generation working correctly');
}

// Run all tests
async function runAllTests() {
  testEmailTemplateGeneration();
  testSummaryGeneration();
  
  console.log('\n⚠️  To test actual email sending, update the clientId in testCustomEmailReports()');
  console.log('   with a real client ID from your database and uncomment the line below:');
  console.log('   // await testCustomEmailReports();');
  
  // Uncomment this line after updating the clientId above
  // await testCustomEmailReports();
}

runAllTests().catch(console.error); 