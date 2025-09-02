#!/usr/bin/env node

console.log('📊 GOOGLE ADS 400 ERROR - SERVER LOG MONITORING');
console.log('===============================================\n');

console.log('🔍 ENHANCED LOGGING ADDED TO API ROUTE');
console.log('======================================');
console.log('I have added detailed logging to the Google Ads API route:');
console.log('');
console.log('✅ Request start logging with headers');
console.log('✅ Request body parsing with detailed output');
console.log('✅ Validation step logging');
console.log('✅ Error handling with stack traces');
console.log('✅ Response status code determination');
console.log('');

console.log('🚀 NEXT STEPS TO DEBUG:');
console.log('=======================');
console.log('1. Open your terminal where the Next.js dev server is running');
console.log('2. Watch the console output carefully');
console.log('3. In your browser, go to /reports page');
console.log('4. Click the "Google Ads" toggle button');
console.log('5. Look for these log messages in the server console:');
console.log('');
console.log('   🚀 GOOGLE ADS API CALL STARTED: {...}');
console.log('   📥 REQUEST BODY PARSED: {...}');
console.log('   🚨 GOOGLE ADS API DETAILED ERROR: {...}');
console.log('');

console.log('🔍 WHAT TO LOOK FOR:');
console.log('====================');
console.log('The server logs will now show:');
console.log('');
console.log('📤 REQUEST DETAILS:');
console.log('   • Timestamp of the request');
console.log('   • Request headers (including Authorization)');
console.log('   • Parsed request body (dateRange, clientId, etc.)');
console.log('');
console.log('❌ ERROR DETAILS (if any):');
console.log('   • Exact error message');
console.log('   • Full stack trace');
console.log('   • Error type and name');
console.log('   • Where exactly the error occurred');
console.log('');

console.log('🎯 COMMON ERROR PATTERNS TO WATCH FOR:');
console.log('======================================');
console.log('');
console.log('🔑 AUTHENTICATION ERRORS:');
console.log('   "Missing or invalid authorization header"');
console.log('   "Authentication failed"');
console.log('   → Check if user is logged in');
console.log('');
console.log('🏗️ CONFIGURATION ERRORS:');
console.log('   "Google Ads credentials invalid"');
console.log('   "Google Ads refresh token not found"');
console.log('   "Customer ID not found"');
console.log('   → Check system_settings table');
console.log('');
console.log('📡 GOOGLE ADS API ERRORS:');
console.log('   "Failed to fetch Google Ads data"');
console.log('   "INVALID_CUSTOMER_ID"');
console.log('   "AUTHENTICATION_ERROR"');
console.log('   → Check Google Ads account setup');
console.log('');
console.log('🗄️ DATABASE ERRORS:');
console.log('   "relation does not exist"');
console.log('   "permission denied"');
console.log('   → Check database tables and permissions');
console.log('');

console.log('📋 DEBUGGING CHECKLIST:');
console.log('=======================');
console.log('After you see the error in server logs, check:');
console.log('');
console.log('□ Is the request body being parsed correctly?');
console.log('□ Are clientId and dateRange present?');
console.log('□ Is authentication working?');
console.log('□ Are Google Ads credentials configured?');
console.log('□ Is the Google Ads Customer ID correct?');
console.log('□ Are database tables accessible?');
console.log('');

console.log('🎉 READY TO DEBUG!');
console.log('==================');
console.log('The enhanced logging is now active.');
console.log('Go to /reports, click Google Ads, and check your server console!');
console.log('');
console.log('💡 TIP: If you don\'t see the logs, make sure your dev server is running with:');
console.log('   npm run dev');
console.log('');
console.log('Once you see the error logs, we can identify the exact cause! 🕵️‍♂️');

// Quick verification that the changes were applied
const fs = require('fs');
const path = require('path');

try {
  const apiFile = path.join(__dirname, '../src/app/api/fetch-google-ads-live-data/route.ts');
  const content = fs.readFileSync(apiFile, 'utf8');
  
  const hasStartLogging = content.includes('GOOGLE ADS API CALL STARTED');
  const hasBodyLogging = content.includes('REQUEST BODY PARSED');
  const hasErrorLogging = content.includes('GOOGLE ADS API DETAILED ERROR');
  
  console.log('');
  console.log('✅ VERIFICATION:');
  console.log('================');
  console.log(`Start logging: ${hasStartLogging ? '✅ ACTIVE' : '❌ MISSING'}`);
  console.log(`Body logging: ${hasBodyLogging ? '✅ ACTIVE' : '❌ MISSING'}`);
  console.log(`Error logging: ${hasErrorLogging ? '✅ ACTIVE' : '❌ MISSING'}`);
  
  if (hasStartLogging && hasBodyLogging && hasErrorLogging) {
    console.log('');
    console.log('🎯 All logging enhancements are active! Ready to debug!');
  }
} catch (error) {
  console.log('');
  console.log('⚠️ Could not verify logging changes (this is okay)');
}
