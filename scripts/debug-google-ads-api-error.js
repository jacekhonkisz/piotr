#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugGoogleAdsApiError() {
  console.log('🔍 DEBUGGING GOOGLE ADS API 400 ERROR');
  console.log('====================================\n');

  try {
    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError || !client) {
      console.log('❌ Client not found:', clientError);
      return;
    }

    console.log('🏨 CLIENT VALIDATION');
    console.log('===================');
    console.log(`✅ Client ID: ${client.id}`);
    console.log(`✅ Client Name: ${client.name}`);
    console.log(`✅ Client Email: ${client.email}`);
    console.log(`${client.google_ads_customer_id ? '✅' : '❌'} Google Ads Customer ID: ${client.google_ads_customer_id || 'NOT SET'}`);
    console.log(`${client.google_ads_refresh_token ? '✅' : '❌'} Client Refresh Token: ${client.google_ads_refresh_token ? 'SET' : 'NOT SET'}`);
    console.log('');

    // Check system settings
    console.log('🔧 SYSTEM SETTINGS VALIDATION');
    console.log('=============================');
    
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    if (settingsError) {
      console.log('❌ Settings error:', settingsError);
      return;
    }

    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });

    console.log(`${creds.google_ads_client_id ? '✅' : '❌'} Client ID: ${creds.google_ads_client_id ? 'SET' : 'NOT SET'}`);
    console.log(`${creds.google_ads_client_secret ? '✅' : '❌'} Client Secret: ${creds.google_ads_client_secret ? 'SET' : 'NOT SET'}`);
    console.log(`${creds.google_ads_developer_token ? '✅' : '❌'} Developer Token: ${creds.google_ads_developer_token ? 'SET' : 'NOT SET'}`);
    console.log(`${creds.google_ads_manager_refresh_token ? '✅' : '❌'} Manager Refresh Token: ${creds.google_ads_manager_refresh_token ? 'SET' : 'NOT SET'}`);
    console.log('');

    // Check which refresh token would be used
    const refreshToken = creds.google_ads_manager_refresh_token || client.google_ads_refresh_token;
    console.log('🔑 REFRESH TOKEN SELECTION');
    console.log('==========================');
    console.log(`Selected Token: ${refreshToken ? 'AVAILABLE' : 'MISSING'}`);
    console.log(`Source: ${creds.google_ads_manager_refresh_token ? 'Manager Token' : 'Client Token'}`);
    console.log('');

    // Validate required fields for API call
    console.log('📋 API CALL REQUIREMENTS');
    console.log('========================');
    
    const missingFields = [];
    if (!client.id) missingFields.push('Client ID');
    if (!client.google_ads_customer_id) missingFields.push('Google Ads Customer ID');
    if (!refreshToken) missingFields.push('Refresh Token');
    if (!creds.google_ads_client_id) missingFields.push('OAuth Client ID');
    if (!creds.google_ads_client_secret) missingFields.push('OAuth Client Secret');
    if (!creds.google_ads_developer_token) missingFields.push('Developer Token');

    if (missingFields.length > 0) {
      console.log('❌ MISSING REQUIRED FIELDS:');
      missingFields.forEach(field => console.log(`   • ${field}`));
      console.log('');
      console.log('🔧 LIKELY CAUSE OF 400 ERROR:');
      console.log('One or more required fields are missing for the Google Ads API call.');
    } else {
      console.log('✅ All required fields are present');
    }
    console.log('');

    // Check date range format
    console.log('📅 DATE RANGE VALIDATION');
    console.log('=======================');
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = monthEnd.toISOString().split('T')[0];
    
    console.log(`Start Date: ${startDate}`);
    console.log(`End Date: ${endDate}`);
    console.log(`Format: ${/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? '✅ Valid' : '❌ Invalid'}`);
    console.log('');

    // Test the table existence
    console.log('🗄️ DATABASE TABLE CHECK');
    console.log('=======================');
    
    try {
      const { data: tableTest, error: tableError } = await supabase
        .from('google_ads_campaign_summaries')
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.log('❌ google_ads_campaign_summaries table error:', tableError.message);
        console.log('🔧 LIKELY CAUSE: Database table does not exist');
      } else {
        console.log('✅ google_ads_campaign_summaries table exists');
      }
    } catch (error) {
      console.log('❌ Database connection error:', error.message);
    }
    console.log('');

    // Simulate the API request body
    console.log('📤 SIMULATED API REQUEST');
    console.log('=======================');
    
    const requestBody = {
      dateRange: {
        start: startDate,
        end: endDate
      },
      clientId: client.id,
      forceFresh: false
    };
    
    console.log('Request Body:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('');

    // Check for potential issues
    console.log('🚨 POTENTIAL ISSUES ANALYSIS');
    console.log('============================');
    
    const issues = [];
    
    if (!client.google_ads_customer_id) {
      issues.push('Google Ads Customer ID is missing from client record');
    }
    
    if (!refreshToken) {
      issues.push('No refresh token available (neither manager nor client token)');
    }
    
    if (client.google_ads_customer_id && !client.google_ads_customer_id.includes('-')) {
      issues.push('Customer ID format may be incorrect (should be XXX-XXX-XXXX)');
    }
    
    if (issues.length > 0) {
      console.log('❌ IDENTIFIED ISSUES:');
      issues.forEach((issue, index) => console.log(`   ${index + 1}. ${issue}`));
    } else {
      console.log('✅ No obvious configuration issues found');
    }
    console.log('');

    console.log('🔧 RECOMMENDED FIXES');
    console.log('====================');
    
    if (missingFields.length > 0) {
      console.log('1. Fix missing configuration fields:');
      missingFields.forEach(field => console.log(`   • Set up ${field}`));
    }
    
    console.log('2. Check server logs for detailed error message');
    console.log('3. Verify Google Ads API credentials are valid');
    console.log('4. Ensure database tables exist');
    console.log('5. Test API call with curl or Postman');
    console.log('');
    
    console.log('💡 NEXT STEPS:');
    console.log('1. Check the server console for detailed error logs');
    console.log('2. Verify all Google Ads credentials are correctly configured');
    console.log('3. Test the Google Ads API connection independently');

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

debugGoogleAdsApiError();
