const { createClient } = require('@supabase/supabase-js');

// Test configuration
const SUPABASE_URL = 'https://xbklptrrfdspyvnjaojf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzEyODYsImV4cCI6MjA2ODk0NzI4Nn0.890DeNlTyqSGSqjb7LTRWTDVq--Phj8ZrMmfOvYiYPI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test user credentials (you'll need to provide real ones)
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

async function testProfileCaching() {
  console.log('🚀 Starting Profile Caching Test...\n');
  
  try {
    // Step 1: Sign in (this should trigger profile loading)
    console.log('📝 Step 1: Signing in user...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (signInError) {
      console.log('❌ Sign in failed:', signInError.message);
      console.log('💡 Please provide valid test credentials or create a test user first');
      return;
    }
    
    console.log('✅ Sign in successful for user:', signInData.user.email);
    
    // Step 2: First profile fetch (should be fresh)
    console.log('\n📊 Step 2: First profile fetch (should be fresh)...');
    const startTime1 = performance.now();
    
    const { data: profile1, error: profileError1 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signInData.user.id)
      .single();
    
    const fetchTime1 = performance.now() - startTime1;
    
    if (profileError1) {
      console.log('❌ First profile fetch failed:', profileError1.message);
      return;
    }
    
    console.log(`✅ First fetch completed in ${fetchTime1.toFixed(2)}ms`);
    console.log(`   Profile: ${profile1.email} (${profile1.role})`);
    
    // Step 3: Second profile fetch (should be cached)
    console.log('\n🔄 Step 3: Second profile fetch (should be cached)...');
    const startTime2 = performance.now();
    
    const { data: profile2, error: profileError2 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signInData.user.id)
      .single();
    
    const fetchTime2 = performance.now() - startTime2;
    
    if (profileError2) {
      console.log('❌ Second profile fetch failed:', profileError2.message);
      return;
    }
    
    console.log(`✅ Second fetch completed in ${fetchTime2.toFixed(2)}ms`);
    console.log(`   Profile: ${profile2.email} (${profile2.role})`);
    
    // Step 4: Analysis
    console.log('\n📈 Step 4: Cache Performance Analysis...');
    console.log(`   First fetch:  ${fetchTime1.toFixed(2)}ms (fresh data)`);
    console.log(`   Second fetch: ${fetchTime2.toFixed(2)}ms (cached data)`);
    
    if (fetchTime2 < fetchTime1) {
      const improvement = ((fetchTime1 - fetchTime2) / fetchTime1 * 100).toFixed(1);
      console.log(`   🚀 Performance improvement: ${improvement}% faster on second fetch`);
    } else {
      console.log(`   ⚠️  No performance improvement detected`);
    }
    
    // Step 5: Test cache invalidation
    console.log('\n🧪 Step 5: Testing cache behavior...');
    console.log('   Note: Supabase has built-in query caching that may affect results');
    console.log('   For true cache testing, use the integrated cache manager in your app');
    
    // Step 6: Check current cache status
    console.log('\n📊 Step 6: Current Cache Status...');
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_cache_performance_stats`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const cacheStats = await response.json();
        console.log('   Cache Status:');
        cacheStats.forEach(stat => {
          console.log(`     ${stat.cache_type}: ${stat.total_entries} entries (${stat.cache_status})`);
        });
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch cache stats:', error.message);
    }
    
    console.log('\n🎯 Test completed!');
    console.log('💡 To see true caching behavior, check your browser console during login');
    console.log('   The optimized auth system logs cache hits vs fresh fetches');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testProfileCaching(); 