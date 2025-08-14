#!/usr/bin/env node

/**
 * Local Cron Simulator
 * 
 * This script simulates Vercel cron jobs for local development.
 * It runs the same schedule as vercel.json but calls localhost endpoints.
 * 
 * Usage:
 * - Run once: node scripts/local-cron-simulator.js
 * - Run continuously: node scripts/local-cron-simulator.js --watch
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

const LOCAL_API_BASE = 'http://localhost:3000';

// Cron jobs from vercel.json
const CRON_JOBS = [
  {
    name: 'Daily KPI Collection',
    schedule: '0 1 * * *', // Daily at 1 AM
    endpoint: '/api/automated/daily-kpi-collection',
    description: 'Collect daily KPI data for all clients'
  },
  {
    name: 'Refresh Current Month Cache',
    schedule: '0 */3 * * *', // Every 3 hours
    endpoint: '/api/automated/refresh-current-month-cache',
    description: 'Refresh current month cache every 3 hours'
  },
  {
    name: 'Refresh Current Week Cache', 
    schedule: '15 */3 * * *', // Every 3 hours at 15 minutes
    endpoint: '/api/automated/refresh-current-week-cache',
    description: 'Refresh current week cache every 3 hours'
  },
  {
    name: 'Send Scheduled Reports',
    schedule: '0 9 * * *', // Daily at 9 AM
    endpoint: '/api/automated/send-scheduled-reports',
    description: 'Send scheduled reports daily'
  }
];

/**
 * Execute a cron job
 */
async function executeCronJob(job) {
  const startTime = Date.now();
  console.log(`\n🚀 [${new Date().toISOString()}] Starting: ${job.name}`);
  console.log(`📍 Endpoint: ${job.endpoint}`);
  
  try {
    const response = await fetch(`${LOCAL_API_BASE}${job.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`✅ [${job.name}] Completed successfully in ${duration}ms`);
      if (result.summary) {
        console.log(`📊 Summary:`, result.summary);
      }
    } else {
      console.log(`❌ [${job.name}] Failed:`, result.error || 'Unknown error');
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ [${job.name}] Error after ${duration}ms:`, error.message);
  }
}

/**
 * Test all endpoints manually (for immediate testing)
 */
async function testAllEndpoints() {
  console.log('🧪 TESTING ALL CRON ENDPOINTS MANUALLY');
  console.log('=======================================');
  
  for (const job of CRON_JOBS) {
    await executeCronJob(job);
    // Wait 2 seconds between jobs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 All cron job tests completed!');
}

/**
 * Start the cron scheduler (continuous mode)
 */
function startCronScheduler() {
  console.log('⏰ STARTING LOCAL CRON SCHEDULER');
  console.log('=================================');
  console.log('🔄 This will run continuously and execute jobs on schedule');
  console.log('🛑 Press Ctrl+C to stop\n');
  
  // Schedule each job
  CRON_JOBS.forEach(job => {
    console.log(`📅 Scheduled: ${job.name} (${job.schedule})`);
    
    cron.schedule(job.schedule, () => {
      executeCronJob(job);
    }, {
      timezone: 'UTC' // Same as Vercel
    });
  });
  
  console.log('\n✅ All cron jobs scheduled successfully!');
  console.log('📊 Jobs will run according to their schedule');
  
  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping local cron scheduler...');
    process.exit(0);
  });
}

/**
 * Show next execution times
 */
function showNextExecutions() {
  console.log('\n📅 NEXT SCHEDULED EXECUTIONS:');
  console.log('==============================');
  
  CRON_JOBS.forEach(job => {
    // This is a simplified version - for exact times you'd need a proper cron parser
    console.log(`${job.name}:`);
    console.log(`  Schedule: ${job.schedule}`);
    console.log(`  Description: ${job.description}`);
    console.log('');
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--watch') || args.includes('-w')) {
    startCronScheduler();
  } else if (args.includes('--test') || args.includes('-t')) {
    await testAllEndpoints();
  } else if (args.includes('--schedule') || args.includes('-s')) {
    showNextExecutions();
  } else {
    console.log('🔧 LOCAL CRON SIMULATOR');
    console.log('========================');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/local-cron-simulator.js --test     # Test all endpoints once');
    console.log('  node scripts/local-cron-simulator.js --watch    # Run continuously on schedule');
    console.log('  node scripts/local-cron-simulator.js --schedule # Show next executions');
    console.log('');
    console.log('💡 Tip: Use --test first to verify all endpoints are working');
    console.log('');
    
    // Default action: test all endpoints
    await testAllEndpoints();
  }
}

// Install node-cron if not present
try {
  require('node-cron');
} catch (error) {
  console.log('❌ node-cron package not found. Installing...');
  console.log('📦 Run: npm install node-cron');
  process.exit(1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { executeCronJob, testAllEndpoints }; 