#!/usr/bin/env node

/**
 * Test 3-Hour Automation
 * Manually triggers the 3-hour cache refresh to test it works
 */

require('dotenv').config({ path: '.env.local' });

// For local development, use localhost. For production, use your domain
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-domain.com' 
  : 'http://localhost:3000';
const AUTOMATION_URL = BASE_URL + '/api/automated/refresh-3hour-cache';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAutomation() {
  log('🧪 Testing 3-Hour Cache Refresh Automation', 'bold');
  log('===========================================', 'blue');
  
  if (!AUTOMATION_URL || !AUTOMATION_KEY) {
    log('❌ Missing environment variables', 'red');
    log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', 'red');
    process.exit(1);
  }
  
  log(`📡 Endpoint: ${AUTOMATION_URL}`, 'blue');
  log('🔄 Triggering automation...', 'yellow');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(AUTOMATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTOMATION_KEY}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      log('✅ Automation completed successfully!', 'green');
      log(`⏱️  Response time: ${responseTime}ms`, 'blue');
      
      if (data.summary) {
        log('📊 Summary:', 'bold');
        log(`   Total Clients: ${data.summary.totalClients}`, 'blue');
        log(`   Successful: ${data.summary.successful}`, 'green');
        log(`   Errors: ${data.summary.errors}`, data.summary.errors > 0 ? 'red' : 'blue');
        log(`   Skipped: ${data.summary.skipped}`, 'yellow');
        log(`   Total Time: ${(data.summary.responseTime / 1000).toFixed(1)}s`, 'blue');
      }
      
      if (data.results && data.results.length > 0) {
        log('\\n📋 Client Results:', 'bold');
        data.results.forEach((result, index) => {
          const statusColor = result.status === 'success' ? 'green' : 
                             result.status === 'error' ? 'red' : 'yellow';
          
          log(`   ${index + 1}. ${result.clientName}`, 'blue');
          log(`      Status: ${result.status}`, statusColor);
          
          if (result.monthlyCache) {
            log(`      Monthly: ${result.monthlyCache.status}`, statusColor);
            if (result.monthlyCache.campaigns) {
              log(`        Campaigns: ${result.monthlyCache.campaigns}`, 'blue');
            }
            if (result.monthlyCache.spend) {
              log(`        Spend: ${result.monthlyCache.spend.toFixed(2)} PLN`, 'blue');
            }
          }
          
          if (result.weeklyCache) {
            log(`      Weekly: ${result.weeklyCache.status}`, statusColor);
            if (result.weeklyCache.campaigns) {
              log(`        Campaigns: ${result.weeklyCache.campaigns}`, 'blue');
            }
          }
          
          if (result.error) {
            log(`      Error: ${result.error}`, 'red');
          }
          
          log(`      Response Time: ${result.responseTime}ms`, 'blue');
          log(''); // Empty line
        });
      }
      
    } else {
      log(`❌ Automation failed: HTTP ${response.status}`, 'red');
      
      try {
        const errorData = await response.text();
        log(`Error details: ${errorData}`, 'red');
      } catch (e) {
        log('Could not read error details', 'red');
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    log(`❌ Request failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testAutomation().catch(error => {
    log(`❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testAutomation }; 