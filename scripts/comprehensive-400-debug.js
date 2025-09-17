#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensive400Debug() {
  console.log('🔍 COMPREHENSIVE 400 ERROR DEBUG - ROOT CAUSE ANALYSIS');
  console.log('======================================================\n');

  try {
    // 1. Test the exact API call that's failing
    console.log('1️⃣ TESTING EXACT API CALL');
    console.log('=========================');
    
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    console.log(`✅ Client: ${client.name} (${client.id})`);

    // Create the exact request that the browser is making
    const requestBody = {
      dateRange: {
        start: '2025-08-01',
        end: '2025-08-27'
      },
      clientId: client.id,
      forceFresh: true
    };

    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('');

    // 2. Test authentication
    console.log('2️⃣ TESTING AUTHENTICATION');
    console.log('==========================');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('❌ No active session - this could be the issue');
      console.log('The browser needs to be logged in to make API calls');
      return;
    }

    console.log('✅ Active session found');
    console.log(`User: ${session.user.email}`);
    console.log('');

    // 3. Test the API endpoint directly
    console.log('3️⃣ TESTING API ENDPOINT DIRECTLY');
    console.log('=================================');
    
    try {
      const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`📡 Response Headers:`, Object.fromEntries(response.headers.entries()));
      console.log('');

      const responseText = await response.text();
      
      try {
        const responseJson = JSON.parse(responseText);
        console.log('📄 Response Body (JSON):');
        console.log(JSON.stringify(responseJson, null, 2));
        
        if (response.status === 400) {
          console.log('');
          console.log('🚨 400 ERROR ANALYSIS');
          console.log('=====================');
          console.log(`Error: ${responseJson.error || 'No error message'}`);
          console.log(`Success: ${responseJson.success}`);
          
          if (responseJson.debug) {
            console.log('Debug info:', responseJson.debug);
          }
        }
      } catch (parseError) {
        console.log('📄 Response Body (Raw):');
        console.log(responseText);
        console.log('');
        console.log('❌ Response is not valid JSON - this indicates a server error');
      }

    } catch (fetchError) {
      console.log('❌ Fetch failed:', fetchError.message);
      
      if (fetchError.code === 'ECONNREFUSED') {
        console.log('🚨 Server is not running on port 3000');
      }
    }

    console.log('');

    // 4. Test individual components
    console.log('4️⃣ TESTING INDIVIDUAL COMPONENTS');
    console.log('=================================');
    
    // Test Google Ads API service directly
    console.log('Testing Google Ads API service...');
    
    try {
      // Get system settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'google_ads_client_id',
          'google_ads_client_secret',
          'google_ads_developer_token',
          'google_ads_manager_refresh_token'
        ]);

      const creds = {};
      settings?.forEach(setting => {
        creds[setting.key] = setting.value;
      });

      console.log('✅ System settings retrieved');
      console.log(`Has all credentials: ${Object.keys(creds).length === 4 ? 'YES' : 'NO'}`);

      // Test if we can import the Google Ads service
      try {
        const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
        console.log('✅ Google Ads API service can be imported');
        
        const googleAdsCredentials = {
          refreshToken: creds.google_ads_manager_refresh_token,
          clientId: creds.google_ads_client_id,
          clientSecret: creds.google_ads_client_secret,
          developmentToken: creds.google_ads_developer_token,
          customerId: client.google_ads_customer_id,
        };

        const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
        console.log('✅ Google Ads API service instantiated');

        // Test credentials validation
        try {
          const validation = await googleAdsService.validateCredentials();
          console.log(`✅ Credentials validation: ${validation.valid ? 'VALID' : 'INVALID'}`);
          if (!validation.valid) {
            console.log(`❌ Validation error: ${validation.error}`);
          }
        } catch (validationError) {
          console.log(`❌ Credentials validation failed: ${validationError.message}`);
        }

      } catch (importError) {
        console.log(`❌ Cannot import Google Ads API service: ${importError.message}`);
      }

    } catch (settingsError) {
      console.log(`❌ Cannot get system settings: ${settingsError.message}`);
    }

    console.log('');

    // 5. Check for common issues
    console.log('5️⃣ CHECKING COMMON ISSUES');
    console.log('==========================');
    
    const issues = [];
    
    // Check if the API route file exists
    const fs = require('fs');
    const path = require('path');
    
    try {
      const apiFile = path.join(__dirname, '../src/app/api/fetch-google-ads-live-data/route.ts');
      const content = fs.readFileSync(apiFile, 'utf8');
      console.log('✅ API route file exists');
      
      // Check for syntax errors
      if (content.includes('export async function POST')) {
        console.log('✅ POST function exported');
      } else {
        issues.push('❌ POST function not found in API route');
      }
      
    } catch (fileError) {
      issues.push(`❌ API route file error: ${fileError.message}`);
    }

    // Check middleware
    try {
      const middlewareFile = path.join(__dirname, '../src/lib/auth-middleware.ts');
      if (fs.existsSync(middlewareFile)) {
        console.log('✅ Auth middleware exists');
      } else {
        issues.push('❌ Auth middleware file missing');
      }
    } catch (middlewareError) {
      issues.push(`❌ Middleware check failed: ${middlewareError.message}`);
    }

    console.log('');

    // 6. Summary and recommendations
    console.log('6️⃣ SUMMARY AND RECOMMENDATIONS');
    console.log('===============================');
    
    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ No obvious structural issues found');
    }

    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('==============');
    console.log('1. Check the server console for detailed error logs');
    console.log('2. Look for any compilation errors in the terminal');
    console.log('3. Verify the API route is being reached');
    console.log('4. Check if there are any middleware issues');
    console.log('5. Test with a simpler API endpoint first');

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

comprehensive400Debug();
