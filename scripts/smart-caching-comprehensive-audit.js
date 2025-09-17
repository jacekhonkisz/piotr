#!/usr/bin/env node

/**
 * SMART CACHING COMPREHENSIVE AUDIT SCRIPT
 * 
 * This script performs a complete audit of smart caching implementation across:
 * 1. Meta smart caching system
 * 2. Google Ads smart caching system
 * 3. Unified caching system
 * 4. Cache performance and data consistency
 * 5. Database cache tables and policies
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Audit results storage
const auditResults = {
  summary: {
    totalCacheSystems: 0,
    workingSystems: 0,
    brokenSystems: 0,
    startTime: new Date().toISOString(),
    endTime: null
  },
  cacheSystems: [],
  databaseTables: [],
  apiEndpoints: [],
  performance: {},
  recommendations: []
};

/**
 * Audit Meta smart caching system
 */
async function auditMetaSmartCaching() {
  const results = {
    system: 'Meta Smart Caching',
    status: 'unknown',
    components: {
      databaseTable: false,
      apiEndpoint: false,
      helperFunction: false,
      cronJobs: false
    },
    issues: [],
    performance: {}
  };

  try {
    console.log('\n🔍 Auditing Meta Smart Caching System...');

    // 1. Check database table
    console.log('   📊 Checking current_month_cache table...');
    const { data: tableData, error: tableError } = await supabase
      .from('current_month_cache')
      .select('*')
      .limit(1);

    if (tableError) {
      results.issues.push(`Database table error: ${tableError.message}`);
    } else {
      results.components.databaseTable = true;
      console.log('   ✅ current_month_cache table exists');
    }

    // 2. Check API endpoint
    console.log('   🌐 Testing /api/smart-cache endpoint...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test-client-id',
          platform: 'meta',
          forceRefresh: false
        })
      });

      if (response.ok) {
        results.components.apiEndpoint = true;
        console.log('   ✅ /api/smart-cache endpoint working');
      } else {
        results.issues.push(`API endpoint error: ${response.status}`);
      }
    } catch (error) {
      results.issues.push(`API endpoint error: ${error.message}`);
    }

    // 3. Check helper function
    console.log('   🔧 Checking smart-cache-helper.ts...');
    try {
      const helperPath = 'src/lib/smart-cache-helper.ts';
      if (fs.existsSync(helperPath)) {
        results.components.helperFunction = true;
        console.log('   ✅ smart-cache-helper.ts exists');
      } else {
        results.issues.push('smart-cache-helper.ts not found');
      }
    } catch (error) {
      results.issues.push(`Helper function error: ${error.message}`);
    }

    // 4. Check cron jobs
    console.log('   ⏰ Checking automated refresh cron jobs...');
    const { data: cronData, error: cronError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', ['meta_cache_refresh_enabled', 'meta_cache_refresh_schedule']);

    if (!cronError && cronData && cronData.length > 0) {
      results.components.cronJobs = true;
      console.log('   ✅ Cron jobs configured');
    } else {
      results.issues.push('Cron jobs not configured');
    }

    // 5. Test cache performance
    console.log('   ⚡ Testing cache performance...');
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: '8657100a-6e87-422c-97f4-b733754a9ff8', // Hotel Lambert
          platform: 'meta',
          forceRefresh: false
        })
      });

      const responseTime = Date.now() - startTime;
      results.performance.responseTime = responseTime;
      results.performance.status = response.ok ? 'success' : 'failed';

      if (response.ok) {
        const data = await response.json();
        results.performance.cacheHit = data.data?.fromCache || false;
        results.performance.cacheAge = data.data?.cacheAge || 0;
        console.log(`   ✅ Response time: ${responseTime}ms, Cache hit: ${data.data?.fromCache || false}`);
      }
    } catch (error) {
      results.performance.status = 'error';
      results.issues.push(`Performance test error: ${error.message}`);
    }

    // Determine overall status
    const workingComponents = Object.values(results.components).filter(Boolean).length;
    const totalComponents = Object.keys(results.components).length;
    
    if (workingComponents === totalComponents && results.issues.length === 0) {
      results.status = 'working';
    } else if (workingComponents > totalComponents / 2) {
      results.status = 'partially_working';
    } else {
      results.status = 'broken';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'broken';
  }

  return results;
}

