#!/usr/bin/env node

console.log('🔍 SERVER LOGS DEBUGGING GUIDE');
console.log('==============================\n');

console.log('🎯 ROOT CAUSE ANALYSIS:');
console.log('=======================');
console.log('The 400 error is happening but we\'re not seeing our detailed logs.');
console.log('This means the error occurs BEFORE our logging starts.');
console.log('');

console.log('🔍 POSSIBLE CAUSES:');
console.log('===================');
console.log('1. ❌ Middleware authentication failure');
console.log('2. ❌ Request body parsing error');
console.log('3. ❌ TypeScript compilation error');
console.log('4. ❌ Import/module loading error');
console.log('5. ❌ Database connection error');
console.log('6. ❌ Environment variables missing');
console.log('');

console.log('🚀 DEBUGGING STEPS:');
console.log('===================');
console.log('');

console.log('STEP 1: Check Server Console');
console.log('----------------------------');
console.log('Look at your terminal where `npm run dev` is running.');
console.log('When you click "Google Ads", you should see:');
console.log('');
console.log('✅ GOOD SIGNS:');
console.log('   🚀 GOOGLE ADS API CALL STARTED: {...}');
console.log('   📥 REQUEST BODY PARSED: {...}');
console.log('');
console.log('❌ BAD SIGNS:');
console.log('   - No logs at all');
console.log('   - TypeScript compilation errors');
console.log('   - Module import errors');
console.log('   - Authentication middleware errors');
console.log('');

console.log('STEP 2: Test Simple API Route');
console.log('-----------------------------');
console.log('Let\'s test if the basic API routing works:');
console.log('');
console.log('curl http://localhost:3000/api/health');
console.log('');
console.log('This should return a health check response.');
console.log('');

console.log('STEP 3: Check Authentication');
console.log('----------------------------');
console.log('Make sure you are logged in to the application:');
console.log('1. Go to http://localhost:3000/auth/login');
console.log('2. Log in with belmonte@hotel.com');
console.log('3. Then try the Google Ads integration');
console.log('');

console.log('STEP 4: Check for Compilation Errors');
console.log('------------------------------------');
console.log('Look for any red error messages in your server console like:');
console.log('   - "Failed to compile"');
console.log('   - "Module not found"');
console.log('   - "Type error"');
console.log('   - "Syntax error"');
console.log('');

console.log('🔧 IMMEDIATE FIXES TO TRY:');
console.log('===========================');
console.log('');

console.log('FIX 1: Add Basic Logging to API Route');
console.log('-------------------------------------');
console.log('I\'ll add a simple console.log at the very start of the API route');
console.log('to see if it\'s even being reached.');
console.log('');

console.log('FIX 2: Check TypeScript Compilation');
console.log('-----------------------------------');
console.log('Run: npm run build');
console.log('This will show any TypeScript errors that might be causing issues.');
console.log('');

console.log('FIX 3: Restart with Clean Cache');
console.log('-------------------------------');
console.log('Sometimes Next.js cache causes issues:');
console.log('1. Kill the server (Ctrl+C)');
console.log('2. rm -rf .next');
console.log('3. npm run dev');
console.log('');

console.log('🎯 NEXT ACTIONS:');
console.log('================');
console.log('1. Check your server console when clicking Google Ads');
console.log('2. Tell me exactly what you see (or don\'t see)');
console.log('3. I\'ll add more targeted debugging based on what we find');
console.log('');
console.log('💡 The key is to see if our API route is even being reached!');

// Let's also add a simple test
console.log('');
console.log('🧪 QUICK TEST:');
console.log('==============');
console.log('Run this command to test basic connectivity:');
console.log('');
console.log('curl -X POST http://localhost:3000/api/fetch-google-ads-live-data \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"test": "data"}\'');
console.log('');
console.log('This should at least reach our API route and show some logs.');
