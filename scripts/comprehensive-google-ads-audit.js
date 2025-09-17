#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensiveGoogleAdsAudit() {
  console.log('🔍 COMPREHENSIVE GOOGLE ADS SYSTEM AUDIT');
  console.log('========================================\n');

  const issues = [];
  const fixes = [];

  try {
    // 1. Database Tables Audit
    console.log('1️⃣ DATABASE TABLES AUDIT');
    console.log('========================');
    
    // Check google_ads_campaign_summaries
    try {
      const { data: summariesData, error: summariesError } = await supabase
        .from('google_ads_campaign_summaries')
        .select('id')
        .limit(1);
      
      if (summariesError) {
        if (summariesError.code === '42P01') {
          issues.push('❌ google_ads_campaign_summaries table does not exist');
          fixes.push('Create google_ads_campaign_summaries table');
        } else {
          issues.push(`❌ google_ads_campaign_summaries error: ${summariesError.message}`);
        }
      } else {
        console.log('✅ google_ads_campaign_summaries table exists');
      }
    } catch (error) {
      issues.push(`❌ google_ads_campaign_summaries access error: ${error.message}`);
    }

    // Check google_ads_tables_data
    try {
      const { data: tablesData, error: tablesError } = await supabase
        .from('google_ads_tables_data')
        .select('id')
        .limit(1);
      
      if (tablesError) {
        if (tablesError.code === '42P01') {
          issues.push('❌ google_ads_tables_data table does not exist');
          fixes.push('Create google_ads_tables_data table');
        } else {
          issues.push(`❌ google_ads_tables_data error: ${tablesError.message}`);
        }
      } else {
        console.log('✅ google_ads_tables_data table exists');
      }
    } catch (error) {
      issues.push(`❌ google_ads_tables_data access error: ${error.message}`);
    }

    console.log('');

    // 2. System Settings Audit
    console.log('2️⃣ SYSTEM SETTINGS AUDIT');
    console.log('=========================');
    
    const requiredSettings = [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token'
    ];

    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', requiredSettings);

    if (settingsError) {
      issues.push(`❌ System settings error: ${settingsError.message}`);
    } else {
      const foundSettings = settings.map(s => s.key);
      const missingSettings = requiredSettings.filter(key => !foundSettings.includes(key));
      
      foundSettings.forEach(key => {
        const setting = settings.find(s => s.key === key);
        if (setting.value) {
          console.log(`✅ ${key}: SET`);
        } else {
          console.log(`❌ ${key}: EMPTY`);
          issues.push(`❌ ${key} is empty`);
          fixes.push(`Set ${key} value`);
        }
      });

      missingSettings.forEach(key => {
        console.log(`❌ ${key}: MISSING`);
        issues.push(`❌ ${key} is missing`);
        fixes.push(`Add ${key} to system_settings`);
      });
    }

    console.log('');

    // 3. Client Configuration Audit
    console.log('3️⃣ CLIENT CONFIGURATION AUDIT');
    console.log('==============================');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError) {
      issues.push(`❌ Client error: ${clientError.message}`);
    } else {
      console.log(`✅ Client found: ${client.name}`);
      
      if (client.google_ads_customer_id) {
        console.log(`✅ Google Ads Customer ID: ${client.google_ads_customer_id}`);
        
        // Validate format
        if (!/^\d{3}-\d{3}-\d{4}$/.test(client.google_ads_customer_id)) {
          issues.push('❌ Google Ads Customer ID format invalid (should be XXX-XXX-XXXX)');
          fixes.push('Fix Google Ads Customer ID format');
        }
      } else {
        issues.push('❌ Google Ads Customer ID missing');
        fixes.push('Set Google Ads Customer ID for client');
      }

      if (client.google_ads_refresh_token) {
        console.log('✅ Client refresh token: SET');
      } else {
        console.log('⚠️ Client refresh token: MISSING (using manager token)');
      }
    }

    console.log('');

    // 4. API Route Structure Audit
    console.log('4️⃣ API ROUTE STRUCTURE AUDIT');
    console.log('=============================');
    
    const fs = require('fs');
    const path = require('path');
    
    try {
      const apiFile = path.join(__dirname, '../src/app/api/fetch-google-ads-live-data/route.ts');
      const content = fs.readFileSync(apiFile, 'utf8');
      
      // Check for essential components
      const hasErrorHandling = content.includes('try {') && content.includes('catch');
      const hasValidation = content.includes('validateCredentials');
      const hasLogging = content.includes('console.log');
      const hasBypass = content.includes('if (false &&');
      
      console.log(`Error handling: ${hasErrorHandling ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`Credentials validation: ${hasValidation ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`Debug logging: ${hasLogging ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`Database bypass: ${hasBypass ? '⚠️ ACTIVE (TEMPORARY)' : '✅ NORMAL'}`);
      
      if (hasBypass) {
        issues.push('⚠️ Database bypass is active (temporary fix)');
        fixes.push('Remove database bypass and fix underlying database issues');
      }
      
    } catch (error) {
      issues.push(`❌ API route file error: ${error.message}`);
    }

    console.log('');

    // 5. Google Ads API Service Audit
    console.log('5️⃣ GOOGLE ADS API SERVICE AUDIT');
    console.log('================================');
    
    try {
      const serviceFile = path.join(__dirname, '../src/lib/google-ads-api.ts');
      const serviceContent = fs.readFileSync(serviceFile, 'utf8');
      
      const hasValidateCredentials = serviceContent.includes('validateCredentials');
      const hasGetCampaignData = serviceContent.includes('getCampaignData');
      const hasErrorHandling = serviceContent.includes('try {') && serviceContent.includes('catch');
      
      console.log(`validateCredentials method: ${hasValidateCredentials ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`getCampaignData method: ${hasGetCampaignData ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`Error handling: ${hasErrorHandling ? '✅ PRESENT' : '❌ MISSING'}`);
      
    } catch (error) {
      issues.push(`❌ Google Ads API service error: ${error.message}`);
    }

    console.log('');

    // 6. Summary and Action Plan
    console.log('📋 AUDIT SUMMARY');
    console.log('================');
    
    if (issues.length === 0) {
      console.log('✅ No issues found! System should be working.');
    } else {
      console.log(`❌ Found ${issues.length} issues:`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    console.log('');
    console.log('🔧 REQUIRED FIXES');
    console.log('=================');
    
    if (fixes.length === 0) {
      console.log('✅ No fixes required!');
    } else {
      fixes.forEach((fix, index) => {
        console.log(`   ${index + 1}. ${fix}`);
      });
    }

    console.log('');
    console.log('🎯 PRODUCTION-READY ACTION PLAN');
    console.log('===============================');
    
    return { issues, fixes };
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    return { issues: [`Audit failed: ${error.message}`], fixes: ['Fix audit script'] };
  }
}

comprehensiveGoogleAdsAudit().then(({ issues, fixes }) => {
  console.log('1. Create missing database tables');
  console.log('2. Verify all system settings are configured');
  console.log('3. Remove temporary bypasses');
  console.log('4. Add proper error handling and fallbacks');
  console.log('5. Test with real Google Ads API calls');
  console.log('6. Implement proper caching and database storage');
  console.log('');
  console.log('💡 This will create a robust, production-ready Google Ads integration!');
});