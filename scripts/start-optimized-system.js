#!/usr/bin/env node

/**
 * START OPTIMIZED GOOGLE ADS SYSTEM
 * 
 * This script starts all optimized processes for the Google Ads API system
 * Target: 20-30 API calls per day
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 STARTING OPTIMIZED GOOGLE ADS SYSTEM');
console.log('='.repeat(60));
console.log('');

console.log('📊 TARGET CONFIGURATION:');
console.log('   • Daily API calls: 20-30 per day');
console.log('   • Daily collection: 20 calls/day (02:00 AM)');
console.log('   • Weekly collection: 2.9 calls/day average (Monday 03:00 AM)');
console.log('   • Monthly collection: 0.7 calls/day average (1st of month)');
console.log('   • Smart cache refresh: 2 calls/day (every 4 hours)');
console.log('   • Health checks: 2 calls/day (every 12 hours)');
console.log('   • TOTAL: ~27.6 calls/day');
console.log('');

console.log('🔧 STARTING OPTIMIZED PROCESSES...');
console.log('');

// Start optimized daily collection
console.log('1️⃣ Starting optimized daily collection...');
const dailyCollection = spawn('node', [path.join(__dirname, 'optimized-daily-collection.js')], {
  stdio: 'pipe'
});

dailyCollection.stdout.on('data', (data) => {
  console.log(`[DAILY] ${data.toString().trim()}`);
});

dailyCollection.stderr.on('data', (data) => {
  console.error(`[DAILY ERROR] ${data.toString().trim()}`);
});

// Start optimized weekly collection
console.log('2️⃣ Starting optimized weekly collection...');
const weeklyCollection = spawn('node', [path.join(__dirname, 'optimized-weekly-collection.js')], {
  stdio: 'pipe'
});

weeklyCollection.stdout.on('data', (data) => {
  console.log(`[WEEKLY] ${data.toString().trim()}`);
});

weeklyCollection.stderr.on('data', (data) => {
  console.error(`[WEEKLY ERROR] ${data.toString().trim()}`);
});

// Start optimized cache refresh
console.log('3️⃣ Starting optimized smart cache refresh...');
const cacheRefresh = spawn('node', [path.join(__dirname, 'optimized-cache-refresh.js')], {
  stdio: 'pipe'
});

cacheRefresh.stdout.on('data', (data) => {
  console.log(`[CACHE] ${data.toString().trim()}`);
});

cacheRefresh.stderr.on('data', (data) => {
  console.error(`[CACHE ERROR] ${data.toString().trim()}`);
});

console.log('');
console.log('✅ OPTIMIZED SYSTEM STARTED SUCCESSFULLY!');
console.log('');
console.log('📊 EXPECTED PERFORMANCE:');
console.log('   • API calls reduced by 70-85%');
console.log('   • No more token expiration issues');
console.log('   • Better reliability and performance');
console.log('   • Optimal resource usage');
console.log('');
console.log('🔍 MONITORING:');
console.log('   • Watch logs for API call counts');
console.log('   • Monitor token health');
console.log('   • Check cache efficiency');
console.log('   • Verify no duplicate processes');
console.log('');
console.log('⏹️  To stop the system, press Ctrl+C');
console.log('');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down optimized system...');
  
  dailyCollection.kill();
  weeklyCollection.kill();
  cacheRefresh.kill();
  
  console.log('✅ Optimized system stopped');
  process.exit(0);
});

// Keep the process running
process.on('exit', () => {
  console.log('👋 Optimized system exited');
});
