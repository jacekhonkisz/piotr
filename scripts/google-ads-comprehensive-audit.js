#!/usr/bin/env node

/**
 * GOOGLE ADS CLIENTS COMPREHENSIVE AUDIT SCRIPT
 * 
 * This script performs a complete audit of all Google Ads clients by:
 * 1. Fetching all Google Ads clients from the database
 * 2. Testing each client's API credentials and data
 * 3. Comparing live API data with stored database values
 * 4. Generating a comprehensive audit report
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
    totalClients: 0,
    validClients: 0,
    invalidClients: 0,
    errorClients: 0,
    startTime: new Date().toISOString(),
    endTime: null
  },
  clients: [],
  errors: [],
  recommendations: []
};

/**
 * Test Google Ads API credentials and fetch account data
 */
async function testGoogleAdsCredentials(client) {
  const results = {
    clientId: client.id,
    clientName: client.name,
    customerId: client.google_ads_customer_id,
    tokenStatus: 'unknown',
    accountData: null,
    campaigns: [],
    errors: [],
    warnings: [],
    apiCalls: {
      tokenValidation: null,
      accountInfo: null,
      campaigns: null,
      insights: null
    }
  };

  try {
    console.log(`\n🔍 Testing Google Ads credentials for: ${client.name}`);
    console.log(`   📊 Customer ID: ${client.google_ads_customer_id}`);
    console.log(`   🔑 Google Ads Enabled: ${client.google_ads_enabled || false}`);

    // 1. Check if Google Ads is enabled
    if (!client.google_ads_enabled) {
      results.errors.push('Google Ads not enabled for this client');
      results.tokenStatus = 'disabled';
      return results;
    }

    // 2. Check if customer ID exists
    if (!client.google_ads_customer_id) {
      results.errors.push('No Google Ads Customer ID configured');
      results.tokenStatus = 'invalid';
      return results;
    }

    // 3. Get Google Ads system settings
    console.log(`   🔐 Fetching Google Ads system settings...`);
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

    if (settingsError) {
      results.errors.push(`Failed to get Google Ads system settings: ${settingsError.message}`);
      return results;
    }

    const settings = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    // 4. Check if required settings are configured
    const requiredSettings = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token'];
    const missingSettings = requiredSettings.filter(key => !settings[key]);
    
    if (missingSettings.length > 0) {
      results.errors.push(`Missing Google Ads system settings: ${missingSettings.join(', ')}`);
      results.tokenStatus = 'invalid';
      return results;
    }

    // 5. Determine refresh token (manager token takes priority)
    let refreshToken = null;
    if (settings.google_ads_manager_refresh_token) {
      refreshToken = settings.google_ads_manager_refresh_token;
    } else if (client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
    }

    if (!refreshToken) {
      results.errors.push('No Google Ads refresh token available');
      results.tokenStatus = 'invalid';
      return results;
    }

    console.log(`   ✅ Google Ads credentials configured`);

    // 6. Test API access by fetching account information
    console.log(`   📋 Testing API access...`);
    const accountInfo = await getGoogleAdsAccountInfo(settings, refreshToken, client.google_ads_customer_id);
    results.accountData = accountInfo;
    results.apiCalls.accountInfo = accountInfo;

    if (accountInfo.error) {
      results.errors.push(`Account info failed: ${accountInfo.error}`);
      results.tokenStatus = 'invalid';
      return results;
    } else {
      console.log(`   ✅ Account: ${accountInfo.descriptiveName} (${accountInfo.currencyCode})`);
      results.tokenStatus = 'valid';
    }

    // 7. Get campaigns
    console.log(`   🎯 Fetching campaigns...`);
    const campaigns = await getGoogleAdsCampaigns(settings, refreshToken, client.google_ads_customer_id);
    results.campaigns = campaigns;
    results.apiCalls.campaigns = campaigns;

    if (campaigns.error) {
      results.errors.push(`Campaigns fetch failed: ${campaigns.error}`);
    } else {
      console.log(`   ✅ Found ${campaigns.length} campaigns`);
    }

    // 8. Get recent insights (last 30 days)
    console.log(`   📈 Fetching recent insights...`);
    const insights = await getGoogleAdsInsights(settings, refreshToken, client.google_ads_customer_id);
    results.apiCalls.insights = insights;

    if (insights.error) {
      results.errors.push(`Insights fetch failed: ${insights.error}`);
    } else {
      console.log(`   ✅ Insights data retrieved`);
    }

    // 9. Compare with database data
    console.log(`   🔄 Comparing with database data...`);
    const dbComparison = await compareWithDatabase(client.id, insights);
    results.dbComparison = dbComparison;

  } catch (error) {
    console.log(`   ❌ Error testing ${client.name}: ${error.message}`);
    results.errors.push(`Unexpected error: ${error.message}`);
  }

  return results;
}

