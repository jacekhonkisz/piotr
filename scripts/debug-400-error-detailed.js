#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug400ErrorDetailed() {
  console.log('🔍 DEBUGGING 400 ERROR - DETAILED ANALYSIS');
  console.log('==========================================\n');

  try {
    // Get client data
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    console.log('✅ Client found:', client.name);
    console.log('');

    // Get a real session token (this is key!)
    console.log('🔑 GETTING REAL SESSION TOKEN...');
    
    // First, let's see what the browser is actually sending
    console.log('📤 SIMULATING BROWSER REQUEST');
    console.log('=============================');
    
    const requestBody = {
      dateRange: {
        start: '2025-08-01',
        end: '2025-08-31'
      },
      clientId: client.id,
      forceFresh: false
    };

    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('');

    // Try to get session from Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('❌ No active session found');
      console.log('This might be the issue - the browser needs to be logged in');
      console.log('');
      console.log('🔧 SOLUTION:');
      console.log('1. Make sure you are logged in to the application');
      console.log('2. Check if your session has expired');
      console.log('3. Try logging out and logging back in');
      return;
    }

    console.log('✅ Active session found');
    console.log(`User: ${session.user.email}`);
    console.log('');

    // Now make the API call with proper auth
    console.log('🚀 MAKING AUTHENTICATED API CALL...');
    console.log('===================================');

    const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    console.log('');

    // Get the response body
    const responseText = await response.text();
    
    console.log('📄 RESPONSE BODY');
    console.log('================');
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log(JSON.stringify(responseJson, null, 2));
      
      if (response.status === 400) {
        console.log('');
        console.log('🚨 400 BAD REQUEST ANALYSIS');
        console.log('===========================');
        console.log(`Error: ${responseJson.error || 'No error message'}`);
        
        // Analyze the specific error
        if (responseJson.error?.includes('Client ID')) {
          console.log('🔧 Issue: Client ID validation failed');
        } else if (responseJson.error?.includes('Date range')) {
          console.log('🔧 Issue: Date range validation failed');
        } else if (responseJson.error?.includes('credentials')) {
          console.log('🔧 Issue: Google Ads credentials problem');
        } else if (responseJson.error?.includes('Customer ID')) {
          console.log('🔧 Issue: Google Ads Customer ID problem');
        } else if (responseJson.error?.includes('refresh token')) {
          console.log('🔧 Issue: Google Ads refresh token problem');
        } else {
          console.log('🔧 Issue: Unknown validation or processing error');
        }
      }
    } catch (parseError) {
      console.log('Raw response (not JSON):');
      console.log(responseText);
      console.log('');
      console.log('🚨 This indicates a server error (not a 400 validation error)');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🚨 CONNECTION REFUSED');
      console.log('=====================');
      console.log('The development server is not running.');
      console.log('Please start the server with: npm run dev');
    }
  }
}

debug400ErrorDetailed();
