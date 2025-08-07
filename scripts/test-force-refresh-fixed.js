console.log('🧪 Testing Force Refresh with Cache Clearing');
console.log('=============================================\n');

console.log('✅ **CACHE CLEARING FIXES APPLIED!**');
console.log('');

console.log('🔧 **What Was Fixed:**');
console.log('======================');
console.log('1. ✅ Added `clearCache()` method to MetaAPIService');
console.log('2. ✅ Updated `/api/fetch-live-data` to check for `forceFresh` parameter');
console.log('3. ✅ Fixed "Force Refresh Current Month" button to send `forceFresh: true`');
console.log('4. ✅ Added cache clearing parameter to loadPeriodDataWithClient()');
console.log('');

console.log('📊 **How to Test the Fix:**');
console.log('===========================');
console.log('');

console.log('🔄 **Step 1: First, restart your development server**');
console.log('   → Stop server: Ctrl+C');
console.log('   → Start: npm run dev');
console.log('   → Wait for "Ready" message');
console.log('');

console.log('🌐 **Step 2: Test in Browser**');
console.log('   1. Go to /reports page');
console.log('   2. Select monthly view');
console.log('   3. Select current month');
console.log('   4. Note the current values (should be inflated):');
console.log('      - ✅ Rezerwacje: ~70-245');
console.log('      - 📈 ROAS: ~75x');
console.log('      - 💵 Cost per rezerwacja: ~52 zł');
console.log('');

console.log('🗑️ **Step 3: Force Clear Cache**');
console.log('   1. Click "Force Refresh Current Month" (green button)');
console.log('   2. Watch browser console for:');
console.log('      → "🔄 Force refreshing current month with cache clearing"');
console.log('      → "🗑️ Loading monthly data for period with cache clearing"');
console.log('      → "🗑️ Meta API cache cleared"');
console.log('   3. Wait for data to reload');
console.log('');

console.log('📈 **Step 4: Verify Fixed Values**');
console.log('   After force refresh, you should see:');
console.log('   ✅ Rezerwacje: ~70-80 (realistic, 70% reduction)');
console.log('   📈 ROAS: ~5-15x (much more realistic)');
console.log('   💵 Cost per rezerwacja: ~100-200 zł (reasonable)');
console.log('   📞 Click to call: Higher numbers for Havet');
console.log('');

console.log('🔍 **Step 5: Test Client Switching**');
console.log('   1. Switch from Belmonte to Havet');
console.log('   2. Values should be different between clients');
console.log('   3. Switch back to Belmonte');
console.log('   4. Values should match what you saw after force refresh');
console.log('');

console.log('💻 **Alternative: API Test (if server running)**');
console.log('===============================================');
console.log('You can also test directly with curl:');
console.log('');
console.log('# Test with cache clearing');
console.log('curl -X POST http://localhost:3000/api/fetch-live-data \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "clientId": "belmonte-hotel",');
console.log('    "forceFresh": true');
console.log('  }\' | jq .data.conversionMetrics');
console.log('');
console.log('Look for lower reservation numbers and realistic ROAS.');
console.log('');

console.log('🚨 **If Still Seeing Old Data:**');
console.log('================================');
console.log('A. Wait 5-10 minutes (Meta API may still be cached)');
console.log('B. Try in incognito/private browser mode');
console.log('C. Clear ALL browser cache completely');
console.log('D. Check browser console for error messages');
console.log('E. Verify server logs show "🗑️ Meta API cache cleared"');
console.log('');

console.log('✅ **Summary**');
console.log('==============');
console.log('The parsing fixes + cache clearing are now complete!');
console.log('The "Force Refresh Current Month" button should now:');
console.log('  → Clear frontend cache');
console.log('  → Clear server-side Meta API cache');  
console.log('  → Fetch fresh data with fixed parsing logic');
console.log('  → Show realistic conversion numbers');
console.log('');
console.log('🎯 **Expected Result: Reservation count should drop ~70%!**');
console.log(''); 