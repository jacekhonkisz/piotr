#!/usr/bin/env node

console.log('🔍 TESTING GOOGLE ADS TABLES PERIOD DATA');
console.log('========================================\n');

const fs = require('fs');
const path = require('path');

// Read the GoogleAdsTables component
const googleAdsTablesFile = path.join(__dirname, '../src/components/GoogleAdsTables.tsx');
const content = fs.readFileSync(googleAdsTablesFile, 'utf8');

console.log('📊 ANALYZING GOOGLE ADS TABLES DATA FLOW:');
console.log('=========================================');

// Check if data is fetched based on period
const hasDateStartParam = content.includes('dateStart');
const hasDateEndParam = content.includes('dateEnd');
const hasFetchFunction = content.includes('fetchGoogleAdsTablesData');
const hasUseEffect = content.includes('useEffect');
const hasDateDependency = content.includes('[dateStart, dateEnd]');

console.log(`✅ dateStart parameter: ${hasDateStartParam ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`✅ dateEnd parameter: ${hasDateEndParam ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`✅ Fetch function: ${hasFetchFunction ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`✅ useEffect hook: ${hasUseEffect ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`✅ Date dependency: ${hasDateDependency ? '✅ PRESENT' : '❌ MISSING'}`);

console.log('\n🔍 CHECKING DATA FETCHING LOGIC:');
console.log('================================');

// Check if the component uses mock data or real API calls
const usesMockData = content.includes('Mock data for Google Ads');
const hasAPICall = content.includes('/api/fetch-google-ads-tables') || content.includes('fetch-google-ads-live-data');
const hasSupabaseCall = content.includes('supabase.from');

console.log(`📊 Uses mock data: ${usesMockData ? '⚠️ YES (ISSUE)' : '✅ NO'}`);
console.log(`🌐 Makes API calls: ${hasAPICall ? '✅ YES' : '❌ NO'}`);
console.log(`🗄️ Uses Supabase: ${hasSupabaseCall ? '✅ YES' : '❌ NO'}`);

console.log('\n🎯 IDENTIFIED ISSUES:');
console.log('====================');

if (usesMockData) {
  console.log('❌ CRITICAL ISSUE: Component uses mock data instead of real period-based data');
  console.log('❌ IMPACT: All tabs show same data regardless of selected period');
  console.log('❌ SOLUTION NEEDED: Replace mock data with real API calls');
}

if (!hasAPICall && !hasSupabaseCall) {
  console.log('❌ CRITICAL ISSUE: No real data fetching mechanism');
  console.log('❌ IMPACT: Data never updates based on period selection');
  console.log('❌ SOLUTION NEEDED: Implement proper data fetching');
}

console.log('\n🔧 REQUIRED FIXES:');
console.log('==================');
console.log('1. Replace mock data with real Google Ads API calls');
console.log('2. Use dateStart and dateEnd parameters in API requests');
console.log('3. Ensure data updates when period changes');
console.log('4. Handle loading and error states properly');

console.log('\n🚀 IMPLEMENTING FIXES...');
console.log('========================');
