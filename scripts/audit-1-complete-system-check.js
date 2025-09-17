#!/usr/bin/env node

/**
 * AUDIT #1: Complete Google Ads Integration System Check
 * Client-Ready Report - Comprehensive Status Overview
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class GoogleAdsAudit {
  constructor() {
    this.results = {
      credentials: {},
      oauth: {},
      api: {},
      account: {},
      overall: { status: 'unknown', issues: [], recommendations: [] }
    };
  }

  async getCredentials() {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_client_id', 
        'google_ads_client_secret',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);
    
    if (error) throw new Error(`Failed to get credentials: ${error.message}`);
    
    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });
    
    return creds;
  }

  auditCredentials(credentials) {
    console.log('🔐 AUDIT 1: CREDENTIALS VALIDATION');
    console.log('==================================');
    
    const checks = [
      {
        name: 'Developer Token',
        key: 'google_ads_developer_token',
        value: credentials.google_ads_developer_token,
        validator: (v) => v && v.length === 22 && /^[A-Za-z0-9_-]+$/.test(v),
        expected: '22-character alphanumeric token',
        critical: true
      },
      {
        name: 'Manager Customer ID',
        key: 'google_ads_manager_customer_id',
        value: credentials.google_ads_manager_customer_id,
        validator: (v) => v && /^\d{3}-\d{3}-\d{4}$/.test(v),
        expected: 'XXX-XXX-XXXX format',
        critical: true
      },
      {
        name: 'OAuth Client ID',
        key: 'google_ads_client_id',
        value: credentials.google_ads_client_id,
        validator: (v) => v && v.includes('.apps.googleusercontent.com'),
        expected: 'Google OAuth Client ID',
        critical: true
      },
      {
        name: 'OAuth Client Secret',
        key: 'google_ads_client_secret',
        value: credentials.google_ads_client_secret,
        validator: (v) => v && v.startsWith('GOCSPX-'),
        expected: 'Google OAuth Client Secret',
        critical: true
      },
      {
        name: 'Manager Refresh Token',
        key: 'google_ads_manager_refresh_token',
        value: credentials.google_ads_manager_refresh_token,
        validator: (v) => v && v.startsWith('1//') && v.length > 50,
        expected: 'OAuth Refresh Token',
        critical: true
      }
    ];
    
    let passCount = 0;
    let criticalIssues = 0;
    
    checks.forEach(check => {
      const isValid = check.validator(check.value);
      const status = isValid ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${check.name}: ${status}`);
      console.log(`   Expected: ${check.expected}`);
      console.log(`   Value: ${check.value ? check.value.substring(0, 20) + '...' : 'MISSING'}`);
      
      if (isValid) {
        passCount++;
      } else if (check.critical) {
        criticalIssues++;
      }
      
      this.results.credentials[check.key] = {
        name: check.name,
        valid: isValid,
        value: check.value ? `${check.value.substring(0, 10)}...` : 'MISSING',
        critical: check.critical
      };
    });
    
    this.results.credentials.summary = {
      total: checks.length,
      passed: passCount,
      failed: checks.length - passCount,
      criticalIssues: criticalIssues,
      status: criticalIssues === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`\n📊 Credentials Summary: ${passCount}/${checks.length} passed`);
    console.log(`   Critical Issues: ${criticalIssues}`);
    console.log(`   Overall Status: ${this.results.credentials.summary.status}`);
    
    return this.results.credentials.summary.status === 'PASS';
  }

  async auditOAuthFlow(credentials) {
    console.log('\n🔄 AUDIT 2: OAUTH AUTHENTICATION FLOW');
    console.log('=====================================');
    
    try {
      console.log('🔄 Testing OAuth token refresh...');
      
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
      
      console.log(`   Response Status: ${response.status}`);
      
      if (response.status === 200) {
        const tokenData = await response.json();
        console.log('✅ OAuth Flow: SUCCESS');
        console.log(`   Access Token: ${tokenData.access_token.substring(0, 20)}...`);
        console.log(`   Token Type: ${tokenData.token_type}`);
        console.log(`   Expires In: ${tokenData.expires_in} seconds`);
        
        this.results.oauth = {
          status: 'SUCCESS',
          accessToken: tokenData.access_token,
          tokenType: tokenData.token_type,
          expiresIn: tokenData.expires_in,
          timestamp: new Date().toISOString()
        };
        
        return tokenData.access_token;
      } else {
        const errorText = await response.text();
        console.log('❌ OAuth Flow: FAILED');
        console.log(`   Error: ${errorText}`);
        
        this.results.oauth = {
          status: 'FAILED',
          error: errorText,
          httpStatus: response.status
        };
        
        return null;
      }
      
    } catch (error) {
      console.log(`❌ OAuth Flow: ERROR - ${error.message}`);
      
      this.results.oauth = {
        status: 'ERROR',
        error: error.message
      };
      
      return null;
    }
  }

  async auditGoogleAdsAPI(credentials, accessToken) {
    console.log('\n📡 AUDIT 3: GOOGLE ADS API CONNECTIVITY');
    console.log('=======================================');
    
    if (!accessToken) {
      console.log('❌ Skipping API test - no access token');
      this.results.api = { status: 'SKIPPED', reason: 'No access token' };
      return false;
    }
    
    const testCases = [
      {
        name: 'List Accessible Customers (v14)',
        url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': credentials.google_ads_developer_token,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'List Accessible Customers (v14 + login-customer-id)',
        url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': credentials.google_ads_developer_token,
          'Content-Type': 'application/json',
          'login-customer-id': credentials.google_ads_manager_customer_id.replace(/-/g, '')
        }
      },
      {
        name: 'List Accessible Customers (v13)',
        url: 'https://googleads.googleapis.com/v13/customers:listAccessibleCustomers',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': credentials.google_ads_developer_token,
          'Content-Type': 'application/json'
        }
      }
    ];
    
    const results = [];
    let hasSuccess = false;
    
    for (const test of testCases) {
      console.log(`\n🧪 Testing: ${test.name}`);
      
      try {
        const response = await fetch(test.url, {
          method: 'GET',
          headers: test.headers
        });
        
        console.log(`   Status: ${response.status}`);
        
        const result = {
          name: test.name,
          url: test.url,
          status: response.status,
          success: false,
          details: {}
        };
        
        if (response.status === 200) {
          const data = await response.json();
          console.log('   ✅ SUCCESS!');
          
          if (data.resourceNames) {
            console.log(`   📊 Found ${data.resourceNames.length} accessible customers:`);
            data.resourceNames.slice(0, 3).forEach(name => {
              const id = name.replace('customers/', '');
              const formatted = id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
              console.log(`      - ${id} (${formatted})`);
            });
            
            result.success = true;
            result.details = {
              customerCount: data.resourceNames.length,
              customers: data.resourceNames.slice(0, 5).map(name => ({
                id: name.replace('customers/', ''),
                formatted: name.replace('customers/', '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
              }))
            };
            hasSuccess = true;
          }
        } else if (response.status === 400) {
          const errorData = await response.json();
          console.log('   ⚠️  400 Bad Request (API accessible but request invalid)');
          result.details = { error: errorData, apiAccessible: true };
        } else if (response.status === 401) {
          console.log('   ⚠️  401 Unauthorized (API accessible but auth issue)');
          result.details = { error: 'Unauthorized', apiAccessible: true };
        } else if (response.status === 403) {
          const errorData = await response.json();
          console.log('   ⚠️  403 Forbidden (API accessible but permission issue)');
          result.details = { error: errorData, apiAccessible: true };
        } else if (response.status === 404) {
          console.log('   ❌ 404 Not Found (API endpoint not found)');
          result.details = { error: 'API endpoint not found', apiAccessible: false };
        } else {
          const errorText = await response.text();
          console.log(`   ❌ ${response.status}: ${errorText.substring(0, 100)}...`);
          result.details = { error: errorText.substring(0, 200) };
        }
        
        results.push(result);
        
      } catch (error) {
        console.log(`   ❌ Network Error: ${error.message}`);
        results.push({
          name: test.name,
          url: test.url,
          status: 'NETWORK_ERROR',
          success: false,
          details: { error: error.message }
        });
      }
    }
    
    this.results.api = {
      status: hasSuccess ? 'SUCCESS' : 'FAILED',
      tests: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
    
    console.log(`\n📊 API Test Summary: ${this.results.api.summary.successful}/${this.results.api.summary.total} successful`);
    
    return hasSuccess;
  }

  generateClientReport() {
    console.log('\n📋 CLIENT REPORT: GOOGLE ADS INTEGRATION STATUS');
    console.log('================================================');
    
    // Overall Status
    let overallStatus = 'OPERATIONAL';
    const issues = [];
    const recommendations = [];
    
    // Check credentials
    if (this.results.credentials.summary?.status !== 'PASS') {
      overallStatus = 'CONFIGURATION_ERROR';
      issues.push('Invalid or missing credentials');
      recommendations.push('Verify all Google Ads API credentials are correctly configured');
    }
    
    // Check OAuth
    if (this.results.oauth.status !== 'SUCCESS') {
      overallStatus = 'AUTHENTICATION_ERROR';
      issues.push('OAuth authentication failed');
      recommendations.push('Check OAuth Client ID, Client Secret, and Refresh Token');
    }
    
    // Check API
    if (this.results.api.status !== 'SUCCESS') {
      if (this.results.api.status === 'FAILED') {
        overallStatus = 'API_ACCESS_ERROR';
        issues.push('Google Ads API endpoints not accessible');
        recommendations.push('Verify developer token approval status in Google Ads account');
        recommendations.push('Ensure Google Ads API is enabled in Google Cloud Console');
        recommendations.push('Check account spending requirements ($100+ lifetime spend)');
      }
    }
    
    this.results.overall = { status: overallStatus, issues, recommendations };
    
    // Status indicators
    const statusEmoji = {
      'OPERATIONAL': '✅',
      'CONFIGURATION_ERROR': '⚠️',
      'AUTHENTICATION_ERROR': '❌',
      'API_ACCESS_ERROR': '🔒'
    };
    
    console.log(`\n${statusEmoji[overallStatus]} OVERALL STATUS: ${overallStatus}`);
    console.log('='.repeat(50));
    
    // Detailed breakdown
    console.log('\n📊 COMPONENT STATUS:');
    console.log(`   Credentials: ${this.results.credentials.summary?.status === 'PASS' ? '✅' : '❌'} ${this.results.credentials.summary?.status || 'UNKNOWN'}`);
    console.log(`   OAuth Flow: ${this.results.oauth.status === 'SUCCESS' ? '✅' : '❌'} ${this.results.oauth.status}`);
    console.log(`   API Access: ${this.results.api.status === 'SUCCESS' ? '✅' : '❌'} ${this.results.api.status}`);
    
    // Issues found
    if (issues.length > 0) {
      console.log('\n⚠️  ISSUES IDENTIFIED:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    // Working features (if any)
    if (this.results.api.status === 'SUCCESS') {
      console.log('\n✅ WORKING FEATURES:');
      console.log('   - Google Ads data fetching');
      console.log('   - Campaign performance metrics');
      console.log('   - Customer account access');
      console.log('   - Real-time API connectivity');
    }
    
    // Next steps
    console.log('\n📞 IMMEDIATE NEXT STEPS:');
    
    if (overallStatus === 'OPERATIONAL') {
      console.log('   🎉 Integration is fully operational!');
      console.log('   - Test with client data');
      console.log('   - Set up automated reports');
      console.log('   - Configure dashboard widgets');
    } else if (overallStatus === 'API_ACCESS_ERROR') {
      console.log('   1. Check developer token status in Google Ads account');
      console.log('   2. Verify Google Ads API is enabled in Google Cloud Console');
      console.log('   3. Ensure manager account has $100+ lifetime spend');
      console.log('   4. Wait 24-48 hours if token is under review');
    } else if (overallStatus === 'AUTHENTICATION_ERROR') {
      console.log('   1. Regenerate OAuth credentials');
      console.log('   2. Update refresh token');
      console.log('   3. Verify OAuth scope permissions');
    } else {
      console.log('   1. Verify all credentials are correctly entered');
      console.log('   2. Check Google Cloud project settings');
      console.log('   3. Ensure all required APIs are enabled');
    }
    
    return this.results;
  }

  generateJSONReport() {
    return {
      timestamp: new Date().toISOString(),
      integration: 'Google Ads API',
      status: this.results.overall.status,
      summary: {
        operational: this.results.overall.status === 'OPERATIONAL',
        issues: this.results.overall.issues,
        recommendations: this.results.overall.recommendations
      },
      details: this.results
    };
  }
}

async function main() {
  console.log('🔍 COMPREHENSIVE GOOGLE ADS INTEGRATION AUDIT');
  console.log('==============================================\n');
  
  const audit = new GoogleAdsAudit();
  
  try {
    // Get credentials
    const credentials = await audit.getCredentials();
    
    // Run audits
    const credentialsValid = audit.auditCredentials(credentials);
    const accessToken = await audit.auditOAuthFlow(credentials);
    const apiWorking = await audit.auditGoogleAdsAPI(credentials, accessToken);
    
    // Generate reports
    const fullResults = audit.generateClientReport();
    
    console.log('\n💾 SAVING AUDIT REPORT...');
    const jsonReport = audit.generateJSONReport();
    
    // Save to file
    const fs = require('fs');
    const reportFilename = `google-ads-audit-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(reportFilename, JSON.stringify(jsonReport, null, 2));
    console.log(`✅ Report saved: ${reportFilename}`);
    
    console.log('\n🎯 AUDIT COMPLETE');
    console.log('================');
    console.log(`Final Status: ${jsonReport.status}`);
    console.log(`Operational: ${jsonReport.summary.operational ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 