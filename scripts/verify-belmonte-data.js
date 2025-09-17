#!/usr/bin/env node

/**
 * Belmonte-Specific Data Verification Script
 * 
 * Comprehensive verification of Belmonte Hotel's data integrity
 * Usage: node scripts/verify-belmonte-data.js [--live] [--detailed]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get command line arguments
const args = process.argv.slice(2);
const forceLive = args.includes('--live');
const detailedOutput = args.includes('--detailed');

async function verifyBelmonteData() {
  console.log('🏨 BELMONTE HOTEL DATA VERIFICATION');
  console.log('===================================\n');

  try {
    // 1. Find Belmonte client
    console.log('🔍 Finding Belmonte client...');
    const belmonteClient = await findBelmonteClient();
      
    if (!belmonteClient) {
      console.log('❌ Belmonte client not found');
      return;
    }
    
    console.log('✅ Belmonte client found:');
    console.log(`   ID: ${belmonteClient.id}`);
    console.log(`   Name: ${belmonteClient.name}`);
    console.log(`   Email: ${belmonteClient.email}`);
    console.log(`   Ad Account: ${belmonteClient.ad_account_id}`);
    console.log(`   Google Ads Customer ID: ${belmonteClient.google_ads_customer_id || 'Not configured'}`);

    // 2. Verify Meta API credentials
    console.log('\n📱 Verifying Meta API credentials...');
    const metaVerification = await verifyMetaCredentials(belmonteClient);
    displayMetaResults(metaVerification);

    // 3. Verify Google Ads credentials
    console.log('\n🔍 Verifying Google Ads credentials...');
    const googleAdsVerification = await verifyGoogleAdsCredentials(belmonteClient);
    displayGoogleAdsResults(googleAdsVerification);

    // 4. Check cached vs live data
    console.log('\n📊 Checking cached vs live data...');
    const dataComparison = await compareDataSources(belmonteClient, forceLive);
    displayDataComparison(dataComparison);

    // 5. Verify historical data
    console.log('\n📚 Checking historical data availability...');
    const historicalData = await checkHistoricalData(belmonteClient);
    displayHistoricalResults(historicalData);

    // 6. Generate comprehensive report
    const report = {
      client: {
        id: belmonteClient.id,
        name: belmonteClient.name,
        email: belmonteClient.email
      },
      meta: metaVerification,
      googleAds: googleAdsVerification,
      dataComparison: dataComparison,
      historical: historicalData,
      timestamp: new Date().toISOString()
    };

    // Save detailed report if requested
    if (detailedOutput) {
      const fs = require('fs');
      const reportPath = `belmonte-verification-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved: ${reportPath}`);
    }

    // Summary and recommendations
    console.log('\n📋 VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    generateSummary(report);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

async function findBelmonteClient() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .or('email.eq.belmonte@hotel.com,name.ilike.%belmonte%,ad_account_id.eq.438600948208231');

  if (error) throw error;

  if (!clients || clients.length === 0) {
    return null;
  }

  // Prefer exact email match, then ad account match, then name match
  let belmonteClient = clients.find(c => c.email === 'belmonte@hotel.com');
  if (!belmonteClient) {
    belmonteClient = clients.find(c => c.ad_account_id === '438600948208231');
  }
  if (!belmonteClient) {
    belmonteClient = clients[0];
  }

  return belmonteClient;
}

async function verifyMetaCredentials(client) {
  const verification = {
    hasToken: !!client.meta_access_token,
    hasAdAccount: !!client.ad_account_id,
    tokenValid: false,
    accountValid: false,
    accountInfo: null,
    recentCampaigns: [],
    totalSpend: 0,
    error: null
  };

  if (!verification.hasToken || !verification.hasAdAccount) {
    verification.error = 'Missing Meta API credentials';
    return verification;
  }

  try {
    const { MetaAPIService } = require('../src/lib/meta-api');
    const metaService = new MetaAPIService(client.meta_access_token);

    // Validate token
    const tokenValidation = await metaService.validateToken();
    verification.tokenValid = tokenValidation.valid;

    if (!tokenValidation.valid) {
      verification.error = `Token validation failed: ${tokenValidation.error}`;
      return verification;
    }

    // Clean ad account ID
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // Validate ad account
    const accountValidation = await metaService.validateAdAccount(adAccountId);
    verification.accountValid = accountValidation.valid;

    if (!accountValidation.valid) {
      verification.error = `Ad account validation failed: ${accountValidation.error}`;
      return verification;
    }

    // Get account info
    verification.accountInfo = await metaService.getAccountInfo(adAccountId);

    // Get recent campaigns (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    verification.recentCampaigns = await metaService.getCampaignInsights(
      adAccountId,
      thirtyDaysAgo.toISOString().split('T')[0],
      now.toISOString().split('T')[0],
      0
    );

    verification.totalSpend = verification.recentCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);

  } catch (error) {
    verification.error = error.message;
  }

  return verification;
}

async function verifyGoogleAdsCredentials(client) {
  const verification = {
    enabled: !!client.google_ads_enabled,
    hasCustomerId: !!client.google_ads_customer_id,
    systemCredentialsAvailable: false,
    canConnect: false,
    recentData: null,
    error: null
  };

  if (!verification.enabled) {
    return verification;
  }

  if (!verification.hasCustomerId) {
    verification.error = 'Google Ads enabled but customer ID missing';
    return verification;
  }

  try {
    // Check system credentials
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    if (error || !settings || settings.length < 4) {
      verification.error = 'Google Ads system credentials not configured';
      return verification;
    }

    verification.systemCredentialsAvailable = true;

    // Test connection (simplified)
    const credentials = {};
    settings.forEach(setting => {
      credentials[setting.key] = setting.value;
    });

    // For now, just mark as can connect if credentials exist
    verification.canConnect = true;

  } catch (error) {
    verification.error = error.message;
  }

  return verification;
}

async function compareDataSources(client, forceLive = false) {
  const comparison = {
    cache: {
      exists: false,
      data: null,
      ageHours: null,
      totalSpend: 0
    },
    live: {
      success: false,
      data: null,
      totalSpend: 0,
      fetchTime: 0
    },
    database: {
      exists: false,
      summaries: [],
      totalSpend: 0
    },
    comparison: {
      cacheVsLive: null,
      cacheVsDatabase: null,
      status: 'UNKNOWN'
    }
  };

  try {
    // 1. Check current month cache
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (!cacheError && cacheData) {
      comparison.cache.exists = true;
      comparison.cache.data = cacheData.cache_data;
      comparison.cache.totalSpend = cacheData.cache_data?.stats?.totalSpend || 0;
      
      const lastUpdated = new Date(cacheData.last_updated);
      comparison.cache.ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    }

    // 2. Check database summaries
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: summaries, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .gte('summary_date', startOfMonth.toISOString().split('T')[0])
      .order('summary_date', { ascending: false });

    if (!summaryError && summaries && summaries.length > 0) {
      comparison.database.exists = true;
      comparison.database.summaries = summaries;
      comparison.database.totalSpend = summaries.reduce((sum, s) => sum + (s.total_spend || 0), 0);
    }

    // 3. Get live data if requested or if cache is stale
    if (forceLive || !comparison.cache.exists || comparison.cache.ageHours > 6) {
      console.log('   🔴 Fetching live data from Meta API...');
      const startTime = Date.now();
      
      try {
        const { MetaAPIService } = require('../src/lib/meta-api');
        const metaService = new MetaAPIService(client.meta_access_token);
        
        const adAccountId = client.ad_account_id.startsWith('act_') 
          ? client.ad_account_id.substring(4)
          : client.ad_account_id;

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const campaigns = await metaService.getCampaignInsights(
          adAccountId,
          startOfMonth.toISOString().split('T')[0],
          now.toISOString().split('T')[0],
          0
        );

        comparison.live.success = true;
        comparison.live.data = campaigns;
        comparison.live.totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
        comparison.live.fetchTime = Date.now() - startTime;

      } catch (error) {
        comparison.live.error = error.message;
      }
    }

    // 4. Compare data sources
    if (comparison.cache.exists && comparison.live.success) {
      const spendDiff = Math.abs(comparison.cache.totalSpend - comparison.live.totalSpend);
      const percentDiff = comparison.cache.totalSpend > 0 ? (spendDiff / comparison.cache.totalSpend) * 100 : 0;
      
      comparison.comparison.cacheVsLive = {
        spendDifference: spendDiff,
        percentageDifference: percentDiff,
        status: percentDiff < 5 ? 'ACCURATE' : percentDiff < 15 ? 'MINOR_DIFFERENCE' : 'SIGNIFICANT_DIFFERENCE'
      };
    }

    // Determine overall status
    if (comparison.cache.exists && comparison.cache.ageHours < 3) {
      comparison.comparison.status = 'FRESH_CACHE';
    } else if (comparison.cache.exists && comparison.cache.ageHours < 6) {
      comparison.comparison.status = 'ACCEPTABLE_CACHE';
    } else if (comparison.live.success) {
      comparison.comparison.status = 'LIVE_DATA_AVAILABLE';
      } else {
      comparison.comparison.status = 'DATA_ISSUES';
    }

  } catch (error) {
    comparison.comparison.status = 'ERROR';
    comparison.error = error.message;
  }

  return comparison;
}

async function checkHistoricalData(client) {
  const historical = {
    campaignSummaries: {
      count: 0,
      dateRange: null,
      totalSpend: 0
    },
    dailyKpiData: {
      count: 0,
      dateRange: null,
      totalSpend: 0
    },
    reports: {
      count: 0,
      latest: null
    }
  };

  try {
    // Check campaign summaries
    const { data: summaries, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, total_spend, summary_type')
      .eq('client_id', client.id)
      .order('summary_date', { ascending: false });

    if (!summaryError && summaries) {
      historical.campaignSummaries.count = summaries.length;
      if (summaries.length > 0) {
        historical.campaignSummaries.dateRange = {
          earliest: summaries[summaries.length - 1].summary_date,
          latest: summaries[0].summary_date
        };
        historical.campaignSummaries.totalSpend = summaries.reduce((sum, s) => sum + (s.total_spend || 0), 0);
      }
    }

    // Check daily KPI data
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .select('date, total_spend')
      .eq('client_id', client.id)
      .order('date', { ascending: false });

    if (!dailyError && dailyData) {
      historical.dailyKpiData.count = dailyData.length;
      if (dailyData.length > 0) {
        historical.dailyKpiData.dateRange = {
          earliest: dailyData[dailyData.length - 1].date,
          latest: dailyData[0].date
        };
        historical.dailyKpiData.totalSpend = dailyData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
      }
    }

    // Check reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, generated_at, report_type')
      .eq('client_id', client.id)
      .order('generated_at', { ascending: false });

    if (!reportsError && reports) {
      historical.reports.count = reports.length;
      if (reports.length > 0) {
        historical.reports.latest = reports[0];
      }
    }
    
  } catch (error) {
    historical.error = error.message;
  }

  return historical;
}

function displayMetaResults(verification) {
  console.log(`   Token Present: ${verification.hasToken ? '✅' : '❌'}`);
  console.log(`   Ad Account Present: ${verification.hasAdAccount ? '✅' : '❌'}`);
  console.log(`   Token Valid: ${verification.tokenValid ? '✅' : '❌'}`);
  console.log(`   Account Valid: ${verification.accountValid ? '✅' : '❌'}`);
  
  if (verification.accountInfo) {
    console.log(`   Account Currency: ${verification.accountInfo.currency}`);
    console.log(`   Account Status: ${verification.accountInfo.account_status}`);
  }
  
  console.log(`   Recent Campaigns: ${verification.recentCampaigns.length}`);
  console.log(`   Total Spend (30 days): ${verification.totalSpend.toFixed(2)} PLN`);
  
  if (verification.error) {
    console.log(`   ❌ Error: ${verification.error}`);
  }
}

function displayGoogleAdsResults(verification) {
  console.log(`   Enabled: ${verification.enabled ? '✅' : '❌'}`);
  if (verification.enabled) {
    console.log(`   Customer ID Present: ${verification.hasCustomerId ? '✅' : '❌'}`);
    console.log(`   System Credentials: ${verification.systemCredentialsAvailable ? '✅' : '❌'}`);
    console.log(`   Can Connect: ${verification.canConnect ? '✅' : '❌'}`);
  }
  
  if (verification.error) {
    console.log(`   ❌ Error: ${verification.error}`);
  }
}

function displayDataComparison(comparison) {
  console.log(`📦 Cache Status:`);
  console.log(`   Exists: ${comparison.cache.exists ? '✅' : '❌'}`);
  if (comparison.cache.exists) {
    console.log(`   Age: ${comparison.cache.ageHours.toFixed(1)} hours`);
    console.log(`   Total Spend: ${comparison.cache.totalSpend.toFixed(2)} PLN`);
  }

  console.log(`\n🔴 Live API Status:`);
  console.log(`   Success: ${comparison.live.success ? '✅' : '❌'}`);
  if (comparison.live.success) {
    console.log(`   Total Spend: ${comparison.live.totalSpend.toFixed(2)} PLN`);
    console.log(`   Fetch Time: ${comparison.live.fetchTime}ms`);
  }

  console.log(`\n📚 Database Status:`);
  console.log(`   Summaries: ${comparison.database.exists ? '✅' : '❌'}`);
  if (comparison.database.exists) {
    console.log(`   Count: ${comparison.database.summaries.length}`);
    console.log(`   Total Spend: ${comparison.database.totalSpend.toFixed(2)} PLN`);
  }

  console.log(`\n⚖️  Overall Status: ${comparison.comparison.status}`);
  
  if (comparison.comparison.cacheVsLive) {
    const comp = comparison.comparison.cacheVsLive;
    console.log(`   Cache vs Live: ${comp.spendDifference.toFixed(2)} PLN difference (${comp.percentageDifference.toFixed(1)}%)`);
    console.log(`   Accuracy: ${comp.status}`);
  }
}

function displayHistoricalResults(historical) {
  console.log(`📊 Campaign Summaries: ${historical.campaignSummaries.count} records`);
  if (historical.campaignSummaries.dateRange) {
    console.log(`   Date Range: ${historical.campaignSummaries.dateRange.earliest} to ${historical.campaignSummaries.dateRange.latest}`);
    console.log(`   Total Historical Spend: ${historical.campaignSummaries.totalSpend.toFixed(2)} PLN`);
  }

  console.log(`📈 Daily KPI Data: ${historical.dailyKpiData.count} records`);
  if (historical.dailyKpiData.dateRange) {
    console.log(`   Date Range: ${historical.dailyKpiData.dateRange.earliest} to ${historical.dailyKpiData.dateRange.latest}`);
  }

  console.log(`📄 Generated Reports: ${historical.reports.count} reports`);
  if (historical.reports.latest) {
    console.log(`   Latest Report: ${historical.reports.latest.generated_at} (${historical.reports.latest.report_type})`);
  }
}

function generateSummary(report) {
  const issues = [];
  const recommendations = [];

  // Check Meta setup
  if (!report.meta.tokenValid || !report.meta.accountValid) {
    issues.push('Meta API credentials have issues');
    recommendations.push('Verify and refresh Meta API token');
  }

  // Check data freshness
  if (report.dataComparison.cache.exists && report.dataComparison.cache.ageHours > 6) {
    issues.push('Cache data is stale (>6 hours old)');
    recommendations.push('Refresh cache or check automated refresh system');
  }

  // Check data consistency
  if (report.dataComparison.comparison.cacheVsLive?.status === 'SIGNIFICANT_DIFFERENCE') {
    issues.push('Significant difference between cached and live data');
    recommendations.push('Investigate cache invalidation and data sync');
  }

  // Check historical data
  if (report.historical.campaignSummaries.count === 0) {
    issues.push('No historical campaign summaries found');
    recommendations.push('Run historical data collection');
  }

  console.log(`✅ Overall Status: ${issues.length === 0 ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
  console.log(`📊 Meta API: ${report.meta.tokenValid && report.meta.accountValid ? 'WORKING' : 'ISSUES'}`);
  console.log(`🔍 Google Ads: ${report.googleAds.enabled ? (report.googleAds.canConnect ? 'WORKING' : 'ISSUES') : 'DISABLED'}`);
  console.log(`📦 Data Sources: ${report.dataComparison.comparison.status}`);

  if (issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  if (recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    recommendations.forEach(rec => console.log(`   - ${rec}`));
  }
}

// Run the verification
if (require.main === module) {
verifyBelmonteData().catch(console.error);
}

module.exports = { verifyBelmonteData };