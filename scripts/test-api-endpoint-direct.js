#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testApiEndpointDirect() {
  console.log('🎯 TESTING GOOGLE ADS API ENDPOINT DIRECTLY');
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

    // Create a test request body
    const requestBody = {
      dateRange: {
        start: '2025-07-31',
        end: '2025-08-30'
      },
      clientId: client.id,
      forceFresh: false
    };

    console.log('📤 REQUEST DETAILS');
    console.log('==================');
    console.log('URL: http://localhost:3000/api/fetch-google-ads-live-data');
    console.log('Method: POST');
    console.log('Body:', JSON.stringify(requestBody, null, 2));
    console.log('');

    console.log('🚀 MAKING API CALL...');
    console.log('=====================');

    // Make the API call
    const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We'll skip auth for this test to isolate the issue
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response OK: ${response.ok}`);
    console.log('');

    // Get response body
    const responseText = await response.text();
    
    console.log('📄 RESPONSE BODY');
    console.log('================');
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log(JSON.stringify(responseJson, null, 2));
      
      if (!response.ok) {
        console.log('');
        console.log('🚨 ERROR ANALYSIS');
        console.log('=================');
        
        if (response.status === 401) {
          console.log('❌ 401 Unauthorized - Authentication issue');
          console.log('🔧 This is expected since we skipped auth in this test');
        } else if (response.status === 400) {
          console.log('❌ 400 Bad Request - Request validation issue');
          console.log('🔧 Error details:', responseJson.error || 'No error message');
        } else if (response.status === 500) {
          console.log('❌ 500 Internal Server Error - Server-side issue');
          console.log('🔧 Error details:', responseJson.error || 'No error message');
        }
      } else {
        console.log('');
        console.log('✅ API CALL SUCCESSFUL!');
        console.log('The 400 error might be resolved now.');
      }
    } catch (parseError) {
      console.log('Raw response (not JSON):');
      console.log(responseText);
      console.log('');
      console.log('🚨 RESPONSE PARSING ERROR');
      console.log('=========================');
      console.log('The server returned invalid JSON, indicating a server error.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🚨 CONNECTION REFUSED');
      console.log('=====================');
      console.log('The development server is not running.');
      console.log('Please start the server with: npm run dev');
      console.log('Then try refreshing the /reports page.');
    }
  }
}

testApiEndpointDirect();
