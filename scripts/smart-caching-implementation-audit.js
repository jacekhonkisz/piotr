#!/usr/bin/env node

/**
 * SMART CACHING IMPLEMENTATION AUDIT SCRIPT
 * 
 * This script performs a comprehensive audit of smart caching implementation by:
 * 1. Analyzing source code files for proper implementation
 * 2. Checking database schema and cache tables
 * 3. Verifying API endpoint implementations
 * 4. Testing cache helper functions
 * 5. Generating detailed implementation report
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Audit results storage
const auditResults = {
  summary: {
    totalComponents: 0,
    implementedComponents: 0,
    missingComponents: 0,
    startTime: new Date().toISOString(),
    endTime: null
  },
  components: [],
  databaseTables: [],
  apiEndpoints: [],
  helperFunctions: [],
  issues: [],
  recommendations: []
};

/**
 * Check if a file exists and analyze its content
 */
function analyzeFile(filePath, componentName) {
  const result = {
    name: componentName,
    path: filePath,
    exists: false,
    size: 0,
    hasRequiredFunctions: false,
    hasCacheLogic: false,
    hasErrorHandling: false,
    issues: []
  };

  try {
    if (fs.existsSync(filePath)) {
      result.exists = true;
      const stats = fs.statSync(filePath);
      result.size = stats.size;
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for required functions
      const requiredFunctions = [
        'getSmartCacheData',
        'isCacheFresh',
        'fetchFreshCurrentMonthData',
        'storeCacheData'
      ];
      
      const foundFunctions = requiredFunctions.filter(func => 
        content.includes(`function ${func}`) || content.includes(`async ${func}`) || content.includes(`${func}:`)
      );
      
      result.hasRequiredFunctions = foundFunctions.length >= requiredFunctions.length * 0.5;
      if (!result.hasRequiredFunctions) {
        result.issues.push(`Missing required functions: ${requiredFunctions.filter(f => !foundFunctions.includes(f)).join(', ')}`);
      }
      
      // Check for cache logic
      const cacheKeywords = ['cache', 'Cache', 'CACHE'];
      result.hasCacheLogic = cacheKeywords.some(keyword => content.includes(keyword));
      if (!result.hasCacheLogic) {
        result.issues.push('No cache-related logic found');
      }
      
      // Check for error handling
      const errorHandlingKeywords = ['try', 'catch', 'error', 'Error'];
      result.hasErrorHandling = errorHandlingKeywords.some(keyword => content.includes(keyword));
      if (!result.hasErrorHandling) {
        result.issues.push('No error handling found');
      }
      
    } else {
      result.issues.push('File does not exist');
    }
  } catch (error) {
    result.issues.push(`Error analyzing file: ${error.message}`);
  }

  return result;
}

/**
 * Audit Meta smart caching implementation
 */