/**
 * Audit Google Ads smart caching system
 */
async function auditGoogleAdsSmartCaching() {
  const results = {
    system: 'Google Ads Smart Caching',
    status: 'unknown',
    components: {
      databaseTable: false,
      apiEndpoint: false,
      helperFunction: false,
      cronJobs: false
    },
    issues: [],
    performance: {}
  };

  try {
    console.log('\n🔍 Auditing Google Ads Smart Caching System...');

    // 1. Check database tables
    console.log('   📊 Checking Google Ads cache tables...');
    const { data: monthlyTable, error: monthlyError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .limit(1);

    const { data: weeklyTable, error: weeklyError } = await supabase
      .from('google_ads_current_week_cache')
      .select('*')
      .limit(1);

    if (monthlyError || weeklyError) {
      results.issues.push(`Database table errors: ${monthlyError?.message || weeklyError?.message}`);
    } else {
      results.components.databaseTable = true;
      console.log('   ✅ Google Ads cache tables exist');
    }

    // 2. Check API endpoints
    console.log('   🌐 Testing Google Ads cache endpoints...');
    try {
      const monthlyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google-ads-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test-client-id',
          forceRefresh: false
        })
      });

      const weeklyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google-ads-smart-weekly-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test-client-id',
          forceRefresh: false
        })
      });

      if (monthlyResponse.ok && weeklyResponse.ok) {
        results.components.apiEndpoint = true;
        console.log('   ✅ Google Ads cache endpoints working');
      } else {
        results.issues.push(`API endpoint errors: Monthly ${monthlyResponse.status}, Weekly ${weeklyResponse.status}`);
      }
    } catch (error) {
      results.issues.push(`API endpoint error: ${error.message}`);
    }

    // 3. Check helper function
    console.log('   🔧 Checking google-ads-smart-cache-helper.ts...');
    try {
      const helperPath = 'src/lib/google-ads-smart-cache-helper.ts';
      if (fs.existsSync(helperPath)) {
        results.components.helperFunction = true;
        console.log('   ✅ google-ads-smart-cache-helper.ts exists');
      } else {
        results.issues.push('google-ads-smart-cache-helper.ts not found');
      }
    } catch (error) {
      results.issues.push(`Helper function error: ${error.message}`);
    }

    // 4. Check cron jobs
    console.log('   ⏰ Checking Google Ads cron jobs...');
    const { data: cronData, error: cronError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', ['google_ads_cache_refresh_enabled', 'google_ads_cache_refresh_schedule']);

    if (!cronError && cronData && cronData.length > 0) {
      results.components.cronJobs = true;
      console.log('   ✅ Google Ads cron jobs configured');
    } else {
      results.issues.push('Google Ads cron jobs not configured');
    }

    // 5. Test cache performance
    console.log('   ⚡ Testing Google Ads cache performance...');
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google-ads-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: '8657100a-6e87-422c-97f4-b733754a9ff8', // Hotel Lambert
          forceRefresh: false
        })
      });

      const responseTime = Date.now() - startTime;
      results.performance.responseTime = responseTime;
      results.performance.status = response.ok ? 'success' : 'failed';

      if (response.ok) {
        const data = await response.json();
        results.performance.cacheHit = data.data?.fromCache || false;
        results.performance.cacheAge = data.data?.cacheAge || 0;
        console.log(`   ✅ Response time: ${responseTime}ms, Cache hit: ${data.data?.fromCache || false}`);
      }
    } catch (error) {
      results.performance.status = 'error';
      results.issues.push(`Performance test error: ${error.message}`);
    }

    // Determine overall status
    const workingComponents = Object.values(results.components).filter(Boolean).length;
    const totalComponents = Object.keys(results.components).length;
    
    if (workingComponents === totalComponents && results.issues.length === 0) {
      results.status = 'working';
    } else if (workingComponents > totalComponents / 2) {
      results.status = 'partially_working';
    } else {
      results.status = 'broken';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'broken';
  }

  return results;
}

