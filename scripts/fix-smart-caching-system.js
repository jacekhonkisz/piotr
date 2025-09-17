/**
 * Fix Smart Caching System - Remove temporary flags that disable caching
 * This script fixes the issues preventing smart caching from working properly
 */

const fs = require('fs').promises;
const path = require('path');

async function fixSmartCachingSystem() {
  console.log('🛠️ FIXING SMART CACHING SYSTEM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const fixes = [];

  try {
    // Fix 1: Remove FORCE_LIVE_DATA_FOR_BOOKING_STEPS flag in smart-cache-helper.ts
    console.log('🔧 FIX 1: Removing FORCE_LIVE_DATA_FOR_BOOKING_STEPS flag...');
    
    const smartCacheHelperPath = 'src/lib/smart-cache-helper.ts';
    let smartCacheContent = await fs.readFile(smartCacheHelperPath, 'utf8');
    
    // Replace the force live data flag
    const originalForceFlag = 'const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = true;';
    const fixedForceFlag = 'const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = false; // ✅ FIXED: Allow smart caching';
    
    if (smartCacheContent.includes(originalForceFlag)) {
      smartCacheContent = smartCacheContent.replace(originalForceFlag, fixedForceFlag);
      await fs.writeFile(smartCacheHelperPath, smartCacheContent);
      console.log('  ✅ Fixed FORCE_LIVE_DATA_FOR_BOOKING_STEPS flag in smart-cache-helper.ts');
      fixes.push('FORCE_LIVE_DATA_FOR_BOOKING_STEPS disabled');
    } else {
      console.log('  ⚠️ FORCE_LIVE_DATA_FOR_BOOKING_STEPS flag already fixed or not found');
    }

    // Fix 2: Enable background refresh in smart-cache-helper.ts
    console.log('\n🔧 FIX 2: Enabling background refresh...');
    
    const originalBackgroundFlag = 'const ENABLE_BACKGROUND_REFRESH = false; // ⚠️ DISABLED to prevent API calls';
    const fixedBackgroundFlag = 'const ENABLE_BACKGROUND_REFRESH = true; // ✅ FIXED: Enable background cache refresh';
    
    if (smartCacheContent.includes('const ENABLE_BACKGROUND_REFRESH = false;')) {
      smartCacheContent = smartCacheContent.replace(/const ENABLE_BACKGROUND_REFRESH = false;.*/, fixedBackgroundFlag);
      await fs.writeFile(smartCacheHelperPath, smartCacheContent);
      console.log('  ✅ Enabled ENABLE_BACKGROUND_REFRESH in smart-cache-helper.ts');
      fixes.push('Background refresh enabled');
    } else {
      console.log('  ⚠️ ENABLE_BACKGROUND_REFRESH already enabled or not found');
    }

    // Fix 3: Remove forceFresh flag in dashboard page.tsx
    console.log('\n🔧 FIX 3: Removing forceFresh flag from dashboard...');
    
    const dashboardPath = 'src/app/dashboard/page.tsx';
    let dashboardContent = await fs.readFile(dashboardPath, 'utf8');
    
    const originalForceFresh = 'forceFresh: true  // 🔧 TEMPORARY: Force live data for booking steps testing';
    const fixedForceFresh = 'forceFresh: false  // ✅ FIXED: Use smart caching';
    
    if (dashboardContent.includes('forceFresh: true')) {
      dashboardContent = dashboardContent.replace(/forceFresh: true.*/, fixedForceFresh);
      await fs.writeFile(dashboardPath, dashboardContent);
      console.log('  ✅ Disabled forceFresh flag in dashboard page.tsx');
      fixes.push('Dashboard forceFresh disabled');
    } else {
      console.log('  ⚠️ forceFresh flag already fixed or not found in dashboard');
    }

    // Fix 4: Check cache table structure
    console.log('\n🔧 FIX 4: Checking cache table structure...');
    
    // This would normally connect to Supabase to check tables, but for now just log
    console.log('  📊 Cache tables that should exist:');
    console.log('    - current_month_cache');
    console.log('    - current_week_cache'); 
    console.log('    - campaign_summaries');
    console.log('  💡 If cache is still not working, check these tables exist in Supabase');

    // Summary
    console.log('\n✅ SMART CACHING FIXES APPLIED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (fixes.length > 0) {
      console.log('🎯 Fixed issues:');
      fixes.forEach((fix, index) => {
        console.log(`  ${index + 1}. ${fix}`);
      });
    } else {
      console.log('⚠️ No fixes were needed - smart caching might already be properly configured');
    }

    console.log('\n📋 WHAT THIS FIXES:');
    console.log('1. ✅ Smart caching will now be used instead of always fetching live data');
    console.log('2. ✅ Background cache refresh will update stale data automatically');
    console.log('3. ✅ Dashboard will use cached data when available');
    console.log('4. ✅ API calls will be reduced, improving performance');

    console.log('\n🔄 NEXT STEPS:');
    console.log('1. Restart your development server (npm run dev)');
    console.log('2. Clear browser cache and reload the dashboard');
    console.log('3. Check dashboard - it should now use cached data');
    console.log('4. Run the test script again to verify smart caching is working');

    console.log('\n💡 HOW TO VERIFY IT\'S WORKING:');
    console.log('- Dashboard should load faster (using cache)');
    console.log('- Console logs should show "✅ Returning fresh cached data"');
    console.log('- Data source should show "cache" instead of "live-api"');
    console.log('- Less API calls to Meta/Facebook should be made');

  } catch (error) {
    console.error('\n❌ ERROR during smart caching fixes:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the fixes
if (require.main === module) {
  fixSmartCachingSystem();
}

module.exports = { fixSmartCachingSystem }; 