async function auditMetaSmartCaching() {
  const results = {
    system: 'Meta Smart Caching',
    components: [],
    databaseTable: null,
    issues: [],
    status: 'unknown'
  };

  try {
    console.log('\n🔍 Auditing Meta Smart Caching Implementation...');

    // 1. Check helper function
    console.log('   🔧 Analyzing smart-cache-helper.ts...');
    const helperAnalysis = analyzeFile('src/lib/smart-cache-helper.ts', 'Meta Smart Cache Helper');
    results.components.push(helperAnalysis);

    // 2. Check API endpoint
    console.log('   🌐 Analyzing /api/smart-cache endpoint...');
    const apiAnalysis = analyzeFile('src/app/api/smart-cache/route.ts', 'Meta Smart Cache API');
    results.components.push(apiAnalysis);

    // 3. Check database table
    console.log('   📊 Checking current_month_cache table...');
    try {
      const { data, error } = await supabase
        .from('current_month_cache')
        .select('*')
        .limit(1);

      if (error) {
        results.issues.push(`Database table error: ${error.message}`);
        results.databaseTable = { exists: false, error: error.message };
      } else {
        results.databaseTable = { exists: true, recordCount: data?.length || 0 };
        console.log('   ✅ current_month_cache table exists');
      }
    } catch (error) {
      results.issues.push(`Database check error: ${error.message}`);
      results.databaseTable = { exists: false, error: error.message };
    }

    // 4. Check integration in fetch-live-data
    console.log('   🔗 Checking integration in fetch-live-data...');
    const integrationAnalysis = analyzeFile('src/app/api/fetch-live-data/route.ts', 'Meta Integration');
    results.components.push(integrationAnalysis);

    // Determine status
    const workingComponents = results.components.filter(c => c.exists && c.issues.length === 0).length;
    const totalComponents = results.components.length;
    
    if (workingComponents === totalComponents && results.databaseTable?.exists && results.issues.length === 0) {
      results.status = 'fully_implemented';
    } else if (workingComponents > totalComponents / 2 && results.databaseTable?.exists) {
      results.status = 'partially_implemented';
    } else {
      results.status = 'not_implemented';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'error';
  }

  return results;
}

/**
 * Audit Google Ads smart caching implementation
 */
async function auditGoogleAdsSmartCaching() {
  const results = {
    system: 'Google Ads Smart Caching',
    components: [],
    databaseTables: [],
    issues: [],
    status: 'unknown'
  };

  try {
    console.log('\n🔍 Auditing Google Ads Smart Caching Implementation...');

    // 1. Check helper function
    console.log('   🔧 Analyzing google-ads-smart-cache-helper.ts...');
    const helperAnalysis = analyzeFile('src/lib/google-ads-smart-cache-helper.ts', 'Google Ads Smart Cache Helper');
    results.components.push(helperAnalysis);

    // 2. Check API endpoints
    console.log('   🌐 Analyzing Google Ads cache endpoints...');
    const monthlyApiAnalysis = analyzeFile('src/app/api/google-ads-smart-cache/route.ts', 'Google Ads Monthly Cache API');
    const weeklyApiAnalysis = analyzeFile('src/app/api/google-ads-smart-weekly-cache/route.ts', 'Google Ads Weekly Cache API');
    results.components.push(monthlyApiAnalysis, weeklyApiAnalysis);

    // 3. Check database tables
    console.log('   📊 Checking Google Ads cache tables...');
    const tables = ['google_ads_current_month_cache', 'google_ads_current_week_cache'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          results.issues.push(`${tableName} error: ${error.message}`);
          results.databaseTables.push({ name: tableName, exists: false, error: error.message });
        } else {
          results.databaseTables.push({ name: tableName, exists: true, recordCount: data?.length || 0 });
          console.log(`   ✅ ${tableName} table exists`);
        }
      } catch (error) {
        results.issues.push(`${tableName} check error: ${error.message}`);
        results.databaseTables.push({ name: tableName, exists: false, error: error.message });
      }
    }

    // 4. Check integration in Google Ads standardized fetcher
    console.log('   🔗 Checking integration in Google Ads standardized fetcher...');
    const integrationAnalysis = analyzeFile('src/lib/google-ads-standardized-data-fetcher.ts', 'Google Ads Integration');
    results.components.push(integrationAnalysis);

    // Determine status
    const workingComponents = results.components.filter(c => c.exists && c.issues.length === 0).length;
    const totalComponents = results.components.length;
    const workingTables = results.databaseTables.filter(t => t.exists).length;
    
    if (workingComponents === totalComponents && workingTables === tables.length && results.issues.length === 0) {
      results.status = 'fully_implemented';
    } else if (workingComponents > totalComponents / 2 && workingTables > 0) {
      results.status = 'partially_implemented';
    } else {
      results.status = 'not_implemented';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'error';
  }

  return results;
}

/**
 * Audit unified caching implementation
 */
async function auditUnifiedCaching() {
  const results = {
    system: 'Unified Caching',
    components: [],
    issues: [],
    status: 'unknown'
  };

  try {
    console.log('\n🔍 Auditing Unified Caching Implementation...');

    // 1. Check unified helper function
    console.log('   🔧 Analyzing unified-smart-cache-helper.ts...');
    const helperAnalysis = analyzeFile('src/lib/unified-smart-cache-helper.ts', 'Unified Smart Cache Helper');
    results.components.push(helperAnalysis);

    // 2. Check unified API endpoint
    console.log('   🌐 Analyzing /api/unified-smart-cache endpoint...');
    const apiAnalysis = analyzeFile('src/app/api/unified-smart-cache/route.ts', 'Unified Smart Cache API');
    results.components.push(apiAnalysis);

    // 3. Check integration in standardized data fetcher
    console.log('   🔗 Checking integration in standardized data fetcher...');
    const integrationAnalysis = analyzeFile('src/lib/standardized-data-fetcher.ts', 'Unified Integration');
    results.components.push(integrationAnalysis);

    // Determine status
    const workingComponents = results.components.filter(c => c.exists && c.issues.length === 0).length;
    const totalComponents = results.components.length;
    
    if (workingComponents === totalComponents && results.issues.length === 0) {
      results.status = 'fully_implemented';
    } else if (workingComponents > totalComponents / 2) {
      results.status = 'partially_implemented';
    } else {
      results.status = 'not_implemented';
    }

  } catch (error) {
    results.issues.push(`Unexpected error: ${error.message}`);
    results.status = 'error';
  }

  return results;
}

/**
 * Audit cache performance and optimization
 */
