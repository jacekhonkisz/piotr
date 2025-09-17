const fs = require('fs');
const path = require('path');

function verifyConversionFixes() {
  console.log('🔍 Verifying Conversion Metrics Fixes Implementation');
  console.log('==================================================\n');

  let allChecksPassed = true;

  // Check 1: Dashboard page.tsx
  console.log('📊 Check 1: Dashboard Page (src/app/dashboard/page.tsx)');
  try {
    const dashboardPath = path.join(__dirname, '../src/app/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for old field names (should NOT be present)
    const oldFieldChecks = [
      { pattern: /totalLead/, name: 'totalLead calculation' },
      { pattern: /totalPurchase/, name: 'totalPurchase calculation' },
      { pattern: /totalPurchaseValue/, name: 'totalPurchaseValue calculation' },
      { pattern: /lead.*campaign\.lead/, name: 'campaign.lead mapping' },
      { pattern: /purchase.*campaign\.purchase/, name: 'campaign.purchase mapping' },
      { pattern: /purchase_value.*campaign\.purchase_value/, name: 'campaign.purchase_value mapping' }
    ];

    let oldFieldsFound = false;
    oldFieldChecks.forEach(check => {
      if (check.pattern.test(dashboardContent)) {
        console.log(`   ❌ Found old field: ${check.name}`);
        oldFieldsFound = true;
        allChecksPassed = false;
      }
    });

    if (!oldFieldsFound) {
      console.log('   ✅ No old field names found');
    }

    // Check for correct field names (should be present)
    const newFieldChecks = [
      { pattern: /email_contacts.*campaign\.email_contacts/, name: 'campaign.email_contacts mapping' },
      { pattern: /reservations.*campaign\.reservations/, name: 'campaign.reservations mapping' },
      { pattern: /reservation_value.*campaign\.reservation_value/, name: 'campaign.reservation_value mapping' },
      { pattern: /monthData\.data\?\.conversionMetrics/, name: 'API conversionMetrics usage' }
    ];

    let newFieldsFound = 0;
    newFieldChecks.forEach(check => {
      if (check.pattern.test(dashboardContent)) {
        console.log(`   ✅ Found correct field: ${check.name}`);
        newFieldsFound++;
      } else {
        console.log(`   ❌ Missing correct field: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 Dashboard field checks: ${newFieldsFound}/${newFieldChecks.length} passed\n`);

  } catch (error) {
    console.log(`   ❌ Error reading dashboard file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 2: API endpoint route.ts
  console.log('📡 Check 2: API Endpoint (src/app/api/fetch-live-data/route.ts)');
  try {
    const apiPath = path.join(__dirname, '../src/app/api/fetch-live-data/route.ts');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    
    // Check for conversion metrics in API response
    const apiChecks = [
      { pattern: /conversionMetrics.*{/, name: 'conversionMetrics object' },
      { pattern: /click_to_call.*totalClickToCall/, name: 'click_to_call aggregation' },
      { pattern: /email_contacts.*totalEmailContacts/, name: 'email_contacts aggregation' },
      { pattern: /reservations.*totalReservations/, name: 'reservations aggregation' },
      { pattern: /reservation_value.*totalReservationValue/, name: 'reservation_value aggregation' },
      { pattern: /roas.*overallRoas/, name: 'ROAS calculation' },
      { pattern: /cost_per_reservation.*overallCostPerReservation/, name: 'cost_per_reservation calculation' }
    ];

    let apiChecksPassed = 0;
    apiChecks.forEach(check => {
      if (check.pattern.test(apiContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        apiChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 API endpoint checks: ${apiChecksPassed}/${apiChecks.length} passed\n`);

  } catch (error) {
    console.log(`   ❌ Error reading API file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 3: WeeklyReportView component
  console.log('📋 Check 3: WeeklyReportView Component (src/components/WeeklyReportView.tsx)');
  try {
    const weeklyReportPath = path.join(__dirname, '../src/components/WeeklyReportView.tsx');
    const weeklyReportContent = fs.readFileSync(weeklyReportPath, 'utf8');
    
    // Check for correct field names in interface
    const interfaceChecks = [
      { pattern: /email_contacts\?: number/, name: 'email_contacts in Campaign interface' },
      { pattern: /reservations\?: number/, name: 'reservations in Campaign interface' },
      { pattern: /reservation_value\?: number/, name: 'reservation_value in Campaign interface' },
      { pattern: /click_to_call\?: number/, name: 'click_to_call in Campaign interface' },
      { pattern: /booking_step_1\?: number/, name: 'booking_step_1 in Campaign interface' },
      { pattern: /booking_step_2\?: number/, name: 'booking_step_2 in Campaign interface' }
    ];

    let interfaceChecksPassed = 0;
    interfaceChecks.forEach(check => {
      if (check.pattern.test(weeklyReportContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        interfaceChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    // Check for conversion metrics calculation
    const calculationChecks = [
      { pattern: /conversionTotals.*reduce/, name: 'conversionTotals calculation' },
      { pattern: /email_contacts.*campaign\.email_contacts/, name: 'email_contacts aggregation' },
      { pattern: /reservations.*campaign\.reservations/, name: 'reservations aggregation' },
      { pattern: /ConversionMetricsCards/, name: 'ConversionMetricsCards component usage' }
    ];

    let calculationChecksPassed = 0;
    calculationChecks.forEach(check => {
      if (check.pattern.test(weeklyReportContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        calculationChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 WeeklyReportView checks: ${interfaceChecksPassed + calculationChecksPassed}/${interfaceChecks.length + calculationChecks.length} passed\n`);

  } catch (error) {
    console.log(`   ❌ Error reading WeeklyReportView file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 4: Reports page
  console.log('📊 Check 4: Reports Page (src/app/reports/page.tsx)');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    // Check for correct field names in Campaign interface
    const reportsInterfaceChecks = [
      { pattern: /email_contacts\?: number/, name: 'email_contacts in Campaign interface' },
      { pattern: /reservations\?: number/, name: 'reservations in Campaign interface' },
      { pattern: /reservation_value\?: number/, name: 'reservation_value in Campaign interface' },
      { pattern: /click_to_call\?: number/, name: 'click_to_call in Campaign interface' },
      { pattern: /booking_step_1\?: number/, name: 'booking_step_1 in Campaign interface' },
      { pattern: /booking_step_2\?: number/, name: 'booking_step_2 in Campaign interface' }
    ];

    let reportsInterfaceChecksPassed = 0;
    reportsInterfaceChecks.forEach(check => {
      if (check.pattern.test(reportsContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        reportsInterfaceChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    // Check for conversion parsing logic
    const parsingChecks = [
      { pattern: /email_contacts.*=.*0/, name: 'email_contacts initialization' },
      { pattern: /reservations.*=.*0/, name: 'reservations initialization' },
      { pattern: /reservation_value.*=.*0/, name: 'reservation_value initialization' },
      { pattern: /actionType\.includes.*link_click/, name: 'email_contacts parsing logic' },
      { pattern: /actionType.*purchase.*reservation/, name: 'reservations parsing logic' }
    ];

    let parsingChecksPassed = 0;
    parsingChecks.forEach(check => {
      if (check.pattern.test(reportsContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        parsingChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 Reports page checks: ${reportsInterfaceChecksPassed + parsingChecksPassed}/${reportsInterfaceChecks.length + parsingChecks.length} passed\n`);

  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 5: ConversionMetricsCards component
  console.log('🎯 Check 5: ConversionMetricsCards Component (src/components/ConversionMetricsCards.tsx)');
  try {
    const conversionCardsPath = path.join(__dirname, '../src/components/ConversionMetricsCards.tsx');
    const conversionCardsContent = fs.readFileSync(conversionCardsPath, 'utf8');
    
    // Check for correct interface
    const cardsChecks = [
      { pattern: /interface ConversionMetrics/, name: 'ConversionMetrics interface' },
      { pattern: /click_to_call: number/, name: 'click_to_call in interface' },
      { pattern: /email_contacts: number/, name: 'email_contacts in interface' },
      { pattern: /reservations: number/, name: 'reservations in interface' },
      { pattern: /reservation_value: number/, name: 'reservation_value in interface' },
      { pattern: /roas: number/, name: 'roas in interface' },
      { pattern: /cost_per_reservation: number/, name: 'cost_per_reservation in interface' },
      { pattern: /booking_step_1: number/, name: 'booking_step_1 in interface' },
      { pattern: /booking_step_2: number/, name: 'booking_step_2 in interface' }
    ];

    let cardsChecksPassed = 0;
    cardsChecks.forEach(check => {
      if (check.pattern.test(conversionCardsContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        cardsChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 ConversionMetricsCards checks: ${cardsChecksPassed}/${cardsChecks.length} passed\n`);

  } catch (error) {
    console.log(`   ❌ Error reading ConversionMetricsCards file: ${error.message}`);
    allChecksPassed = false;
  }

  // Summary
  console.log('📋 Summary:');
  console.log('==================================================');
  
  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('🎉 Conversion metrics fixes are correctly implemented');
    console.log('\n📊 What was verified:');
    console.log('   ✅ Dashboard uses correct field names (email_contacts, reservations, reservation_value)');
    console.log('   ✅ Dashboard uses API conversionMetrics directly');
    console.log('   ✅ API endpoint returns conversionMetrics with correct structure');
    console.log('   ✅ WeeklyReportView uses correct field names and calculations');
    console.log('   ✅ Reports page uses correct field names and parsing logic');
    console.log('   ✅ ConversionMetricsCards component has correct interface');
    console.log('\n🚀 Next steps:');
    console.log('   1. Test in browser: Navigate to /dashboard and /reports');
    console.log('   2. Switch between Belmonte and Havet clients');
    console.log('   3. Verify conversion metrics show different values for each client');
    console.log('   4. Confirm current month data is displayed correctly');
  } else {
    console.log('❌ SOME CHECKS FAILED!');
    console.log('🔧 Please review the failed checks above and fix the issues');
  }

  return allChecksPassed;
}

// Run the verification
verifyConversionFixes(); 