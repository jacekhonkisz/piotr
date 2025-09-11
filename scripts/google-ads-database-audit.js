#!/usr/bin/env node

/**
 * GOOGLE ADS CLIENTS DATABASE AUDIT SCRIPT
 * 
 * This script performs a comprehensive audit of all Google Ads clients by:
 * 1. Fetching all Google Ads clients from the database
 * 2. Analyzing their configuration and credentials
 * 3. Checking database data consistency
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
 * Analyze Google Ads client configuration and data
 */
async function analyzeGoogleAdsClient(client) {
  const results = {
    clientId: client.id,
    clientName: client.name,
    customerId: client.google_ads_customer_id,
    configurationStatus: 'unknown',
    dataStatus: 'unknown',
    errors: [],
    warnings: [],
    analysis: {
      credentials: {},
      data: {},
      settings: {}
    }
  };

  try {
    console.log(`\n🔍 Analyzing Google Ads client: ${client.name}`);
    console.log(`   📊 Customer ID: ${client.google_ads_customer_id}`);
    console.log(`   🔑 Google Ads Enabled: ${client.google_ads_enabled || false}`);

    // 1. Check basic configuration
    if (!client.google_ads_enabled) {
      results.errors.push('Google Ads not enabled for this client');
      results.configurationStatus = 'disabled';
      return results;
    }

    if (!client.google_ads_customer_id) {
      results.errors.push('No Google Ads Customer ID configured');
      results.configurationStatus = 'invalid';
      return results;
    }

    // 2. Validate Customer ID format
    const customerIdPattern = /^\d{3}-\d{3}-\d{4}$/;
    if (!customerIdPattern.test(client.google_ads_customer_id)) {
      results.warnings.push('Customer ID format may be incorrect (expected: XXX-XXX-XXXX)');
    }

    // 3. Check credentials configuration
    results.analysis.credentials = {
      hasCustomerId: !!client.google_ads_customer_id,
      hasRefreshToken: !!client.google_ads_refresh_token,
      hasAccessToken: !!client.google_ads_access_token,
      hasTokenExpiry: !!client.google_ads_token_expires_at,
      tokenExpired: client.google_ads_token_expires_at ? 
        new Date(client.google_ads_token_expires_at) < new Date() : null
    };

    // 4. Get Google Ads system settings
    console.log(`   🔐 Checking Google Ads system settings...`);
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

    results.analysis.settings = {
      hasClientId: !!settings.google_ads_client_id,
      hasClientSecret: !!settings.google_ads_client_secret,
      hasDeveloperToken: !!settings.google_ads_developer_token,
      hasManagerRefreshToken: !!settings.google_ads_manager_refresh_token,
      hasManagerCustomerId: !!settings.google_ads_manager_customer_id
    };

    // 5. Check if required settings are configured
    const requiredSettings = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token'];
    const missingSettings = requiredSettings.filter(key => !settings[key]);
    
    if (missingSettings.length > 0) {
      results.errors.push(`Missing Google Ads system settings: ${missingSettings.join(', ')}`);
      results.configurationStatus = 'invalid';
    } else {
      results.configurationStatus = 'valid';
    }

    // 6. Check for refresh token
    let hasRefreshToken = false;
    if (settings.google_ads_manager_refresh_token) {
      hasRefreshToken = true;
      results.analysis.credentials.refreshTokenSource = 'manager';
    } else if (client.google_ads_refresh_token) {
      hasRefreshToken = true;
      results.analysis.credentials.refreshTokenSource = 'client';
    }

    if (!hasRefreshToken) {
      results.errors.push('No Google Ads refresh token available');
      results.configurationStatus = 'invalid';
    }

    console.log(`   ✅ Configuration analysis complete`);

    // 7. Analyze database data
    console.log(`   📊 Analyzing database data...`);
    const dataAnalysis = await analyzeClientData(client.id);
    results.analysis.data = dataAnalysis;
    results.dataStatus = dataAnalysis.hasData ? 'available' : 'empty';

    if (dataAnalysis.hasData) {
      console.log(`   ✅ Found ${dataAnalysis.campaignCount} campaigns, ${dataAnalysis.summaryCount} summaries`);
    } else {
      console.log(`   ⚠️ No Google Ads data found in database`);
    }

    // 8. Overall status determination
    if (results.errors.length === 0) {
      results.configurationStatus = 'valid';
      if (dataAnalysis.hasData) {
        results.dataStatus = 'available';
      } else {
        results.dataStatus = 'empty';
        results.warnings.push('No Google Ads data found in database');
      }
    } else {
      results.configurationStatus = 'invalid';
    }

  } catch (error) {
    console.log(`   ❌ Error analyzing ${client.name}: ${error.message}`);
    results.errors.push(`Unexpected error: ${error.message}`);
  }

  return results;
}

/**
 * Analyze client data in database
 */
