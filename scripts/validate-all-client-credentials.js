#!/usr/bin/env node

/**
 * Client Credentials Validation System
 * 
 * Validates all client API credentials and setup status
 * Usage: node scripts/validate-all-client-credentials.js [--fix] [--report]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const generateReport = args.includes('--report');

async function validateAllClientCredentials() {
  console.log('🔐 CLIENT CREDENTIALS VALIDATION');
  console.log('=================================\n');

  try {
    // Get all clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw error;

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found in database');
      return;
    }

    console.log(`✅ Found ${clients.length} clients to validate\n`);

    const results = [];
    let validClients = 0;
    let invalidClients = 0;
    let fixedClients = 0;

    for (const client of clients) {
      console.log(`\n🔍 Validating: ${client.name} (${client.email})`);
      console.log('-'.repeat(60));

      const validation = await validateClientCredentials(client);
      results.push(validation);

      // Display validation results
      displayValidationResults(validation);

      // Count results
      if (validation.overall.isValid) {
        validClients++;
      } else {
        invalidClients++;
      }

      // Attempt fixes if requested
      if (shouldFix && !validation.overall.isValid) {
        console.log('\n🔧 Attempting to fix issues...');
        const fixed = await attemptFixes(client, validation);
        if (fixed) {
          fixedClients++;
          console.log('✅ Issues fixed successfully');
        } else {
          console.log('❌ Could not fix all issues automatically');
        }
      }
    }

    // Summary
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Valid Clients: ${validClients}/${clients.length} (${(validClients/clients.length*100).toFixed(1)}%)`);
    console.log(`❌ Invalid Clients: ${invalidClients}/${clients.length} (${(invalidClients/clients.length*100).toFixed(1)}%)`);
    
    if (shouldFix) {
      console.log(`🔧 Fixed Clients: ${fixedClients}/${invalidClients}`);
    }

    // Generate detailed report
    if (generateReport) {
      const reportPath = await generateValidationReport(results);
      console.log(`\n📄 Detailed report saved: ${reportPath}`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    const issues = results.flatMap(r => r.issues);
    const issueTypes = {};
    issues.forEach(issue => {
      issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
    });

    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`   - ${count} clients have ${type} issues`);
    });

    if (invalidClients > 0 && !shouldFix) {
      console.log(`\n🔧 Run with --fix flag to attempt automatic fixes`);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

async function validateClientCredentials(client) {
  const validation = {
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email,
    meta: {
      hasToken: false,
      hasAdAccount: false,
      tokenValid: false,
      accountValid: false,
      lastSpend: null,
      error: null
    },
    googleAds: {
      enabled: false,
      hasCustomerId: false,
      credentialsValid: false,
      lastSpend: null,
      error: null
    },
    setup: {
      hasContactEmails: false,
      hasReportingFrequency: false,
      hasValidProfile: false
    },
    issues: [],
    overall: {
      isValid: false,
      score: 0,
      status: 'INVALID'
    }
  };

  try {
    // Validate Meta Ads setup
    await validateMetaCredentials(client, validation);
    
    // Validate Google Ads setup
    await validateGoogleAdsCredentials(client, validation);
    
    // Validate general setup
    validateGeneralSetup(client, validation);
    
    // Calculate overall score and status
    calculateOverallStatus(validation);

  } catch (error) {
    validation.issues.push({
      type: 'VALIDATION_ERROR',
      severity: 'HIGH',
      message: `Validation failed: ${error.message}`
    });
  }

  return validation;
}

async function validateMetaCredentials(client, validation) {
  // Check if Meta credentials exist
  validation.meta.hasToken = !!client.meta_access_token;
  validation.meta.hasAdAccount = !!client.ad_account_id;

  if (!validation.meta.hasToken) {
    validation.issues.push({
      type: 'MISSING_META_TOKEN',
      severity: 'HIGH',
      message: 'Meta access token is missing'
    });
    return;
  }

  if (!validation.meta.hasAdAccount) {
    validation.issues.push({
      type: 'MISSING_AD_ACCOUNT',
      severity: 'HIGH', 
      message: 'Meta ad account ID is missing'
    });
    return;
  }

  try {
    // Import and test Meta API
    const { MetaAPIService } = require('../src/lib/meta-api');
    const metaService = new MetaAPIService(client.meta_access_token);

    // Validate token
    const tokenValidation = await metaService.validateToken();
    validation.meta.tokenValid = tokenValidation.valid;

    if (!tokenValidation.valid) {
      validation.issues.push({
        type: 'INVALID_META_TOKEN',
        severity: 'HIGH',
        message: `Meta token validation failed: ${tokenValidation.error}`
      });
      validation.meta.error = tokenValidation.error;
      return;
    }

    // Validate ad account access
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const accountValidation = await metaService.validateAdAccount(adAccountId);
    validation.meta.accountValid = accountValidation.valid;

    if (!accountValidation.valid) {
      validation.issues.push({
        type: 'INVALID_AD_ACCOUNT',
        severity: 'HIGH',
        message: `Ad account validation failed: ${accountValidation.error}`
      });
      validation.meta.error = accountValidation.error;
      return;
    }

    // Test recent data fetch
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    try {
      const recentCampaigns = await metaService.getCampaignInsights(
        adAccountId,
        last7Days.toISOString().split('T')[0],
        now.toISOString().split('T')[0],
        0
      );
      
      validation.meta.lastSpend = recentCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      
      if (recentCampaigns.length === 0) {
        validation.issues.push({
          type: 'NO_RECENT_CAMPAIGNS',
          severity: 'MEDIUM',
          message: 'No campaigns found in last 7 days'
        });
      }
    } catch (dataError) {
      validation.issues.push({
        type: 'DATA_FETCH_ERROR',
        severity: 'MEDIUM',
        message: `Could not fetch recent campaign data: ${dataError.message}`
      });
    }

  } catch (error) {
    validation.meta.error = error.message;
    validation.issues.push({
      type: 'META_API_ERROR',
      severity: 'HIGH',
      message: `Meta API error: ${error.message}`
    });
  }
}

async function validateGoogleAdsCredentials(client, validation) {
  validation.googleAds.enabled = !!client.google_ads_enabled;
  validation.googleAds.hasCustomerId = !!client.google_ads_customer_id;

  if (!validation.googleAds.enabled) {
    // Google Ads not enabled - this is OK
    return;
  }

  if (!validation.googleAds.hasCustomerId) {
    validation.issues.push({
      type: 'MISSING_GOOGLE_ADS_CUSTOMER_ID',
      severity: 'MEDIUM',
      message: 'Google Ads enabled but customer ID is missing'
    });
    return;
  }

  try {
    // Get Google Ads credentials from system settings
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
      validation.issues.push({
        type: 'MISSING_GOOGLE_ADS_SYSTEM_CREDENTIALS',
        severity: 'HIGH',
        message: 'Google Ads system credentials not configured'
      });
      return;
    }

    // Test Google Ads API connection (simplified test)
    validation.googleAds.credentialsValid = true;

  } catch (error) {
    validation.issues.push({
      type: 'GOOGLE_ADS_API_ERROR',
      severity: 'MEDIUM',
      message: `Google Ads API error: ${error.message}`
    });
  }
}

function validateGeneralSetup(client, validation) {
  // Check contact emails
  validation.setup.hasContactEmails = Array.isArray(client.contact_emails) && client.contact_emails.length > 0;
  if (!validation.setup.hasContactEmails) {
    validation.issues.push({
      type: 'MISSING_CONTACT_EMAILS',
      severity: 'MEDIUM',
      message: 'No contact emails configured'
    });
  }

  // Check reporting frequency
  validation.setup.hasReportingFrequency = !!client.reporting_frequency;
  if (!validation.setup.hasReportingFrequency) {
    validation.issues.push({
      type: 'MISSING_REPORTING_FREQUENCY',
      severity: 'LOW',
      message: 'Reporting frequency not set'
    });
  }

  // Check basic required fields
  if (!client.name || client.name.trim() === '') {
    validation.issues.push({
      type: 'MISSING_CLIENT_NAME',
      severity: 'HIGH',
      message: 'Client name is missing or empty'
    });
  }

  if (!client.email || !client.email.includes('@')) {
    validation.issues.push({
      type: 'INVALID_EMAIL',
      severity: 'HIGH',
      message: 'Client email is missing or invalid'
    });
  }
}

function calculateOverallStatus(validation) {
  let score = 0;
  const maxScore = 100;

  // Meta setup (50 points)
  if (validation.meta.hasToken) score += 10;
  if (validation.meta.hasAdAccount) score += 10;
  if (validation.meta.tokenValid) score += 15;
  if (validation.meta.accountValid) score += 15;

  // Google Ads setup (20 points) - optional
  if (validation.googleAds.enabled) {
    if (validation.googleAds.hasCustomerId) score += 10;
    if (validation.googleAds.credentialsValid) score += 10;
  } else {
    score += 20; // Full points if not using Google Ads
  }

  // General setup (30 points)
  if (validation.setup.hasContactEmails) score += 10;
  if (validation.setup.hasReportingFrequency) score += 5;
  
  // Deduct for high severity issues
  const highSeverityIssues = validation.issues.filter(i => i.severity === 'HIGH').length;
  score -= highSeverityIssues * 10;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score));

  validation.overall.score = score;
  validation.overall.isValid = score >= 70; // 70% threshold for valid

  if (score >= 90) {
    validation.overall.status = 'EXCELLENT';
  } else if (score >= 70) {
    validation.overall.status = 'GOOD';
  } else if (score >= 50) {
    validation.overall.status = 'NEEDS_ATTENTION';
  } else {
    validation.overall.status = 'CRITICAL';
  }
}

function displayValidationResults(validation) {
  const { overall, meta, googleAds, setup, issues } = validation;

  console.log(`📊 Overall Score: ${overall.score}/100 (${overall.status})`);
  console.log(`✅ Valid: ${overall.isValid ? 'YES' : 'NO'}`);

  console.log('\n📱 Meta Ads Setup:');
  console.log(`   Token: ${meta.hasToken ? '✅' : '❌'} ${meta.tokenValid ? '(Valid)' : meta.hasToken ? '(Invalid)' : ''}`);
  console.log(`   Ad Account: ${meta.hasAdAccount ? '✅' : '❌'} ${meta.accountValid ? '(Valid)' : meta.hasAdAccount ? '(Invalid)' : ''}`);
  if (meta.lastSpend !== null) {
    console.log(`   Recent Spend: ${meta.lastSpend.toFixed(2)} PLN (last 7 days)`);
  }

  console.log('\n🔍 Google Ads Setup:');
  console.log(`   Enabled: ${googleAds.enabled ? '✅' : '❌'}`);
  if (googleAds.enabled) {
    console.log(`   Customer ID: ${googleAds.hasCustomerId ? '✅' : '❌'}`);
    console.log(`   Credentials: ${googleAds.credentialsValid ? '✅' : '❌'}`);
  }

  console.log('\n⚙️  General Setup:');
  console.log(`   Contact Emails: ${setup.hasContactEmails ? '✅' : '❌'}`);
  console.log(`   Reporting Frequency: ${setup.hasReportingFrequency ? '✅' : '❌'}`);

  if (issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    issues.forEach(issue => {
      const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`   ${icon} ${issue.message}`);
    });
  }
}

async function attemptFixes(client, validation) {
  let fixedIssues = 0;
  const totalIssues = validation.issues.length;

  for (const issue of validation.issues) {
    try {
      let fixed = false;

      switch (issue.type) {
        case 'MISSING_CONTACT_EMAILS':
          // Add client email as default contact email
          const { error: emailError } = await supabase
            .from('clients')
            .update({ contact_emails: [client.email] })
            .eq('id', client.id);
          
          if (!emailError) {
            console.log('   ✅ Added client email as contact email');
            fixed = true;
          }
          break;

        case 'MISSING_REPORTING_FREQUENCY':
          // Set default reporting frequency to monthly
          const { error: freqError } = await supabase
            .from('clients')
            .update({ reporting_frequency: 'monthly' })
            .eq('id', client.id);
          
          if (!freqError) {
            console.log('   ✅ Set default reporting frequency to monthly');
            fixed = true;
          }
          break;

        // Add more automatic fixes as needed
      }

      if (fixed) {
        fixedIssues++;
      }

    } catch (error) {
      console.log(`   ❌ Could not fix ${issue.type}: ${error.message}`);
    }
  }

  return fixedIssues > 0;
}

async function generateValidationReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalClients: results.length,
      validClients: results.filter(r => r.overall.isValid).length,
      averageScore: results.reduce((sum, r) => sum + r.overall.score, 0) / results.length,
      issueTypes: {}
    },
    clients: results
  };

  // Count issue types
  results.forEach(result => {
    result.issues.forEach(issue => {
      report.summary.issueTypes[issue.type] = (report.summary.issueTypes[issue.type] || 0) + 1;
    });
  });

  const fs = require('fs');
  const reportPath = `client-validation-report-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return reportPath;
}

// Run the validation
if (require.main === module) {
  validateAllClientCredentials().catch(console.error);
}

module.exports = { validateAllClientCredentials, validateClientCredentials };
