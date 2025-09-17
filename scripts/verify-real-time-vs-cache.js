#!/usr/bin/env node

/**
 * Real-Time vs Cache Data Verification Script
 * 
 * Compares cached data with live Meta API data to ensure accuracy
 * Usage: node scripts/verify-real-time-vs-cache.js [--client=clientName] [--all]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get command line arguments
const args = process.argv.slice(2);
const clientFilter = args.find(arg => arg.startsWith('--client='))?.split('=')[1];
const verifyAll = args.includes('--all');

async function verifyRealTimeVsCache() {
  console.log('🔍 REAL-TIME vs CACHE VERIFICATION');
  console.log('=====================================\n');

  try {
    // Get clients to verify
    let clients;
    if (clientFilter) {
      console.log(`🎯 Verifying specific client: ${clientFilter}`);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${clientFilter}%,email.ilike.%${clientFilter}%`)
        .limit(5);
      
      if (error) throw error;
      clients = data;
    } else if (verifyAll) {
      console.log('🌐 Verifying ALL clients');
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .not('meta_access_token', 'is', null);
      
      if (error) throw error;
      clients = data;
    } else {
      // Default: verify active clients with recent activity
      console.log('📊 Verifying active clients with recent activity');
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .not('meta_access_token', 'is', null)
        .limit(10);
      
      if (error) throw error;
      clients = data;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found matching criteria');
      return;
    }

    console.log(`✅ Found ${clients.length} clients to verify\n`);

    const results = [];

    for (const client of clients) {
      console.log(`\n🔍 Verifying: ${client.name} (${client.email})`);
      console.log('-'.repeat(50));

      const verification = await verifyClientData(client);
      results.push(verification);

      // Display results
      console.log(`📊 Cache Data:`);
      console.log(`   Total Spend: ${verification.cache.totalSpend?.toFixed(2) || 'N/A'} PLN`);
      console.log(`   Cache Age: ${verification.cache.ageHours?.toFixed(1) || 'N/A'} hours`);
      console.log(`   Last Updated: ${verification.cache.lastUpdated || 'N/A'}`);

      console.log(`🔴 Live API Data:`);
      console.log(`   Total Spend: ${verification.live.totalSpend?.toFixed(2) || 'N/A'} PLN`);
      console.log(`   Campaigns: ${verification.live.campaignCount || 0}`);
      console.log(`   Fetch Time: ${verification.live.fetchTime || 'N/A'}ms`);

      console.log(`⚖️  Comparison:`);
      if (verification.comparison.spendDifference !== null) {
        console.log(`   Spend Difference: ${verification.comparison.spendDifference.toFixed(2)} PLN`);
        console.log(`   Percentage Diff: ${verification.comparison.percentageDiff?.toFixed(1) || 'N/A'}%`);
        console.log(`   Status: ${verification.comparison.status}`);
      } else {
        console.log(`   Status: ${verification.comparison.status}`);
      }

      if (verification.issues.length > 0) {
        console.log(`⚠️  Issues:`);
        verification.issues.forEach(issue => console.log(`   - ${issue}`));
      }
    }

    // Summary report
    console.log('\n📋 VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    
    const summary = {
      total: results.length,
      accurate: results.filter(r => r.comparison.status === 'ACCURATE').length,
      stale: results.filter(r => r.comparison.status === 'STALE_CACHE').length,
      significant_diff: results.filter(r => r.comparison.status === 'SIGNIFICANT_DIFFERENCE').length,
      errors: results.filter(r => r.comparison.status === 'ERROR').length
    };

    console.log(`✅ Total Clients Verified: ${summary.total}`);
    console.log(`🎯 Accurate Data: ${summary.accurate} (${(summary.accurate/summary.total*100).toFixed(1)}%)`);
    console.log(`⏰ Stale Cache: ${summary.stale} (${(summary.stale/summary.total*100).toFixed(1)}%)`);
    console.log(`⚠️  Significant Differences: ${summary.significant_diff} (${(summary.significant_diff/summary.total*100).toFixed(1)}%)`);
    console.log(`❌ Errors: ${summary.errors} (${(summary.errors/summary.total*100).toFixed(1)}%)`);

    // Save detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary,
      details: results
    };

    const fs = require('fs');
    const reportPath = `verification-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (summary.stale > 0) {
      console.log(`   - ${summary.stale} clients have stale cache (>3 hours old)`);
      console.log(`   - Consider refreshing cache or reducing cache duration`);
    }
    if (summary.significant_diff > 0) {
      console.log(`   - ${summary.significant_diff} clients have significant data differences`);
      console.log(`   - Investigate cache invalidation and API sync issues`);
    }
    if (summary.errors > 0) {
      console.log(`   - ${summary.errors} clients have API or credential issues`);
      console.log(`   - Check Meta API tokens and account permissions`);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

async function verifyClientData(client) {
  const verification = {
    clientId: client.id,
    clientName: client.name,
    cache: {},
    live: {},
    comparison: {},
    issues: []
  };

  try {
    // 1. Get cached data
    console.log('   📦 Checking cached data...');
    const cacheData = await getCachedData(client.id);
    verification.cache = cacheData;

    // 2. Get live API data
    console.log('   🔴 Fetching live API data...');
    const liveData = await getLiveAPIData(client);
    verification.live = liveData;

    // 3. Compare data
    verification.comparison = compareData(cacheData, liveData);

    // 4. Identify issues
    if (cacheData.ageHours > 6) {
      verification.issues.push('Cache is older than 6 hours');
    }
    if (!liveData.success) {
      verification.issues.push(`Live API failed: ${liveData.error}`);
    }
    if (verification.comparison.percentageDiff > 10) {
      verification.issues.push('Significant difference between cache and live data');
    }

  } catch (error) {
    verification.comparison.status = 'ERROR';
    verification.comparison.error = error.message;
    verification.issues.push(`Verification error: ${error.message}`);
  }

  return verification;
}

async function getCachedData(clientId) {
  try {
    // Get current month cache
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: cacheData, error } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', clientId)
      .eq('period_id', periodId)
      .single();

    if (error || !cacheData) {
      return {
        exists: false,
        totalSpend: null,
        ageHours: null,
        lastUpdated: null
      };
    }

    const lastUpdated = new Date(cacheData.last_updated);
    const ageMs = Date.now() - lastUpdated.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    return {
      exists: true,
      totalSpend: cacheData.cache_data?.stats?.totalSpend || 0,
      campaignCount: cacheData.cache_data?.campaigns?.length || 0,
      ageHours: ageHours,
      lastUpdated: lastUpdated.toISOString(),
      rawData: cacheData.cache_data
    };

  } catch (error) {
    return {
      exists: false,
      error: error.message,
      totalSpend: null,
      ageHours: null,
      lastUpdated: null
    };
  }
}

async function getLiveAPIData(client) {
  const startTime = Date.now();
  
  try {
    // Import MetaAPIService
    const { MetaAPIService } = require('../src/lib/meta-api');
    
    if (!client.meta_access_token || !client.ad_account_id) {
      return {
        success: false,
        error: 'Missing Meta API credentials',
        totalSpend: null,
        campaignCount: 0,
        fetchTime: Date.now() - startTime
      };
    }

    const metaService = new MetaAPIService(client.meta_access_token);
    
    // Validate token first
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      return {
        success: false,
        error: `Invalid token: ${tokenValidation.error}`,
        totalSpend: null,
        campaignCount: 0,
        fetchTime: Date.now() - startTime
      };
    }

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Clean ad account ID
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // Fetch campaign insights
    const campaigns = await metaService.getCampaignInsights(
      adAccountId,
      startDate,
      endDate,
      0 // No time increment
    );

    const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);

    return {
      success: true,
      totalSpend: totalSpend,
      campaignCount: campaigns.length,
      fetchTime: Date.now() - startTime,
      dateRange: { startDate, endDate },
      rawCampaigns: campaigns
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      totalSpend: null,
      campaignCount: 0,
      fetchTime: Date.now() - startTime
    };
  }
}

function compareData(cacheData, liveData) {
  if (!cacheData.exists && !liveData.success) {
    return {
      status: 'ERROR',
      message: 'Both cache and live API failed'
    };
  }

  if (!cacheData.exists) {
    return {
      status: 'NO_CACHE',
      message: 'No cached data available',
      liveSpend: liveData.totalSpend
    };
  }

  if (!liveData.success) {
    return {
      status: 'API_ERROR',
      message: `Live API failed: ${liveData.error}`,
      cacheSpend: cacheData.totalSpend,
      cacheAge: cacheData.ageHours
    };
  }

  // Both data sources available - compare
  const cacheSpend = cacheData.totalSpend || 0;
  const liveSpend = liveData.totalSpend || 0;
  const spendDifference = Math.abs(cacheSpend - liveSpend);
  const percentageDiff = cacheSpend > 0 ? (spendDifference / cacheSpend) * 100 : 0;

  let status = 'ACCURATE';
  let message = 'Cache and live data match closely';

  if (cacheData.ageHours > 3) {
    status = 'STALE_CACHE';
    message = `Cache is ${cacheData.ageHours.toFixed(1)} hours old`;
  }

  if (percentageDiff > 5) {
    status = 'SIGNIFICANT_DIFFERENCE';
    message = `${percentageDiff.toFixed(1)}% difference between cache and live data`;
  }

  return {
    status,
    message,
    spendDifference,
    percentageDiff,
    cacheSpend,
    liveSpend,
    cacheAge: cacheData.ageHours
  };
}

// Run the verification
if (require.main === module) {
  verifyRealTimeVsCache().catch(console.error);
}

module.exports = { verifyRealTimeVsCache, verifyClientData };