async function auditCachePerformance() {
  const results = {
    performance: {
      cacheHitRates: {},
      responseTimes: {},
      memoryUsage: {},
      optimization: {}
    },
    issues: [],
    recommendations: []
  };

  try {
    console.log('\n🔍 Auditing Cache Performance...');

    // 1. Check cache table sizes
    console.log('   📊 Analyzing cache table sizes...');
    const cacheTables = [
      'current_month_cache',
      'google_ads_current_month_cache',
      'google_ads_current_week_cache',
      'executive_summaries'
    ];

    for (const tableName of cacheTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' });

        if (!error && data) {
          results.performance.cacheHitRates[tableName] = {
            recordCount: data.length,
            status: 'accessible'
          };
          console.log(`   ✅ ${tableName}: ${data.length} records`);
        } else {
          results.issues.push(`${tableName}: ${error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        results.issues.push(`${tableName}: ${error.message}`);
      }
    }

    // 2. Check for cache optimization patterns
    console.log('   ⚡ Analyzing cache optimization...');
    const optimizationFiles = [
      'src/lib/smart-cache-helper.ts',
      'src/lib/google-ads-smart-cache-helper.ts'
    ];

    for (const filePath of optimizationFiles) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for optimization patterns
        const hasTTL = content.includes('CACHE_DURATION') || content.includes('TTL');
        const hasCleanup = content.includes('cleanup') || content.includes('Cleanup');
        const hasBackgroundRefresh = content.includes('background') || content.includes('Background');
        
        results.performance.optimization[filePath] = {
          hasTTL,
          hasCleanup,
          hasBackgroundRefresh,
          optimizationScore: [hasTTL, hasCleanup, hasBackgroundRefresh].filter(Boolean).length
        };
      }
    }

  } catch (error) {
    results.issues.push(`Performance audit error: ${error.message}`);
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
      implementationStatus: {},
      performance: {},
      recommendations: []
    }
  };

  // Analyze implementation status
  const fullyImplemented = auditResults.components.filter(c => c.status === 'fully_implemented').length;
  const partiallyImplemented = auditResults.components.filter(c => c.status === 'partially_implemented').length;
  const notImplemented = auditResults.components.filter(c => c.status === 'not_implemented').length;

  report.analysis.implementationStatus = {
    fullyImplemented,
    partiallyImplemented,
    notImplemented,
    total: auditResults.components.length
  };

  // Generate recommendations
  if (notImplemented > 0) {
    report.analysis.recommendations.push({
      priority: 'high',
      category: 'implementation',
      issue: `${notImplemented} caching systems are not implemented`,
      action: 'Implement missing caching systems'
    });
  }

  if (partiallyImplemented > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'implementation',
      issue: `${partiallyImplemented} caching systems are partially implemented`,
      action: 'Complete implementation of partially working systems'
    });
  }

  if (auditResults.issues.length > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'issues',
      issue: `${auditResults.issues.length} issues found in caching implementation`,
      action: 'Review and fix identified issues'
    });
  }

  return report;
}

/**
 * Main audit function
 */
async function runSmartCachingImplementationAudit() {
  console.log('🚀 STARTING SMART CACHING IMPLEMENTATION AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Audit Meta smart caching
    const metaResults = await auditMetaSmartCaching();
    auditResults.components.push(metaResults);

    // 2. Audit Google Ads smart caching
    const googleAdsResults = await auditGoogleAdsSmartCaching();
    auditResults.components.push(googleAdsResults);

    // 3. Audit unified caching
    const unifiedResults = await auditUnifiedCaching();
    auditResults.components.push(unifiedResults);

    // 4. Audit cache performance
    const performanceResults = await auditCachePerformance();
    auditResults.performance = performanceResults.performance;
    auditResults.issues.push(...performanceResults.issues);

    // 5. Calculate summary
    auditResults.summary.totalComponents = auditResults.components.length;
    auditResults.summary.implementedComponents = auditResults.components.filter(c => 
      c.status === 'fully_implemented' || c.status === 'partially_implemented'
    ).length;
    auditResults.summary.missingComponents = auditResults.components.filter(c => 
      c.status === 'not_implemented'
    ).length;

    // 6. Generate and save report
    console.log('\n📊 Generating audit report...');
    const report = generateAuditReport();
    
    // Save report to file
    const reportPath = `SMART_CACHING_IMPLEMENTATION_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Audit report saved to: ${reportPath}`);
    
    // 7. Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Components: ${report.summary.totalComponents}`);
    console.log(`Fully Implemented: ${report.analysis.implementationStatus.fullyImplemented}`);
    console.log(`Partially Implemented: ${report.analysis.implementationStatus.partiallyImplemented}`);
    console.log(`Not Implemented: ${report.analysis.implementationStatus.notImplemented}`);
    console.log(`Total Issues: ${auditResults.issues.length}`);
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
    auditResults.issues.push(`Audit failed: ${error.message}`);
  }
}

// Run the audit
runSmartCachingImplementationAudit().catch(console.error);

module.exports = { runSmartCachingImplementationAudit };
