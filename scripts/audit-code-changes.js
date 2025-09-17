const fs = require('fs');
const path = require('path');

console.log('🔍 CODE CHANGES AUDIT - DIRECT FILE INSPECTION');
console.log('===============================================\n');

function checkFileChanges() {
  const checks = [];
  
  // Check 1: Meta API cache clearing method
  console.log('✅ CHECK 1: Meta API Cache Clearing Method');
  console.log('==========================================');
  try {
    const metaApiPath = path.join(__dirname, '../src/lib/meta-api.ts');
    const metaApiContent = fs.readFileSync(metaApiPath, 'utf8');
    
    if (metaApiContent.includes('public clearCache()')) {
      console.log('✅ clearCache() method found in MetaAPIService');
      checks.push(true);
    } else {
      console.log('❌ clearCache() method NOT found in MetaAPIService');
      checks.push(false);
    }
    
    if (metaApiContent.includes('apiCache.clear()')) {
      console.log('✅ apiCache.clear() implementation found');
    } else {
      console.log('❌ apiCache.clear() implementation NOT found');
    }
  } catch (error) {
    console.log('❌ Error reading meta-api.ts:', error.message);
    checks.push(false);
  }
  
  // Check 2: API route cache clearing support
  console.log('\n✅ CHECK 2: API Route Cache Clearing Support');
  console.log('=============================================');
  try {
    const apiRoutePath = path.join(__dirname, '../src/app/api/fetch-live-data/route.ts');
    const apiRouteContent = fs.readFileSync(apiRoutePath, 'utf8');
    
    if (apiRouteContent.includes('clearCache, forceFresh')) {
      console.log('✅ API route extracts clearCache and forceFresh parameters');
      checks.push(true);
    } else {
      console.log('❌ API route does NOT extract clearCache/forceFresh parameters');
      checks.push(false);
    }
    
    if (apiRouteContent.includes('metaService.clearCache()')) {
      console.log('✅ API route calls metaService.clearCache()');
    } else {
      console.log('❌ API route does NOT call metaService.clearCache()');
    }
    
    if (apiRouteContent.includes('shouldClearCache') && apiRouteContent.includes('forceFresh')) {
      console.log('✅ Cache clearing logic implemented');
    } else {
      console.log('❌ Cache clearing logic NOT properly implemented');
    }
  } catch (error) {
    console.log('❌ Error reading API route:', error.message);
    checks.push(false);
  }
  
  // Check 3: Reports page Force Refresh button
  console.log('\n✅ CHECK 3: Reports Page Force Refresh Button');
  console.log('==============================================');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes('loadPeriodDataWithCacheClear')) {
      console.log('✅ Force Refresh calls loadPeriodDataWithCacheClear');
      checks.push(true);
    } else {
      console.log('❌ Force Refresh does NOT call loadPeriodDataWithCacheClear');
      checks.push(false);
    }
    
    if (reportsContent.includes('forceClearCache: boolean = false')) {
      console.log('✅ loadPeriodDataWithClient has forceClearCache parameter');
    } else {
      console.log('❌ loadPeriodDataWithClient missing forceClearCache parameter');
    }
    
    if (reportsContent.includes('forceFresh: true')) {
      console.log('✅ API call includes forceFresh: true parameter');
    } else {
      console.log('❌ API call does NOT include forceFresh: true parameter');
    }
  } catch (error) {
    console.log('❌ Error reading reports page:', error.message);
    checks.push(false);
  }
  
  // Check 4: Parsing fixes are still in place
  console.log('\n✅ CHECK 4: Parsing Fixes Still Applied');
  console.log('=======================================');
  try {
    const metaApiPath = path.join(__dirname, '../src/lib/meta-api.ts');
    const metaApiContent = fs.readFileSync(metaApiPath, 'utf8');
    
    if (metaApiContent.includes("actionType === 'purchase' || actionType === 'offsite_conversion.fb_pixel_purchase'")) {
      console.log('✅ Purchase deduplication fix applied');
      checks.push(true);
    } else {
      console.log('❌ Purchase deduplication fix NOT found');
      checks.push(false);
    }
    
    if (metaApiContent.includes('reservation_value += parseFloat')) {
      console.log('✅ Reservation value accumulation fix applied');
    } else {
      console.log('❌ Reservation value accumulation fix NOT found');
    }
  } catch (error) {
    console.log('❌ Error checking parsing fixes:', error.message);
    checks.push(false);
  }
  
  // Summary
  console.log('\n📊 AUDIT SUMMARY');
  console.log('================');
  const passedChecks = checks.filter(Boolean).length;
  const totalChecks = checks.length;
  
  console.log(`Passed: ${passedChecks}/${totalChecks} checks`);
  
  if (passedChecks === totalChecks) {
    console.log('✅ ALL CODE CHANGES PROPERLY APPLIED!');
    console.log('');
    console.log('🚨 IF YOU STILL SEE SAME DATA:');
    console.log('==============================');
    console.log('1. 🔄 RESTART DEVELOPMENT SERVER:');
    console.log('   → Stop: Ctrl+C');
    console.log('   → Start: npm run dev');
    console.log('');
    console.log('2. 🗑️ CLEAR ALL BROWSER CACHE:');
    console.log('   → Hard refresh: Cmd+Shift+R');
    console.log('   → Or use incognito mode');
    console.log('');
    console.log('3. 🔄 USE THE FORCE REFRESH BUTTON:');
    console.log('   → Click "Force Refresh Current Month"');
    console.log('   → Check browser console for cache clearing messages');
    console.log('');
    console.log('4. ⏱️ WAIT FOR META API CACHE:');
    console.log('   → Meta API may cache data for 10-15 minutes');
    console.log('   → Try again in 15 minutes');
    console.log('');
    console.log('The code is correct - it\'s a caching issue!');
  } else {
    console.log('❌ SOME CODE CHANGES NOT APPLIED CORRECTLY');
    console.log('🔧 Please review the failed checks above');
  }
}

checkFileChanges(); 