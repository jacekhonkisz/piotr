#!/usr/bin/env node

/**
 * META CLIENTS COMPREHENSIVE AUDIT SCRIPT (CommonJS Version)
 * 
 * This script performs a complete audit of all Meta clients by:
 * 1. Fetching all Meta clients from the database
 * 2. Testing each client's API credentials and data
 * 3. Comparing live API data with stored database values
 * 4. Generating a comprehensive audit report
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Meta API base URL
const META_API_BASE = 'https://graph.facebook.com/v18.0';

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
 * Test Meta API credentials and fetch account data
 */
async function testMetaCredentials(client) {
  const results = {
    clientId: client.id,
    clientName: client.name,
    adAccountId: client.ad_account_id,
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
    console.log(`\n🔍 Testing Meta credentials for: ${client.name}`);
    console.log(`   📊 Ad Account ID: ${client.ad_account_id}`);
    console.log(`   🔑 Token Status: ${client.token_health_status || 'unknown'}`);

    // 1. Test token validation
    console.log(`   🔐 Validating token...`);
    const tokenValidation = await validateMetaToken(client.meta_access_token);
    results.tokenStatus = tokenValidation.valid ? 'valid' : 'invalid';
    results.apiCalls.tokenValidation = tokenValidation;

    if (!tokenValidation.valid) {
      results.errors.push(`Token validation failed: ${tokenValidation.error}`);
      return results;
    }

    console.log(`   ✅ Token is valid`);

    // 2. Get account information
    console.log(`   📋 Fetching account information...`);
    const accountInfo = await getAccountInfo(client.meta_access_token, client.ad_account_id);
    results.accountData = accountInfo;
    results.apiCalls.accountInfo = accountInfo;

    if (accountInfo.error) {
      results.errors.push(`Account info failed: ${accountInfo.error}`);
    } else {
      console.log(`   ✅ Account: ${accountInfo.name} (${accountInfo.currency})`);
    }

    // 3. Get campaigns
    console.log(`   🎯 Fetching campaigns...`);
    const campaigns = await getCampaigns(client.meta_access_token, client.ad_account_id);
    results.campaigns = campaigns;
    results.apiCalls.campaigns = campaigns;

    if (campaigns.error) {
      results.errors.push(`Campaigns fetch failed: ${campaigns.error}`);
    } else {
      console.log(`   ✅ Found ${campaigns.length} campaigns`);
    }

    // 4. Get recent insights (last 30 days)
    console.log(`   📈 Fetching recent insights...`);
    const insights = await getRecentInsights(client.meta_access_token, client.ad_account_id);
    results.apiCalls.insights = insights;

    if (insights.error) {
      results.errors.push(`Insights fetch failed: ${insights.error}`);
    } else {
      console.log(`   ✅ Insights data retrieved`);
    }

    // 5. Compare with database data
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
 * Validate Meta access token
 */
async function validateMetaToken(token) {
  try {
    const response = await fetch(`${META_API_BASE}/me?access_token=${token}`);
    const data = await response.json();

    if (data.error) {
      return {
        valid: false,
        error: data.error.message,
        code: data.error.code
      };
    }

    return {
      valid: true,
      userId: data.id,
      name: data.name,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Get account information
 */
async function getAccountInfo(token, adAccountId) {
  try {
    const processedAdAccountId = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4) 
      : adAccountId;

    const response = await fetch(
      `${META_API_BASE}/act_${processedAdAccountId}?access_token=${token}&fields=id,name,account_id,currency,timezone_name,amount_spent,balance`
    );
    
    const data = await response.json();

    if (data.error) {
      return { error: data.error.message };
    }

    return {
      id: data.id,
      name: data.name,
      account_id: data.account_id,
      currency: data.currency,
      timezone: data.timezone_name,
      amount_spent: data.amount_spent,
      balance: data.balance
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get campaigns for the account
 */
async function getCampaigns(token, adAccountId) {
  try {
    const processedAdAccountId = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4) 
      : adAccountId;

    const response = await fetch(
      `${META_API_BASE}/act_${processedAdAccountId}/campaigns?access_token=${token}&fields=id,name,status,objective,created_time,updated_time,start_time,stop_time&limit=100`
    );
    
    const data = await response.json();

    if (data.error) {
      return { error: data.error.message };
    }

    return data.data || [];
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get recent insights (last 30 days)
 */
async function getRecentInsights(token, adAccountId) {
  try {
    const processedAdAccountId = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4) 
      : adAccountId;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const response = await fetch(
      `${META_API_BASE}/act_${processedAdAccountId}/insights?access_token=${token}&fields=impressions,clicks,spend,conversions,ctr,cpc,cpp,frequency,reach,cpm&time_range={'since':'${startDate.toISOString().split('T')[0]}','until':'${endDate.toISOString().split('T')[0]}'}&level=account&limit=100`
    );
    
    const data = await response.json();

    if (data.error) {
      return { error: data.error.message };
    }

    return data.data || [];
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
      .from('campaign_summaries')
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
      issue: `${report.analysis.tokenHealth.invalid} clients have invalid tokens`,
      action: 'Refresh or regenerate invalid tokens'
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
async function runMetaAudit() {
  console.log('🚀 STARTING META CLIENTS COMPREHENSIVE AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Fetch all Meta clients from database
    console.log('\n📋 Fetching Meta clients from database...');
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No Meta clients found in database');
      return;
    }

    auditResults.summary.totalClients = clients.length;
    console.log(`✅ Found ${clients.length} Meta clients`);

    // 2. Test each client
    console.log('\n🔍 Testing each client...');
    for (const client of clients) {
      const result = await testMetaCredentials(client);
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
    const reportPath = `META_CLIENTS_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.json`;
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
runMetaAudit().catch(console.error);

module.exports = { runMetaAudit, testMetaCredentials };