async function analyzeClientData(clientId) {
  try {
    // Check for campaign data
    const { data: campaigns, error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .select('id, campaign_id, campaign_name, status, created_at')
      .eq('client_id', clientId)
      .limit(10);

    // Check for summary data
    const { data: summaries, error: summariesError } = await supabase
      .from('google_ads_campaign_summaries')
      .select('id, campaign_id, date_start, spend, impressions, clicks')
      .eq('client_id', clientId)
      .gte('date_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(10);

    // Check for daily KPI data
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .select('id, date, spend, impressions, clicks')
      .eq('client_id', clientId)
      .eq('platform', 'google_ads')
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(10);

    const analysis = {
      hasData: false,
      campaignCount: 0,
      summaryCount: 0,
      dailyDataCount: 0,
      errors: [],
      dataSources: []
    };

    if (campaignsError) {
      analysis.errors.push(`Campaigns query failed: ${campaignsError.message}`);
    } else {
      analysis.campaignCount = campaigns?.length || 0;
      if (campaigns && campaigns.length > 0) {
        analysis.dataSources.push('campaigns');
        analysis.hasData = true;
      }
    }

    if (summariesError) {
      analysis.errors.push(`Summaries query failed: ${summariesError.message}`);
    } else {
      analysis.summaryCount = summaries?.length || 0;
      if (summaries && summaries.length > 0) {
        analysis.dataSources.push('summaries');
        analysis.hasData = true;
      }
    }

    if (dailyError) {
      analysis.errors.push(`Daily data query failed: ${dailyError.message}`);
    } else {
      analysis.dailyDataCount = dailyData?.length || 0;
      if (dailyData && dailyData.length > 0) {
        analysis.dataSources.push('daily_kpi');
        analysis.hasData = true;
      }
    }

    return analysis;
  } catch (error) {
    return {
      hasData: false,
      campaignCount: 0,
      summaryCount: 0,
      dailyDataCount: 0,
      errors: [error.message],
      dataSources: []
    };
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
      configuration: {},
      dataAvailability: {},
      recommendations: []
    }
  };

  // Analyze configuration status
  const configStatuses = auditResults.clients.map(c => c.configurationStatus);
  report.analysis.configuration = {
    valid: configStatuses.filter(s => s === 'valid').length,
    invalid: configStatuses.filter(s => s === 'invalid').length,
    disabled: configStatuses.filter(s => s === 'disabled').length,
    unknown: configStatuses.filter(s => s === 'unknown').length
  };

  // Analyze data availability
  const dataStatuses = auditResults.clients.map(c => c.dataStatus);
  report.analysis.dataAvailability = {
    available: dataStatuses.filter(s => s === 'available').length,
    empty: dataStatuses.filter(s => s === 'empty').length,
    unknown: dataStatuses.filter(s => s === 'unknown').length
  };

  // Generate recommendations
  if (report.analysis.configuration.invalid > 0) {
    report.analysis.recommendations.push({
      priority: 'high',
      category: 'configuration',
      issue: `${report.analysis.configuration.invalid} clients have invalid Google Ads configuration`,
      action: 'Fix missing credentials or system settings'
    });
  }

  if (report.analysis.configuration.disabled > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'configuration',
      issue: `${report.analysis.configuration.disabled} clients have Google Ads disabled`,
      action: 'Enable Google Ads for clients that need it'
    });
  }

  if (report.analysis.dataAvailability.empty > 0) {
    report.analysis.recommendations.push({
      priority: 'medium',
      category: 'data',
      issue: `${report.analysis.dataAvailability.empty} clients have no Google Ads data`,
      action: 'Run data collection for clients with missing data'
    });
  }

  return report;
}

/**
 * Main audit function
 */
async function runGoogleAdsAudit() {
  console.log('🚀 STARTING GOOGLE ADS CLIENTS DATABASE AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Fetch all Google Ads clients from database
    console.log('\n📋 Fetching Google Ads clients from database...');
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .not('google_ads_customer_id', 'is', null);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No Google Ads clients found in database');
      return;
    }

    auditResults.summary.totalClients = clients.length;
    console.log(`✅ Found ${clients.length} Google Ads clients`);

    // 2. Analyze each client
    console.log('\n🔍 Analyzing each client...');
    for (const client of clients) {
      const result = await analyzeGoogleAdsClient(client);
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
    const reportPath = `GOOGLE_ADS_DATABASE_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Audit report saved to: ${reportPath}`);
    
    // 4. Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Clients: ${report.summary.totalClients}`);
    console.log(`Valid Clients: ${report.summary.validClients}`);
    console.log(`Invalid Clients: ${report.summary.invalidClients}`);
    console.log(`Clients with Data: ${report.analysis.dataAvailability.available}`);
    console.log(`Clients without Data: ${report.analysis.dataAvailability.empty}`);
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

module.exports = { runGoogleAdsAudit, analyzeGoogleAdsClient };
