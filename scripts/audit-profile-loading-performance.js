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

async function auditProfileLoadingPerformance() {
  console.log('🔍 Starting profile loading performance audit...\n');

  // Test 1: Session retrieval performance
  console.log('📊 Test 1: Session retrieval performance');
  const sessionStart = performance.now();
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    const sessionTime = performance.now() - sessionStart;
    
    if (error) {
      console.error('❌ Session error:', error);
      return;
    }
    
    console.log(`✅ Session retrieved in ${sessionTime.toFixed(2)}ms`);
    console.log(`   User: ${session?.user?.email || 'No user'}`);
    console.log(`   User ID: ${session?.user?.id || 'No ID'}\n`);
    
    if (!session?.user) {
      console.log('⚠️ No user session found, cannot test profile loading');
      return;
    }

    // Test 2: Direct profile query performance
    console.log('📊 Test 2: Direct profile query performance');
    const profileStart = performance.now();
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    const profileTime = performance.now() - profileStart;
    
    if (profileError) {
      console.error('❌ Profile query error:', profileError);
      console.error('Error details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      });
    } else {
      console.log(`✅ Profile retrieved in ${profileTime.toFixed(2)}ms`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Name: ${profile.full_name}`);
      console.log(`   Email: ${profile.email}\n`);
    }

    // Test 3: Multiple profile queries to test caching
    console.log('📊 Test 3: Multiple profile queries (caching test)');
    const times = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      const time = performance.now() - start;
      times.push(time);
      
      if (error) {
        console.error(`❌ Query ${i + 1} failed:`, error.message);
      } else {
        console.log(`✅ Query ${i + 1}: ${time.toFixed(2)}ms`);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`\n📈 Performance Summary:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime.toFixed(2)}ms`);
    console.log(`   Max: ${maxTime.toFixed(2)}ms`);
    console.log(`   Variance: ${(maxTime - minTime).toFixed(2)}ms\n`);

    // Test 4: Network latency test
    console.log('📊 Test 4: Network latency test');
    const networkStart = performance.now();
    
    // Simple ping to Supabase
    const { data: pingData, error: pingError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    const networkTime = performance.now() - networkStart;
    
    if (pingError) {
      console.error('❌ Network test failed:', pingError.message);
    } else {
      console.log(`✅ Network latency: ${networkTime.toFixed(2)}ms\n`);
    }

    // Test 5: RLS policy performance impact
    console.log('📊 Test 5: RLS policy performance impact');
    const rlsStart = performance.now();
    
    // Test with RLS (normal query)
    const { data: rlsData, error: rlsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    const rlsTime = performance.now() - rlsStart;
    
    if (rlsError) {
      console.error('❌ RLS query failed:', rlsError.message);
    } else {
      console.log(`✅ RLS query completed in ${rlsTime.toFixed(2)}ms\n`);
    }

    // Performance recommendations
    console.log('💡 Performance Recommendations:');
    
    if (sessionTime > 100) {
      console.log('   ⚠️ Session retrieval is slow (>100ms)');
      console.log('      - Check Supabase connection');
      console.log('      - Consider implementing session caching');
    }
    
    if (profileTime > 200) {
      console.log('   ⚠️ Profile query is slow (>200ms)');
      console.log('      - Check database indexes');
      console.log('      - Consider implementing profile caching');
    }
    
    if (maxTime - minTime > 50) {
      console.log('   ⚠️ High query variance detected');
      console.log('      - Check for connection pooling issues');
      console.log('      - Consider implementing request deduplication');
    }
    
    if (networkTime > 150) {
      console.log('   ⚠️ High network latency detected');
      console.log('      - Check internet connection');
      console.log('      - Consider using a CDN or edge functions');
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the audit
auditProfileLoadingPerformance()
  .then(() => {
    console.log('\n✅ Profile loading performance audit completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }); 