/**
 * Audit unified caching system
 */
async function auditUnifiedCaching() {
  const results = {
    system: 'Unified Caching',
    status: 'unknown',
    components: {
      apiEndpoint: false,
      helperFunction: false,
      parallelFetching: false
    },
    issues: [],
    performance: {}
  };

  try {
    console.log('\n🔍 Auditing Unified Caching System...');

    // 1. Check API endpoint
    console.log('   🌐 Testing /api/unified-smart-cache endpoint...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/unified-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test-client-id',
          forceRefresh: false
        })
      });

      if (response.ok) {
        results.components.apiEndpoint = true;
        console.log('   ✅ /api/unified-smart-cache endpoint working');
      } else {
        results.issues.push(`Unified API endpoint error: ${response.status}`);
      }
    } catch (error) {
      results.issues.push(`Unified API endpoint error: ${error.message}`);
    }

    // 2. Check helper function
    console.log('   🔧 Checking unified-smart-cache-helper.ts...');
    try {
      const helperPath = 'src/lib/unified-smart-cache-helper.ts';
      if (fs.existsSync(helperPath)) {
        results.components.helperFunction = true;
        console.log('   ✅ unified-smart-cache-helper.ts exists');
      } else {
        results.issues.push('unified-smart-cache-helper.ts not found');
      }
    } catch (error) {
      results.issues.push(`Helper function error: ${error.message}`);
    }

    // 3. Test parallel fetching
    console.log('   ⚡ Testing parallel fetching...');
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/unified-smart-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: '8657100a-6e87-422c-97f4-b733754a9ff8', // Hotel Lambert
          forceRefresh: false
        })
      });

      const responseTime = Date.now() - startTime;
      results.performance.responseTime = responseTime;
      results.performance.status = response.ok ? 'success' : 'failed';

      if (response.ok) {
        const data = await response.json();
        results.performance.hasMetaData = !!data.data?.meta;
        results.performance.hasGoogleAdsData = !!data.data?.googleAds;
        console.log(`   ✅ Response time: ${responseTime}ms, Meta: ${!!data.data?.meta}, Google Ads: ${!!data.data?.googleAds}`);
      }
    } catch (error) {
      results.performance.status = 'error';
      results.issues.push(`Performance test error: ${error.message}`);
    }

    // Determine overall status
    const workingComponents = Object.values(results.components).filter(Boolean).length;
    const totalComponents = Object.keys(results.components).length;
    
    if (workingComponents === totalComponents && results.issues.length === 0) {
      results.status = 'working';
    } else if (workingComponents > totalComponents / 2) {
      results.status = 'partially_working';
    } else {
      results.status = 'broken';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'broken';
  }

  return results;
}

/**
 * Audit database cache tables
 */
async function auditDatabaseCacheTables() {
  const results = {
    tables: [],
    totalTables: 0,
    workingTables: 0,
    issues: []
  };

  try {
    console.log('\n🔍 Auditing Database Cache Tables...');

    const cacheTables = [
      'current_month_cache',
      'google_ads_current_month_cache',
      'google_ads_current_week_cache',
      'executive_summaries'
    ];

    for (const tableName of cacheTables) {
      console.log(`   📊 Checking ${tableName} table...`);
      
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          results.issues.push(`${tableName}: ${error.message}`);
        } else {
          results.workingTables++;
          results.tables.push({
            name: tableName,
            status: 'working',
            recordCount: data?.length || 0
          });
          console.log(`   ✅ ${tableName} table working`);
        }
      } catch (error) {
        results.issues.push(`${tableName}: ${error.message}`);
        results.tables.push({
          name: tableName,
          status: 'broken',
          error: error.message
        });
      }
    }

    results.totalTables = cacheTables.length;

  } catch (error) {
    results.issues.push(`Database audit error: ${error.message}`);
  }

  return results;
}

/**
 * Generate comprehensive audit report
 */
