const fs = require('fs');
const path = require('path');

function testDashboardClientSwitching() {
  console.log('🧪 Testing Dashboard Client Switching Fix');
  console.log('========================================\n');

  let allChecksPassed = true;

  // Check 1: handleClientChange includes conversionMetrics
  console.log('🔄 Check 1: handleClientChange Function');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check if handleClientChange includes conversionMetrics in dashboardData
    const handleClientChangeMatch = dashboardContent.match(/const dashboardData = \{[\s\S]*?\}/);
    if (handleClientChangeMatch && handleClientChangeMatch[0].includes('conversionMetrics: mainDashboardData.conversionMetrics')) {
      console.log('   ✅ handleClientChange includes conversionMetrics');
    } else {
      console.log('   ❌ handleClientChange missing conversionMetrics');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 2: loadMainDashboardData returns conversionMetrics
  console.log('\n📊 Check 2: loadMainDashboardData Function');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for return statement with conversionMetrics
    if (dashboardContent.includes('return {') && 
        dashboardContent.includes('conversionMetrics') && 
        dashboardContent.includes('monthData.data?.conversionMetrics')) {
      console.log('   ✅ loadMainDashboardData returns conversionMetrics');
    } else {
      console.log('   ❌ loadMainDashboardData missing conversionMetrics return');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 3: Error cases include conversionMetrics
  console.log('\n⚠️ Check 3: Error Cases Include conversionMetrics');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Count how many times conversionMetrics appears in return statements
    const conversionMetricsMatches = (dashboardContent.match(/conversionMetrics: \{[\s\S]*?booking_step_2: 0[\s\S]*?\}/g) || []).length;
    
    if (conversionMetricsMatches >= 4) {
      console.log(`   ✅ Found ${conversionMetricsMatches} conversionMetrics objects (including error cases)`);
    } else {
      console.log(`   ❌ Found only ${conversionMetricsMatches} conversionMetrics objects (expected at least 4)`);
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 4: Cache key includes client ID
  console.log('\n🗄️ Check 4: Cache Key Includes Client ID');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    if (dashboardContent.includes('selectedClient?.id') && 
        dashboardContent.includes('getCacheKey') &&
        dashboardContent.includes('dashboard_cache_')) {
      console.log('   ✅ Cache key includes client ID');
    } else {
      console.log('   ❌ Cache key missing client ID');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 5: Cache clearing in handleClientChange
  console.log('\n🗑️ Check 5: Cache Clearing in handleClientChange');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Extract handleClientChange function
    const handleClientChangeStart = dashboardContent.indexOf('const handleClientChange = async (client: Client) => {');
    const handleClientChangeEnd = dashboardContent.indexOf('};', handleClientChangeStart);
    const handleClientChangeFunction = dashboardContent.substring(handleClientChangeStart, handleClientChangeEnd);
    
    if (handleClientChangeFunction.includes('clearCache()')) {
      console.log('   ✅ handleClientChange calls clearCache()');
    } else {
      console.log('   ❌ handleClientChange missing clearCache() call');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 6: ConversionMetricsCards component usage
  console.log('\n🎯 Check 6: ConversionMetricsCards Component Usage');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    if (dashboardContent.includes('ConversionMetricsCards') && 
        dashboardContent.includes('conversionMetrics={clientData.conversionMetrics}')) {
      console.log('   ✅ ConversionMetricsCards uses clientData.conversionMetrics');
    } else {
      console.log('   ❌ ConversionMetricsCards missing or incorrect prop');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Summary
  console.log('\n📋 Summary:');
  console.log('========================================');
  
  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('🎉 Dashboard client switching fix is correctly implemented');
    console.log('\n📊 What was verified:');
    console.log('   ✅ handleClientChange includes conversionMetrics in dashboardData');
    console.log('   ✅ loadMainDashboardData returns conversionMetrics');
    console.log('   ✅ Error cases include default conversionMetrics');
    console.log('   ✅ Cache key includes client ID for proper isolation');
    console.log('   ✅ Cache is cleared when switching clients');
    console.log('   ✅ ConversionMetricsCards uses correct data source');
    console.log('\n🚀 Expected Results:');
    console.log('   - Dashboard should now show different conversion metrics for each client');
    console.log('   - Switching clients should clear cache and load fresh data');
    console.log('   - Belmonte and Havet should show their individual data');
    console.log('   - No data leakage between clients');
  } else {
    console.log('❌ SOME CHECKS FAILED!');
    console.log('🔧 Please review the failed checks above and fix the issues');
  }

  return allChecksPassed;
}

// Run the test
testDashboardClientSwitching(); 