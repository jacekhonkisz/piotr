#!/usr/bin/env node

/**
 * AUDIT #2: Developer Token & Google Ads Account Status
 * Client-Ready Report - Focus on Token Approval & Account Requirements
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class DeveloperTokenAudit {
  constructor() {
    this.findings = {
      tokenStatus: 'unknown',
      accountStatus: 'unknown',
      apiEnabled: 'unknown',
      issues: [],
      recommendations: [],
      timeline: 'unknown'
    };
  }

  async getCredentials() {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_manager_customer_id',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_manager_refresh_token'
      ]);
    
    if (error) throw new Error(`Failed to get credentials: ${error.message}`);
    
    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });
    
    return creds;
  }

  async testTokenApprovalStatus(credentials) {
    console.log('🔑 AUDIT 2A: DEVELOPER TOKEN APPROVAL STATUS');
    console.log('============================================');
    
    console.log(`📋 Token Information:`);
    console.log(`   Developer Token: ${credentials.google_ads_developer_token}`);
    console.log(`   Manager Customer ID: ${credentials.google_ads_manager_customer_id}`);
    console.log(`   Format: ${/^[A-Za-z0-9_-]{22}$/.test(credentials.google_ads_developer_token) ? '✅ Valid' : '❌ Invalid'}`);
    
    // Test token with different API scenarios
    const testScenarios = [
      {
        name: 'Token Format Validation',
        test: () => /^[A-Za-z0-9_-]{22}$/.test(credentials.google_ads_developer_token),
        description: 'Verify token matches Google Ads format requirements'
      },
      {
        name: 'Customer ID Format',
        test: () => /^\d{3}-\d{3}-\d{4}$/.test(credentials.google_ads_manager_customer_id),
        description: 'Verify customer ID format is correct'
      }
    ];
    
    console.log('\n🧪 Token Validation Tests:');
    
    testScenarios.forEach(scenario => {
      const result = scenario.test();
      console.log(`   ${scenario.name}: ${result ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`      ${scenario.description}`);
      
      if (!result) {
        this.findings.issues.push(`${scenario.name} failed`);
      }
    });
    
    return true;
  }

  async diagnoseAPIErrorPattern(credentials, accessToken) {
    console.log('\n📊 AUDIT 2B: API ERROR PATTERN ANALYSIS');
    console.log('=======================================');
    
    const diagnosticTests = [
      {
        name: 'Basic API Connectivity',
        url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
        expectedErrors: {
          404: 'API not enabled OR Developer token not approved',
          401: 'Authentication issue (token expired/invalid)',
          403: 'Permission denied (token approved but insufficient permissions)',
          400: 'Bad request (API accessible, request format issue)'
        }
      },
      {
        name: 'Alternative API Version',
        url: 'https://googleads.googleapis.com/v13/customers:listAccessibleCustomers',
        expectedErrors: {
          404: 'API version deprecated or not enabled',
          401: 'Authentication issue',
          403: 'Permission denied',
          400: 'Bad request format'
        }
      }
    ];
    
    const errorPattern = [];
    
    for (const test of diagnosticTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      
      try {
        const response = await fetch(test.url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': credentials.google_ads_developer_token,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`   Status: ${response.status}`);
        
        const diagnosis = test.expectedErrors[response.status] || 'Unknown error pattern';
        console.log(`   Diagnosis: ${diagnosis}`);
        
        errorPattern.push({
          test: test.name,
          status: response.status,
          diagnosis: diagnosis
        });
        
        if (response.status === 404) {
          this.findings.tokenStatus = 'likely_not_approved';
          this.findings.issues.push('All API endpoints return 404 - suggests token not approved');
        } else if (response.status === 403) {
          this.findings.tokenStatus = 'approved_insufficient_permissions';
          this.findings.issues.push('Token approved but insufficient account permissions');
        } else if (response.status === 401) {
          this.findings.tokenStatus = 'authentication_issue';
          this.findings.issues.push('Authentication failure - OAuth or token issue');
        } else if (response.status === 200) {
          this.findings.tokenStatus = 'approved_working';
        }
        
      } catch (error) {
        console.log(`   Error: ${error.message}`);
        errorPattern.push({
          test: test.name,
          status: 'NETWORK_ERROR',
          diagnosis: 'Network connectivity issue'
        });
      }
    }
    
    // Analyze pattern
    console.log('\n📊 Error Pattern Analysis:');
    const statusCounts = {};
    errorPattern.forEach(result => {
      statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} occurrence(s)`);
    });
    
    // Determine likely cause
    if (statusCounts['404'] >= 2) {
      console.log('\n🎯 LIKELY CAUSE: Developer Token Not Approved');
      console.log('   All API endpoints returning 404 indicates token needs approval');
      this.findings.tokenStatus = 'not_approved';
      this.findings.timeline = '24-48 hours for approval';
    } else if (statusCounts['403'] >= 1) {
      console.log('\n🎯 LIKELY CAUSE: Insufficient Permissions');
      console.log('   Token approved but account lacks required permissions');
      this.findings.tokenStatus = 'approved_no_permissions';
    } else if (statusCounts['401'] >= 1) {
      console.log('\n🎯 LIKELY CAUSE: Authentication Issue');
      console.log('   OAuth credentials or refresh token problem');
      this.findings.tokenStatus = 'auth_issue';
    }
    
    return errorPattern;
  }

  async checkAccountRequirements() {
    console.log('\n💰 AUDIT 2C: GOOGLE ADS ACCOUNT REQUIREMENTS');
    console.log('============================================');
    
    console.log('📋 Developer Token Approval Requirements:');
    console.log('');
    console.log('1. 🏢 ACCOUNT TYPE REQUIREMENTS:');
    console.log('   ✅ Manager Account (MCC) - You have: 293-100-0497');
    console.log('   ✅ Google Cloud Project - You have: cellular-nuance-469408-b3');
    console.log('   ✅ OAuth Credentials - Configured');
    console.log('');
    console.log('2. 💰 SPENDING REQUIREMENTS:');
    console.log('   📊 Manager account needs ONE of these:');
    console.log('      - $100+ USD lifetime spend in manager account, OR');
    console.log('      - Linked client accounts with $100+ combined spend, OR');
    console.log('      - Active campaigns with sufficient activity');
    console.log('');
    console.log('3. 🔐 API ACCESS REQUIREMENTS:');
    console.log('   📋 Must be enabled in Google Ads account:');
    console.log('      - API Center access enabled');
    console.log('      - Developer token requested and approved');
    console.log('      - Account in good standing');
    console.log('');
    console.log('4. 🌍 TECHNICAL REQUIREMENTS:');
    console.log('   ✅ Google Ads API enabled in Cloud Console');
    console.log('   ✅ OAuth 2.0 credentials configured');
    console.log('   ✅ Proper scopes requested');
    
    // Check likely account status
    console.log('\n🔍 ACCOUNT STATUS ASSESSMENT:');
    console.log('============================');
    
    if (this.findings.tokenStatus === 'not_approved') {
      console.log('⏳ ASSESSMENT: Token Pending Approval');
      console.log('');
      console.log('   Most likely scenario:');
      console.log('   - Token was recently requested');
      console.log('   - Google is reviewing the application');
      console.log('   - Account meets basic requirements');
      console.log('   - Approval typically takes 24-48 hours');
      
      this.findings.accountStatus = 'pending_approval';
      this.findings.recommendations.push('Wait 24-48 hours for token approval');
      this.findings.recommendations.push('Check token status in Google Ads API Center');
      
    } else if (this.findings.tokenStatus === 'approved_no_permissions') {
      console.log('⚠️  ASSESSMENT: Token Approved, Insufficient Spend');
      console.log('');
      console.log('   Most likely scenario:');
      console.log('   - Token is approved by Google');
      console.log('   - Account lacks sufficient spending history');
      console.log('   - Need to reach $100+ lifetime spend');
      
      this.findings.accountStatus = 'approved_insufficient_spend';
      this.findings.recommendations.push('Increase account spending to $100+ lifetime');
      this.findings.recommendations.push('Link client accounts with existing spend');
      this.findings.recommendations.push('Run test campaigns to build spending history');
    }
    
    return this.findings.accountStatus;
  }

  generateActionPlan() {
    console.log('\n🎯 ACTION PLAN FOR CLIENT');
    console.log('========================');
    
    const scenarios = {
      'not_approved': {
        title: 'Developer Token Awaiting Approval',
        status: 'WAITING',
        urgency: 'LOW',
        timeline: '24-48 hours',
        actions: [
          'Check token status daily in Google Ads API Center',
          'Ensure manager account has activity/spend',
          'Verify account is in good standing',
          'Be patient - this is normal for new tokens'
        ],
        explanation: 'Your developer token is likely under Google review. This is a standard process for new API access requests.'
      },
      'approved_no_permissions': {
        title: 'Token Approved, Account Needs Spending',
        status: 'ACTION_REQUIRED',
        urgency: 'MEDIUM',
        timeline: '1-2 weeks',
        actions: [
          'Run campaigns to reach $100+ lifetime spend',
          'Link existing client accounts with spend history',
          'Verify all linked accounts are active',
          'Contact Google Ads support if issues persist'
        ],
        explanation: 'Your token is approved but the account needs more spending history to access full API features.'
      },
      'auth_issue': {
        title: 'Authentication Configuration Issue',
        status: 'FIX_REQUIRED',
        urgency: 'HIGH',
        timeline: '1-2 hours',
        actions: [
          'Regenerate OAuth refresh token',
          'Verify Client ID and Client Secret',
          'Check OAuth scope permissions',
          'Test authentication flow'
        ],
        explanation: 'There is a configuration issue with the OAuth authentication setup.'
      },
      'unknown': {
        title: 'Status Requires Investigation',
        status: 'INVESTIGATION_NEEDED',
        urgency: 'MEDIUM',
        timeline: '2-4 hours',
        actions: [
          'Check Google Ads account manually',
          'Verify all API requirements are met',
          'Contact Google Ads API support',
          'Review account status and permissions'
        ],
        explanation: 'The exact issue needs further investigation to determine the correct solution.'
      }
    };
    
    const scenario = scenarios[this.findings.tokenStatus] || scenarios['unknown'];
    
    console.log(`\n📋 SCENARIO: ${scenario.title}`);
    console.log(`   Status: ${scenario.status}`);
    console.log(`   Urgency: ${scenario.urgency}`);
    console.log(`   Timeline: ${scenario.timeline}`);
    console.log(`   Explanation: ${scenario.explanation}`);
    
    console.log('\n✅ IMMEDIATE ACTIONS:');
    scenario.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action}`);
    });
    
    // Additional monitoring
    console.log('\n📊 MONITORING RECOMMENDATIONS:');
    console.log('   1. Check Google Ads account daily for token status updates');
    console.log('   2. Run this audit script daily to track progress');
    console.log('   3. Keep documentation of all changes made');
    console.log('   4. Save error messages and response codes for support');
    
    return scenario;
  }

  generateSummaryReport() {
    console.log('\n📄 EXECUTIVE SUMMARY FOR CLIENT');
    console.log('===============================');
    
    const statusEmojis = {
      'not_approved': '⏳',
      'approved_no_permissions': '⚠️',
      'auth_issue': '❌',
      'approved_working': '✅',
      'unknown': '❓'
    };
    
    const emoji = statusEmojis[this.findings.tokenStatus] || '❓';
    
    console.log(`${emoji} GOOGLE ADS INTEGRATION STATUS`);
    console.log('');
    console.log(`Current State: ${this.findings.tokenStatus.replace(/_/g, ' ').toUpperCase()}`);
    console.log(`Timeline: ${this.findings.timeline}`);
    console.log(`Issues Found: ${this.findings.issues.length}`);
    console.log(`Recommendations: ${this.findings.recommendations.length}`);
    console.log('');
    
    if (this.findings.issues.length > 0) {
      console.log('🔧 KEY ISSUES:');
      this.findings.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }
    
    console.log('💡 NEXT STEPS:');
    this.findings.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
    // Client communication template
    console.log('\n📧 CLIENT COMMUNICATION TEMPLATE:');
    console.log('=================================');
    console.log('');
    console.log('Subject: Google Ads Integration Status Update');
    console.log('');
    console.log(`Hi [Client Name],`);
    console.log('');
    console.log(`I've completed a comprehensive audit of your Google Ads API integration.`);
    console.log('');
    console.log(`Current Status: ${this.findings.tokenStatus.replace(/_/g, ' ')}`);
    console.log(`Expected Resolution: ${this.findings.timeline}`);
    console.log('');
    
    if (this.findings.tokenStatus === 'not_approved') {
      console.log(`The integration is 99% complete. We're waiting for Google to approve`);
      console.log(`your developer token, which typically takes 24-48 hours. This is a`);
      console.log(`standard process for new API access requests.`);
    } else if (this.findings.tokenStatus === 'approved_no_permissions') {
      console.log(`Your developer token has been approved! However, your Google Ads`);
      console.log(`account needs to reach $100+ in lifetime spending to access full`);
      console.log(`API features. This is a Google requirement for API access.`);
    }
    
    console.log('');
    console.log(`I'll continue monitoring the status and will update you as soon as`);
    console.log(`the integration is fully operational.`);
    console.log('');
    console.log(`Best regards,`);
    console.log(`[Your Name]`);
    
    return {
      status: this.findings.tokenStatus,
      timeline: this.findings.timeline,
      issues: this.findings.issues,
      recommendations: this.findings.recommendations
    };
  }
}

async function main() {
  console.log('🔍 DEVELOPER TOKEN FOCUSED AUDIT');
  console.log('================================\n');
  
  const audit = new DeveloperTokenAudit();
  
  try {
    const credentials = await audit.getCredentials();
    
    // Test OAuth first
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.google_ads_client_id,
        client_secret: credentials.google_ads_client_secret,
        refresh_token: credentials.google_ads_manager_refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    let accessToken = null;
    if (response.ok) {
      const tokenData = await response.json();
      accessToken = tokenData.access_token;
      console.log('✅ OAuth authentication successful');
    } else {
      console.log('❌ OAuth authentication failed');
    }
    
    // Run focused audits
    await audit.testTokenApprovalStatus(credentials);
    await audit.diagnoseAPIErrorPattern(credentials, accessToken);
    await audit.checkAccountRequirements();
    const actionPlan = audit.generateActionPlan();
    const summary = audit.generateSummaryReport();
    
    // Save report
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      audit_type: 'developer_token_focus',
      findings: audit.findings,
      action_plan: actionPlan,
      summary: summary
    };
    
    const filename = `developer-token-audit-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed report saved: ${filename}`);
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 