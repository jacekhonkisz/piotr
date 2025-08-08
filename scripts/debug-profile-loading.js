const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugProfileLoading() {
  console.log('🔍 Starting detailed profile loading debug...\n');

  try {
    // Step 1: Test basic connection
    console.log('📡 Step 1: Testing Supabase connection');
    const connectionStart = performance.now();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      const connectionTime = performance.now() - connectionStart;
      
      if (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error details:', error);
        return;
      }
      
      console.log(`✅ Connection successful: ${connectionTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return;
    }

    // Step 2: Test session retrieval
    console.log('\n🔐 Step 2: Testing session retrieval');
    const sessionStart = performance.now();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionTime = performance.now() - sessionStart;
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    console.log(`✅ Session retrieved: ${sessionTime.toFixed(2)}ms`);
    console.log(`   User: ${session?.user?.email || 'No user'}`);
    console.log(`   User ID: ${session?.user?.id || 'No ID'}`);

    if (!session?.user) {
      console.log('\n⚠️ No user session found');
      console.log('💡 To test profile loading, you need to:');
      console.log('   1. Open the application in a browser');
      console.log('   2. Log in with a user account');
      console.log('   3. Run this script again');
      return;
    }

    // Step 3: Test profile query with detailed timing
    console.log('\n👤 Step 3: Testing profile query with detailed timing');
    
    // Test 1: Basic profile query
    console.log('   Testing basic profile query...');
    const basicStart = performance.now();
    
    const { data: profile1, error: error1 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    const basicTime = performance.now() - basicStart;
    
    if (error1) {
      console.error(`   ❌ Basic query failed: ${error1.message}`);
      console.error('   Error details:', error1);
    } else {
      console.log(`   ✅ Basic query: ${basicTime.toFixed(2)}ms`);
      console.log(`      Role: ${profile1.role}, Name: ${profile1.full_name}`);
    }

    // Test 2: Profile query with specific fields
    console.log('   Testing profile query with specific fields...');
    const specificStart = performance.now();
    
    const { data: profile2, error: error2 } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', session.user.id)
      .single();
    
    const specificTime = performance.now() - specificStart;
    
    if (error2) {
      console.error(`   ❌ Specific fields query failed: ${error2.message}`);
    } else {
      console.log(`   ✅ Specific fields query: ${specificTime.toFixed(2)}ms`);
    }

    // Test 3: Profile query with RLS policy
    console.log('   Testing profile query with RLS policy...');
    const rlsStart = performance.now();
    
    const { data: profile3, error: error3 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    const rlsTime = performance.now() - rlsStart;
    
    if (error3) {
      console.error(`   ❌ RLS query failed: ${error3.message}`);
    } else {
      console.log(`   ✅ RLS query: ${rlsTime.toFixed(2)}ms`);
    }

    // Step 4: Test network latency
    console.log('\n🌐 Step 4: Testing network latency');
    const networkTests = [];
    
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      const time = performance.now() - start;
      networkTests.push(time);
      
      if (error) {
        console.error(`   ❌ Network test ${i + 1} failed: ${error.message}`);
      } else {
        console.log(`   ✅ Network test ${i + 1}: ${time.toFixed(2)}ms`);
      }
      
      // Small delay between tests
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const avgNetworkTime = networkTests.reduce((a, b) => a + b, 0) / networkTests.length;
    console.log(`   📊 Average network latency: ${avgNetworkTime.toFixed(2)}ms`);

    // Step 5: Test database performance
    console.log('\n🗄️ Step 5: Testing database performance');
    
    // Test with different query patterns
    const queryPatterns = [
      { name: 'Primary key lookup', query: () => supabase.from('profiles').select('*').eq('id', session.user.id).single() },
      { name: 'Email lookup', query: () => supabase.from('profiles').select('*').eq('email', session.user.email).single() },
      { name: 'Role filter', query: () => supabase.from('profiles').select('*').eq('id', session.user.id).eq('role', 'client').single() }
    ];

    for (const pattern of queryPatterns) {
      const start = performance.now();
      
      try {
        const { data, error } = await pattern.query();
        const time = performance.now() - start;
        
        if (error) {
          console.error(`   ❌ ${pattern.name} failed: ${error.message}`);
        } else {
          console.log(`   ✅ ${pattern.name}: ${time.toFixed(2)}ms`);
        }
      } catch (error) {
        console.error(`   ❌ ${pattern.name} exception: ${error.message}`);
      }
    }

    // Step 6: Performance analysis
    console.log('\n📊 Step 6: Performance analysis');
    
    const times = [basicTime, specificTime, rlsTime, avgNetworkTime];
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    console.log(`   Average query time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Fastest query: ${minTime.toFixed(2)}ms`);
    console.log(`   Slowest query: ${maxTime.toFixed(2)}ms`);
    
    // Identify bottlenecks
    console.log('\n🔍 Bottleneck Analysis:');
    
    if (avgTime > 500) {
      console.log('   🔴 CRITICAL: Query times are very slow (>500ms)');
      console.log('      - Check database indexes');
      console.log('      - Verify network connection');
      console.log('      - Monitor database load');
    } else if (avgTime > 200) {
      console.log('   🟠 WARNING: Query times are slow (>200ms)');
      console.log('      - Consider adding database indexes');
      console.log('      - Check RLS policy performance');
    } else if (avgTime > 100) {
      console.log('   🟡 NOTICE: Query times are acceptable (>100ms)');
      console.log('      - Performance is within normal range');
    } else {
      console.log('   🟢 GOOD: Query times are fast (<100ms)');
      console.log('      - Performance is excellent');
    }

    if (maxTime - minTime > 100) {
      console.log('   ⚠️ High variance detected in query times');
      console.log('      - Check for connection pooling issues');
      console.log('      - Monitor database performance');
    }

    // Step 7: Recommendations
    console.log('\n💡 Recommendations:');
    
    if (avgTime > 200) {
      console.log('   1. Apply database migration to add indexes');
      console.log('   2. Check Supabase project performance');
      console.log('   3. Monitor database connection pool');
      console.log('   4. Consider implementing better caching');
    } else {
      console.log('   1. Performance is within acceptable range');
      console.log('   2. Monitor for performance degradation');
      console.log('   3. Consider implementing monitoring alerts');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugProfileLoading()
  .then(() => {
    console.log('\n✅ Profile loading debug completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  }); 