function generateAuditReport() {
  const report = {
    ...auditResults,
    summary: {
      ...auditResults.summary,
      endTime: new Date().toISOString(),
      duration: new Date() - new Date(auditResults.summary.startTime)
    },
    analysis: {
      systemHealth: {},
      performance: {},
      recommendations: []
    }
  };

  // Analyze system health
  const workingSystems = auditResults.cacheSystems.filter(s => s.status === 'working').length;
  const partiallyWorkingSystems = auditResults.cacheSystems.filter(s => s.status === 'partially_working').length;
  const brokenSystems = auditResults.cacheSystems.filter(s => s.status === 'broken').length;

  report.analysis.systemHealth = {
    working: workingSystems,
    partiallyWorking: partiallyWorkingSystems,
    broken: brokenSystems,
    total: auditResults.cacheSystems.length
  };

  // Analyze performance
  const responseTimes = auditResults.cacheSystems
    .filter(s => s.performance?.responseTime)
    .map(s => s.performance.responseTime);

  report.analysis.performance = {
    averageResponseTime: responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    fastestResponse: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    slowestResponse: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    totalTests: responseTimes.length
  };

  // Generate recommendations
  if (brokenSystems > 0) {
    report.analysis.recommendations.push({
      priority: 'high',
      category: 'system_health',
      issue: `${brokenSystems} caching systems are broken`,
      action: 'Fix broken caching systems immediately'
    });
  }

  if (partiallyWorkingSystems > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'system_health',
      issue: `${partiallyWorkingSystems} caching systems are partially working`,
      action: 'Complete implementation of partially working systems'
    });
  }

  if (report.analysis.performance.averageResponseTime > 5000) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'performance',
      issue: `Average response time is ${Math.round(report.analysis.performance.averageResponseTime)}ms (target: <5000ms)`,
      action: 'Optimize cache performance'
    });
  }

  return report;
}

/**
 * Main audit function
 */
async function runSmartCachingAudit() {
  console.log('🚀 STARTING SMART CACHING COMPREHENSIVE AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Audit Meta smart caching
    const metaResults = await auditMetaSmartCaching();
    auditResults.cacheSystems.push(metaResults);

    // 2. Audit Google Ads smart caching
    const googleAdsResults = await auditGoogleAdsSmartCaching();
    auditResults.cacheSystems.push(googleAdsResults);

    // 3. Audit unified caching
    const unifiedResults = await auditUnifiedCaching();
    auditResults.cacheSystems.push(unifiedResults);

    // 4. Audit database cache tables
    const databaseResults = await auditDatabaseCacheTables();
    auditResults.databaseTables = databaseResults.tables;

    // 5. Calculate summary
    auditResults.summary.totalCacheSystems = auditResults.cacheSystems.length;
    auditResults.summary.workingSystems = auditResults.cacheSystems.filter(s => s.status === 'working').length;
    auditResults.summary.brokenSystems = auditResults.cacheSystems.filter(s => s.status === 'broken').length;

    // 6. Generate and save report
    console.log('\n📊 Generating audit report...');
    const report = generateAuditReport();
    
    // Save report to file
    const reportPath = `SMART_CACHING_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Audit report saved to: ${reportPath}`);
    
    // 7. Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Cache Systems: ${report.summary.totalCacheSystems}`);
    console.log(`Working Systems: ${report.summary.workingSystems}`);
    console.log(`Partially Working: ${report.analysis.systemHealth.partiallyWorking}`);
    console.log(`Broken Systems: ${report.summary.brokenSystems}`);
    console.log(`Database Tables: ${auditResults.databaseTables.length} checked`);
    console.log(`Average Response Time: ${Math.round(report.analysis.performance.averageResponseTime)}ms`);
    console.log(`Duration: ${Math.round(report.summary.duration / 1000)}s`);
    
    if (report.analysis.recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      report.analysis.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
        console.log(`   Action: ${rec.action}`);
      });
    }

    console.log('\n✅ Audit completed successfully!');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    auditResults.recommendations.push({
      priority: 'high',
      category: 'system_error',
      issue: `Audit failed: ${error.message}`,
      action: 'Fix audit script and re-run'
    });
  }
}

// Run the audit
runSmartCachingAudit().catch(console.error);

module.exports = { runSmartCachingAudit };
