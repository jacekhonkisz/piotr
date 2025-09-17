#!/usr/bin/env node

/**
 * Test if the server is using our updated code
 */

const fs = require('fs');

function testServerCodeVersion() {
  console.log('🧪 TESTING SERVER CODE VERSION\n');

  // Check if our temporary fixes are in the current file
  const pdfRoutePath = 'src/app/api/generate-pdf/route.ts';
  
  if (!fs.existsSync(pdfRoutePath)) {
    console.log('❌ PDF route file not found');
    return;
  }

  const content = fs.readFileSync(pdfRoutePath, 'utf8');
  
  console.log('🔍 CHECKING FOR OUR TEMPORARY FIXES:');
  
  const hasForceShowPeriod = content.includes('// TEMPORARY: Force show for debugging');
  const hasForceShowYear = content.includes('<!-- TEMPORARY: Force show for debugging -->');
  const hasDebugLogs = content.includes('🔍 YEAR-OVER-YEAR VALIDATION DEBUG');
  
  console.log('   Force show period comparison:', hasForceShowPeriod ? '✅ FOUND' : '❌ NOT FOUND');
  console.log('   Force show year comparison:', hasForceShowYear ? '✅ FOUND' : '❌ NOT FOUND');
  console.log('   Debug logging:', hasDebugLogs ? '✅ FOUND' : '❌ NOT FOUND');

  if (hasForceShowPeriod && hasForceShowYear) {
    console.log('\n✅ OUR TEMPORARY FIXES ARE IN THE CODE');
    console.log('   The server should be using the updated logic');
    console.log('   If comparisons still don\'t appear, the issue is:');
    console.log('   1. Server not restarted properly');
    console.log('   2. Data not being attached correctly');
    console.log('   3. Template rendering issue');
  } else {
    console.log('\n❌ OUR TEMPORARY FIXES ARE MISSING');
    console.log('   The server is using old code');
    console.log('   Need to restart the server');
  }

  // Check the exact lines where our fixes should be
  console.log('\n🔍 DETAILED CODE CHECK:');
  
  const lines = content.split('\n');
  const forceShowPeriodLine = lines.findIndex(line => line.includes('// TEMPORARY: Force show for debugging'));
  const forceShowYearLine = lines.findIndex(line => line.includes('<!-- TEMPORARY: Force show for debugging -->'));
  
  if (forceShowPeriodLine !== -1) {
    console.log(`   Force show period: Line ${forceShowPeriodLine + 1}`);
    console.log(`   Content: ${lines[forceShowPeriodLine].trim()}`);
  }
  
  if (forceShowYearLine !== -1) {
    console.log(`   Force show year: Line ${forceShowYearLine + 1}`);
    console.log(`   Content: ${lines[forceShowYearLine].trim()}`);
  }

  console.log('\n📋 RECOMMENDATIONS:');
  if (hasForceShowPeriod && hasForceShowYear) {
    console.log('   1. ✅ Code is updated - server should work');
    console.log('   2. 🔄 Try generating a new PDF');
    console.log('   3. 📊 Check server logs for debug messages');
    console.log('   4. 🎯 If still not working, check data attachment');
  } else {
    console.log('   1. ❌ Code is not updated');
    console.log('   2. 🔄 Restart the development server');
    console.log('   3. 🧪 Test again after restart');
  }
}

testServerCodeVersion(); 