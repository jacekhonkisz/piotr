const fs = require('fs');
const path = require('path');

function verifyParsingFixesApplied() {
  console.log('🔍 Verifying Parsing Logic Fixes Applied');
  console.log('======================================\n');

  try {
    // Read the meta-api.ts file
    const metaApiPath = path.join(__dirname, '../src/lib/meta-api.ts');
    const metaApiContent = fs.readFileSync(metaApiPath, 'utf8');

    let allFixesApplied = true;

    // Check Fix 1: Purchase Event Deduplication
    console.log('✅ Fix 1: Purchase Event Deduplication');
    const purchaseFixPattern = /actionType === 'purchase' \|\| actionType === 'offsite_conversion\.fb_pixel_purchase'/;
    const oldPurchasePattern = /actionType\.includes\('purchase'\)/;
    
    if (purchaseFixPattern.test(metaApiContent)) {
      console.log('   ✅ New purchase deduplication logic found');
    } else {
      console.log('   ❌ New purchase deduplication logic NOT found');
      allFixesApplied = false;
    }

    if (!oldPurchasePattern.test(metaApiContent)) {
      console.log('   ✅ Old problematic purchase logic removed');
    } else {
      console.log('   ⚠️ Old problematic purchase logic still present');
    }

    // Check Fix 2: Click to Call Enhancement
    console.log('\n✅ Fix 2: Click to Call Enhancement');
    const clickToCallFixPattern = /actionType\.includes\('click_to_call'\) \|\| actionType\.includes\('call_confirm'\)/;
    
    if (clickToCallFixPattern.test(metaApiContent)) {
      console.log('   ✅ Enhanced click to call logic found');
    } else {
      console.log('   ❌ Enhanced click to call logic NOT found');
      allFixesApplied = false;
    }

    // Check Fix 3: Booking Step 1 Proxy
    console.log('\n✅ Fix 3: Booking Step 1 Proxy');
    const bookingStep1Pattern = /actionType === 'initiate_checkout' \|\| \s*actionType === 'offsite_conversion\.fb_pixel_initiate_checkout'/;
    
    if (bookingStep1Pattern.test(metaApiContent)) {
      console.log('   ✅ Booking step 1 proxy logic found');
    } else {
      console.log('   ❌ Booking step 1 proxy logic NOT found');
      allFixesApplied = false;
    }

    // Check Fix 4: Reservation Value Accumulation
    console.log('\n✅ Fix 4: Reservation Value Accumulation');
    const reservationValuePattern = /reservation_value \+= parseFloat/;
    const oldReservationPattern = /reservation_value = parseFloat/;
    
    if (reservationValuePattern.test(metaApiContent)) {
      console.log('   ✅ Reservation value accumulation logic found');
    } else {
      console.log('   ❌ Reservation value accumulation logic NOT found');
      allFixesApplied = false;
    }

    if (!oldReservationPattern.test(metaApiContent)) {
      console.log('   ✅ Old overwriting reservation value logic removed');
    } else {
      console.log('   ⚠️ Old overwriting reservation value logic still present');
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log('========================================');
    
    if (allFixesApplied) {
      console.log('✅ ALL PARSING FIXES SUCCESSFULLY APPLIED!');
      console.log('\n🎯 Next Steps to See Changes:');
      console.log('1. 🔄 Restart your development server (npm run dev)');
      console.log('2. 🗑️ Clear browser cache (hard refresh: Cmd+Shift+R)');
      console.log('3. 🔄 Force refresh data in the dashboard');
      console.log('4. 🔍 Check if values have changed');
      console.log('\n📊 Expected Changes:');
      console.log('   - Reservations should be ~75% LOWER (40 instead of ~200+)');
      console.log('   - Click to call should be higher for Havet (69 instead of ~17)');
      console.log('   - ROAS should be more realistic');
      console.log('   - Cost per reservation should be reasonable');
    } else {
      console.log('❌ SOME FIXES NOT PROPERLY APPLIED!');
      console.log('🔧 Please review the failed checks above and re-apply fixes');
    }

    // Check if cache clearing might be needed
    console.log('\n🗑️ Cache Clearing Instructions:');
    console.log('================================');
    console.log('If fixes are applied but you still see old data:');
    console.log('');
    console.log('1. Browser Cache:');
    console.log('   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
    console.log('   - Or clear browser cache completely');
    console.log('');
    console.log('2. Application Cache:');
    console.log('   - Use the "Force Refresh Current Month" button');
    console.log('   - Or switch between clients to force fresh data load');
    console.log('');
    console.log('3. Development Server:');
    console.log('   - Stop server (Ctrl+C)');
    console.log('   - Restart with: npm run dev');

    return allFixesApplied;

  } catch (error) {
    console.error('❌ Error reading meta-api.ts file:', error.message);
    return false;
  }
}

// Run the verification
verifyParsingFixesApplied(); 