/**
 * Get Google Ads account information using the API
 */
async function getGoogleAdsAccountInfo(settings, refreshToken, customerId) {
  try {
    // Use the existing Google Ads API service
    const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
    
    const credentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: customerId,
      managerCustomerId: settings.google_ads_manager_customer_id
    };

    const googleAdsService = new GoogleAdsAPIService(credentials);
    
    // Get account information
    const accountInfo = await googleAdsService.getAccountInfo();
    
    return {
      customerId: accountInfo.customerId,
      descriptiveName: accountInfo.descriptiveName,
      currencyCode: accountInfo.currencyCode,
      timeZone: accountInfo.timeZone,
      testAccount: accountInfo.testAccount
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get Google Ads campaigns
 */
async function getGoogleAdsCampaigns(settings, refreshToken, customerId) {
  try {
    const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
    
    const credentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: customerId,
      managerCustomerId: settings.google_ads_manager_customer_id
    };

    const googleAdsService = new GoogleAdsAPIService(credentials);
    
    // Get campaigns
    const campaigns = await googleAdsService.getCampaigns();
    
    return campaigns || [];
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get Google Ads insights (last 30 days)
 */
async function getGoogleAdsInsights(settings, refreshToken, customerId) {
  try {
    const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
    
    const credentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: customerId,
      managerCustomerId: settings.google_ads_manager_customer_id
    };

    const googleAdsService = new GoogleAdsAPIService(credentials);
    
    // Get insights for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const insights = await googleAdsService.getCampaignInsights(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    return insights || [];
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Compare API data with database data
 */
async function compareWithDatabase(clientId, insights) {
  try {
    // Get recent database data for this client
    const { data: dbData, error } = await supabase
      .from('google_ads_campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date_start', { ascending: false })
      .limit(10);

    if (error) {
      return { error: `Database query failed: ${error.message}` };
    }

    const comparison = {
      dbRecords: dbData?.length || 0,
      apiRecords: insights?.length || 0,
      discrepancies: [],
      matches: 0,
      totalDbSpend: 0,
      totalApiSpend: 0,
      totalDbImpressions: 0,
      totalApiImpressions: 0,
      totalDbClicks: 0,
      totalApiClicks: 0
    };

    // Calculate totals from database
    if (dbData) {
      dbData.forEach(record => {
        comparison.totalDbSpend += parseFloat(record.spend || 0);
        comparison.totalDbImpressions += parseInt(record.impressions || 0);
        comparison.totalDbClicks += parseInt(record.clicks || 0);
      });
    }

    // Calculate totals from API
    if (insights) {
      insights.forEach(record => {
        comparison.totalApiSpend += parseFloat(record.spend || 0);
        comparison.totalApiImpressions += parseInt(record.impressions || 0);
        comparison.totalApiClicks += parseInt(record.clicks || 0);
      });
    }

    // Check for significant discrepancies (more than 10% difference)
    const spendDiff = Math.abs(comparison.totalApiSpend - comparison.totalDbSpend);
    const spendThreshold = Math.max(comparison.totalApiSpend, comparison.totalDbSpend) * 0.1;

    if (spendDiff > spendThreshold) {
      comparison.discrepancies.push({
        metric: 'spend',
        apiValue: comparison.totalApiSpend,
        dbValue: comparison.totalDbSpend,
        difference: spendDiff,
        percentage: (spendDiff / Math.max(comparison.totalApiSpend, comparison.totalDbSpend)) * 100
      });
    }

    const impressionsDiff = Math.abs(comparison.totalApiImpressions - comparison.totalDbImpressions);
    const impressionsThreshold = Math.max(comparison.totalApiImpressions, comparison.totalDbImpressions) * 0.1;

    if (impressionsDiff > impressionsThreshold) {
      comparison.discrepancies.push({
        metric: 'impressions',
        apiValue: comparison.totalApiImpressions,
        dbValue: comparison.totalDbImpressions,
        difference: impressionsDiff,
        percentage: (impressionsDiff / Math.max(comparison.totalApiImpressions, comparison.totalDbImpressions)) * 100
      });
    }

    return comparison;
  } catch (error) {
    return { error: error.message };
  }
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
      tokenHealth: {},
      dataConsistency: {},
      performance: {},
      recommendations: []
    }
  };

  // Analyze token health
  const tokenStatuses = auditResults.clients.map(c => c.tokenStatus);
  report.analysis.tokenHealth = {
    valid: tokenStatuses.filter(s => s === 'valid').length,
    invalid: tokenStatuses.filter(s => s === 'invalid').length,
    disabled: tokenStatuses.filter(s => s === 'disabled').length,
    unknown: tokenStatuses.filter(s => s === 'unknown').length
  };

  // Analyze data consistency
  const clientsWithDiscrepancies = auditResults.clients.filter(c => 
    c.dbComparison && c.dbComparison.discrepancies && c.dbComparison.discrepancies.length > 0
  );
  
  report.analysis.dataConsistency = {
    clientsWithDiscrepancies: clientsWithDiscrepancies.length,
    totalDiscrepancies: clientsWithDiscrepancies.reduce((sum, c) => 
      sum + (c.dbComparison?.discrepancies?.length || 0), 0
    ),
    averageDiscrepancy: clientsWithDiscrepancies.length > 0 ? 
      clientsWithDiscrepancies.reduce((sum, c) => 
        sum + (c.dbComparison?.discrepancies?.length || 0), 0
      ) / clientsWithDiscrepancies.length : 0
  };

  // Generate recommendations
  if (report.analysis.tokenHealth.invalid > 0) {
    report.analysis.recommendations.push({
      priority: 'high',
      category: 'token_health',
      issue: `${report.analysis.tokenHealth.invalid} clients have invalid Google Ads tokens`,
      action: 'Refresh or regenerate invalid tokens'
    });
  }

  if (report.analysis.tokenHealth.disabled > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'configuration',
      issue: `${report.analysis.tokenHealth.disabled} clients have Google Ads disabled`,
      action: 'Enable Google Ads for clients that need it'
    });
  }

  if (report.analysis.dataConsistency.clientsWithDiscrepancies > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'data_consistency',
      issue: `${report.analysis.dataConsistency.clientsWithDiscrepancies} clients have data discrepancies`,
      action: 'Investigate and fix data synchronization issues'
    });
  }

  return report;
}

