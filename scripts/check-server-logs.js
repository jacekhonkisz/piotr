console.log('🔍 HOW TO CHECK SERVER LOGS FOR META API DEBUG');
console.log('==============================================\n');

console.log('📍 **Where to Look for Debug Logs:**');
console.log('====================================');
console.log('❌ NOT in browser console (what you showed)');
console.log('✅ In your TERMINAL where you run "npm run dev"');
console.log('');

console.log('🖥️ **Your Terminal Should Show:**');
console.log('=================================');
console.log('When you refresh /reports, look for these messages in terminal:');
console.log('');
console.log('✅ "🔄 LIVE FETCH: Always fetching fresh campaign insights (no cache)"');
console.log('✅ "🔍 RAW ACTIONS for campaign [PBM] HOT | Remarketing:"');
console.log('✅ "   📊 Action: purchase = 5"');
console.log('✅ "   📊 Action: link_click = 124"');
console.log('✅ "🔍 RAW ACTION_VALUES for campaign [PBM] HOT:"');
console.log('✅ "   💰 Action Value: purchase = 1250.00"');
console.log('✅ "📊 FINAL CALCULATIONS for [PBM] HOT:"');
console.log('');

console.log('🔍 **What I See from Your Browser Console:**');
console.log('============================================');
console.log('📊 91 campaigns returned from Meta API');
console.log('💰 Total spend: 3,638.19 zł');
console.log('🎯 Total conversions: 1,285');
console.log('');
console.log('This explains why your numbers are high:');
console.log('✅ 91 campaigns × multiple conversions each = 72+ reservations');
console.log('✅ High reservation value ÷ low spend per reservation = high ROAS');
console.log('');

console.log('🎯 **Next Steps:**');
console.log('==================');
console.log('1. 📱 Go to your TERMINAL (not browser)');
console.log('2. 🔄 Refresh the /reports page');
console.log('3. 👀 Watch the terminal for debug messages');
console.log('4. 📋 Copy/paste a few lines of the Meta API debug output');
console.log('');

console.log('💡 **Alternative: Quick Fix**');
console.log('=============================');
console.log('Since you have 91 campaigns, the numbers might actually be correct!');
console.log('This could be legitimate data from a highly successful ad account.');
console.log('');
console.log('✅ 72 reservations across 91 campaigns = ~0.8 reservations per campaign');
console.log('✅ High ROAS might be real if campaigns are performing well');
console.log('✅ Low cost per reservation might be accurate for efficient campaigns');
console.log('');

console.log('🎯 **Check your terminal NOW and look for the debug messages!**');
console.log(''); 