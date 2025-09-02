const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGoogleAdsAPIDirect() {
  console.log('🧪 Testing Google Ads API directly...\n');
  
  try {
    console.log('🔍 Step 1: Testing basic API health...');
    
    const healthResponse = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (healthResponse.ok) {
      console.log('✅ API server is responsive');
    } else {
      console.log('❌ API server health check failed:', healthResponse.status);
      return;
    }
    
    console.log('\n🔍 Step 2: Getting admin token...');
    
    // Get admin user token
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    if (authError || !user) {
      console.log('❌ Failed to authenticate admin user:', authError);
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.log('❌ No access token available');
      return;
    }
    
    console.log('✅ Admin authenticated successfully');
    
    console.log('\n🔍 Step 3: Testing Google Ads API with timeout...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ Request timed out after 30 seconds');
      controller.abort();
    }, 30000);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
          dateRange: {
            start: '2025-09-01',
            end: '2025-09-01'
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📊 Response received after ${duration}ms`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API call successful!');
        console.log('📊 Response data keys:', Object.keys(data));
        
        if (data.data?.googleAdsTables) {
          console.log('📊 Google Ads Tables:', Object.keys(data.data.googleAdsTables));
        }
      } else {
        const errorText = await response.text();
        console.log('❌ API call failed:', errorText);
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (fetchError.name === 'AbortError') {
        console.log(`❌ Request was aborted after ${duration}ms (timeout)`);
      } else {
        console.log(`❌ Fetch error after ${duration}ms:`, fetchError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGoogleAdsAPIDirect().catch(console.error);