/**
 * Main audit function
 */
async function runGoogleAdsAudit() {
  console.log('🚀 STARTING GOOGLE ADS CLIENTS COMPREHENSIVE AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Fetch all Google Ads clients from database
    console.log('\n📋 Fetching Google Ads clients from database...');
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .not('google_ads_customer_id', 'is', null)
      .eq('google_ads_enabled', true);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No Google Ads clients found in database');
      return;
    }

    auditResults.summary.totalClients = clients.length;
    console.log(`✅ Found ${clients.length} Google Ads clients`);

    // 2. Test each client
    console.log('\n🔍 Testing each client...');
    for (const client of clients) {
      const result = await testGoogleAdsCredentials(client);
      auditResults.clients.push(result);

      if (result.errors.length === 0) {
        auditResults.summary.validClients++;
        console.log(`✅ ${client.name}: PASSED`);
      } else {
        auditResults.summary.invalidClients++;
        console.log(`❌ ${client.name}: FAILED - ${result.errors.join(', ')}`);
      }
    }

    // 3. Generate and save report
    console.log('\n📊 Generating audit report...');
    const report = generateAuditReport();
    
    // Save report to file
    const reportPath = `GOOGLE_ADS_CLIENTS_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Audit report saved to: ${reportPath}`);
    
    // 4. Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Clients: ${report.summary.totalClients}`);
    console.log(`Valid Clients: ${report.summary.validClients}`);
    console.log(`Invalid Clients: ${report.summary.invalidClients}`);
    console.log(`Clients with Data Discrepancies: ${report.analysis.dataConsistency.clientsWithDiscrepancies}`);
    console.log(`Total Discrepancies: ${report.analysis.dataConsistency.totalDiscrepancies}`);
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
    auditResults.errors.push(error.message);
  }
}

// Run the audit
runGoogleAdsAudit().catch(console.error);

module.exports = { runGoogleAdsAudit, testGoogleAdsCredentials };
