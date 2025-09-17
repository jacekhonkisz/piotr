#!/usr/bin/env node

/**
 * AUDIT: Test Token vs Production Token Check
 * Determine if client needs to apply for production developer token
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class TestTokenAudit {
  constructor() {
    this.tokenType = 'unknown';
    this.needsProductionToken = false;
    this.actionRequired = [];
  }

  async getCredentials() {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_manager_customer_id'
      ]);
    
    if (error) throw new Error(`Failed to get credentials: ${error.message}`);
    
    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });
    
    return creds;
  }

  analyzeTokenType(developerToken) {
    console.log('🔍 ANALYZING DEVELOPER TOKEN TYPE');
    console.log('=================================');
    console.log(`Token: ${developerToken}`);
    console.log('');

    // Test token characteristics
    const tokenAnalysis = {
      isTestToken: false,
      isProductionToken: false,
      confidence: 'unknown',
      indicators: []
    };

    // Check for test token patterns
    if (developerToken.includes('test') || developerToken.includes('TEST')) {
      tokenAnalysis.isTestToken = true;
      tokenAnalysis.confidence = 'high';
      tokenAnalysis.indicators.push('Contains "test" in token string');
    }

    // Check for common test token formats
    if (developerToken.startsWith('TEST_') || developerToken.endsWith('_TEST')) {
      tokenAnalysis.isTestToken = true;
      tokenAnalysis.confidence = 'high';
      tokenAnalysis.indicators.push('Follows test token naming convention');
    }

    // Production token characteristics
    if (developerToken.length === 22 && /^[A-Za-z0-9_-]+$/.test(developerToken)) {
      if (!tokenAnalysis.isTestToken) {
        tokenAnalysis.isProductionToken = true;
        tokenAnalysis.confidence = 'medium';
        tokenAnalysis.indicators.push('Matches production token format (22 chars, alphanumeric)');
      }
    }

    // Common production token patterns (start with letters)
    if (/^[A-Za-z]{2,4}[A-Za-z0-9_-]{18,20}$/.test(developerToken) && !tokenAnalysis.isTestToken) {
      tokenAnalysis.isProductionToken = true;
      tokenAnalysis.confidence = 'high';
      tokenAnalysis.indicators.push('Matches typical production token pattern');
    }

    console.log('📊 Token Analysis Results:');
    console.log(`   Format Length: ${developerToken.length} characters`);
    console.log(`   Pattern: ${/^[A-Za-z0-9_-]+$/.test(developerToken) ? 'Valid' : 'Invalid'}`);
    console.log(`   Test Token: ${tokenAnalysis.isTestToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   Production Token: ${tokenAnalysis.isProductionToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   Confidence: ${tokenAnalysis.confidence.toUpperCase()}`);
    console.log('');

    if (tokenAnalysis.indicators.length > 0) {
      console.log('🔍 Analysis Indicators:');
      tokenAnalysis.indicators.forEach((indicator, index) => {
        console.log(`   ${index + 1}. ${indicator}`);
      });
      console.log('');
    }

    this.tokenType = tokenAnalysis.isTestToken ? 'test' : 
                    tokenAnalysis.isProductionToken ? 'production' : 'unknown';

    return tokenAnalysis;
  }

  explainTestVsProductionTokens() {
    console.log('📚 TEST vs PRODUCTION TOKENS EXPLAINED');
    console.log('======================================');
    console.log('');

    console.log('🧪 TEST TOKENS:');
    console.log('   Purpose: Development and testing only');
    console.log('   Limitations:');
    console.log('   - Limited to test accounts');
    console.log('   - Cannot access real client data');
    console.log('   - May have rate limits');
    console.log('   - Not suitable for production use');
    console.log('');

    console.log('🚀 PRODUCTION TOKENS:');
    console.log('   Purpose: Live production applications');
    console.log('   Benefits:');
    console.log('   - Access to all client accounts');
    console.log('   - Real campaign data');
    console.log('   - Higher rate limits');
    console.log('   - Full API functionality');
    console.log('');

    console.log('🔄 APPROVAL PROCESS:');
    console.log('   Test Token: Immediate (no approval needed)');
    console.log('   Production Token: Requires Google approval (24-48 hours)');
    console.log('');
  }

  generateProductionTokenApplication() {
    console.log('📝 HOW TO APPLY FOR PRODUCTION DEVELOPER TOKEN');
    console.log('==============================================');
    console.log('');

    console.log('🎯 STEP-BY-STEP PRODUCTION TOKEN APPLICATION:');
    console.log('');

    console.log('1. 📱 ACCESS GOOGLE ADS ACCOUNT:');
    console.log('   - Go to: https://ads.google.com/aw/overview');
    console.log('   - Log in with manager account (293-100-0497)');
    console.log('');

    console.log('2. 🔧 NAVIGATE TO API CENTER:');
    console.log('   - Click "Tools and Settings" (wrench icon)');
    console.log('   - Go to "Setup" → "API Center"');
    console.log('   - This is where you manage developer tokens');
    console.log('');

    console.log('3. 🆕 REQUEST NEW PRODUCTION TOKEN:');
    console.log('   - Look for "Create Developer Token" or "Request Token"');
    console.log('   - Choose "Production" (not Test)');
    console.log('   - Fill out the application form');
    console.log('');

    console.log('4. 📋 APPLICATION REQUIREMENTS:');
    console.log('   Required Information:');
    console.log('   - Application name: "Client Dashboard Integration"');
    console.log('   - Application description: "API integration for client reporting and analytics"');
    console.log('   - Use case: "Automated reporting and dashboard data"');
    console.log('   - Account spending: Mention client accounts and spending levels');
    console.log('');

    console.log('5. 💰 ACCOUNT REQUIREMENTS (MUST MEET):');
    console.log('   ✅ Manager Customer ID: 293-100-0497 (you have this)');
    console.log('   💵 Spending requirement: ONE of these:');
    console.log('      - Manager account: $100+ USD lifetime spend, OR');
    console.log('      - Linked client accounts: $100+ combined spend, OR');
    console.log('      - Active campaigns with regular activity');
    console.log('');

    console.log('6. ⏱️ APPROVAL TIMELINE:');
    console.log('   - Submission: 5-10 minutes');
    console.log('   - Google review: 24-48 hours (business days)');
    console.log('   - Approval notification: Email + API Center update');
    console.log('');

    console.log('7. 🔄 AFTER APPROVAL:');
    console.log('   - Copy the new production token');
    console.log('   - Replace current test token in system');
    console.log('   - Test API connectivity');
    console.log('   - Full integration will work immediately');
    console.log('');

    this.actionRequired = [
      'Apply for production developer token in Google Ads API Center',
      'Wait 24-48 hours for Google approval',
      'Replace test token with approved production token',
      'Test integration with real client data'
    ];
  }

  generateClientCommunication() {
    console.log('📧 CLIENT COMMUNICATION STRATEGY');
    console.log('================================');
    console.log('');

    if (this.tokenType === 'test') {
      console.log('🎯 SITUATION: Using Test Token');
      console.log('');
      console.log('📞 WHAT TO TELL CLIENT:');
      console.log('');
      console.log('SHORT VERSION:');
      console.log('"We need to upgrade from the test token to a production token for your Google Ads integration. This requires a quick application to Google (5 minutes) and 24-48 hour approval. No additional cost or complexity - just a standard upgrade process."');
      console.log('');

      console.log('DETAILED VERSION:');
      console.log('"Good news - the integration is working perfectly with the test environment! Now we need to apply for a production developer token to access your real Google Ads data. This is a standard process where Google reviews the application to ensure legitimate use. The application takes 5 minutes to submit, and Google typically approves within 24-48 hours. Once approved, all your client data will be immediately available."');
      console.log('');

      console.log('📋 CLIENT ACTION REQUIRED:');
      console.log('   ✅ Access to Google Ads account (293-100-0497)');
      console.log('   ✅ 5 minutes to complete application');
      console.log('   ⏳ Wait for Google approval (24-48 hours)');
      console.log('   💰 Ensure account meets spending requirements');
      console.log('');

      console.log('💡 FRAME IT POSITIVELY:');
      console.log('   - "Testing phase complete - ready for production!"');
      console.log('   - "Standard upgrade process - shows Google we\'re legitimate"');
      console.log('   - "Only takes a few minutes, then Google handles the rest"');
      console.log('   - "Once approved, full access to all client data immediately"');

    } else if (this.tokenType === 'production') {
      console.log('🎯 SITUATION: Already Using Production Token');
      console.log('');
      console.log('📞 WHAT TO TELL CLIENT:');
      console.log('"You already have a production developer token, which is great! The 404 errors we\'re seeing suggest the token may need approval or there might be account spending requirements to meet. Let me check the approval status in your Google Ads account."');

    } else {
      console.log('🎯 SITUATION: Token Type Unclear');
      console.log('');
      console.log('📞 WHAT TO TELL CLIENT:');
      console.log('"I need to verify the type of developer token you\'re using. Can you check your Google Ads API Center to see if you have a test token (for development) or production token (for live use)? This will determine our next steps."');
    }
  }

  generateActionPlan() {
    console.log('\n🎯 IMMEDIATE ACTION PLAN');
    console.log('========================');
    console.log('');

    if (this.tokenType === 'test') {
      console.log('🚀 PRODUCTION TOKEN UPGRADE PLAN:');
      console.log('');
      console.log('PHASE 1: APPLICATION (5-10 minutes)');
      console.log('   1. Access Google Ads account (293-100-0497)');
      console.log('   2. Navigate to Tools → Setup → API Center');
      console.log('   3. Apply for production developer token');
      console.log('   4. Fill application with business details');
      console.log('');

      console.log('PHASE 2: WAITING (24-48 hours)');
      console.log('   1. Google reviews application');
      console.log('   2. Monitor approval status daily');
      console.log('   3. Check email for approval notification');
      console.log('');

      console.log('PHASE 3: IMPLEMENTATION (5 minutes)');
      console.log('   1. Copy approved production token');
      console.log('   2. Update system configuration');
      console.log('   3. Test with real client data');
      console.log('   4. Confirm full integration working');
      console.log('');

      console.log('📊 TIMELINE:');
      console.log('   Today: Submit application (5-10 minutes)');
      console.log('   24-48 hours: Google approval');
      console.log('   Post-approval: Live in 5 minutes');
      console.log('   Total: 1-2 business days');

    } else if (this.tokenType === 'production') {
      console.log('🔍 PRODUCTION TOKEN TROUBLESHOOTING:');
      console.log('');
      console.log('IMMEDIATE CHECKS:');
      console.log('   1. Verify token approval status in Google Ads');
      console.log('   2. Check account spending requirements');
      console.log('   3. Confirm API access permissions');
      console.log('   4. Test with different API endpoints');
      console.log('');

      console.log('IF SPENDING REQUIREMENT ISSUE:');
      console.log('   1. Run campaigns to reach $100+ spend');
      console.log('   2. Link client accounts with existing spend');
      console.log('   3. Contact Google Ads support if needed');

    } else {
      console.log('🔍 TOKEN VERIFICATION NEEDED:');
      console.log('');
      console.log('IMMEDIATE STEPS:');
      console.log('   1. Check Google Ads API Center');
      console.log('   2. Identify current token type');
      console.log('   3. Determine approval status');
      console.log('   4. Plan appropriate next steps');
    }

    return this.actionRequired;
  }
}

async function main() {
  console.log('🔍 TEST vs PRODUCTION TOKEN AUDIT');
  console.log('==================================\n');

  const audit = new TestTokenAudit();

  try {
    const credentials = await audit.getCredentials();
    
    // Analyze token type
    const analysis = audit.analyzeTokenType(credentials.google_ads_developer_token);
    
    // Explain the difference
    audit.explainTestVsProductionTokens();
    
    // Generate application guide
    audit.generateProductionTokenApplication();
    
    // Client communication strategy
    audit.generateClientCommunication();
    
    // Action plan
    const actions = audit.generateActionPlan();

    // Summary
    console.log('\n📄 AUDIT SUMMARY');
    console.log('================');
    console.log(`Token Type: ${audit.tokenType.toUpperCase()}`);
    console.log(`Action Required: ${audit.tokenType === 'test' ? 'YES - Apply for production token' : 'NO - Token type investigation needed'}`);
    console.log(`Timeline: ${audit.tokenType === 'test' ? '24-48 hours after application' : 'Immediate investigation'}`);
    console.log(`Client Impact: ${audit.tokenType === 'test' ? 'Must apply for production access' : 'May need account requirement fixes'}`);

    // Save results
    const fs = require('fs');
    const results = {
      timestamp: new Date().toISOString(),
      tokenType: audit.tokenType,
      analysis: analysis,
      actionRequired: actions,
      needsProductionToken: audit.tokenType === 'test'
    };

    fs.writeFileSync('test-vs-production-token-audit.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved: test-vs-production-token-audit.json');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 