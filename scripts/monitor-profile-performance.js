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

async function monitorProfilePerformance() {
  console.log('📊 Starting profile performance monitoring...\n');

  try {
    // Test 1: Session retrieval performance
    console.log('🔍 Test 1: Session retrieval performance');
    const sessionStart = performance.now();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionTime = performance.now() - sessionStart;
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    console.log(`✅ Session retrieved in ${sessionTime.toFixed(2)}ms`);
    
    if (!session?.user) {
      console.log('⚠️ No user session found, cannot test profile loading');
      console.log('💡 Try logging in first to test profile performance');
      return;
    }

    console.log(`👤 User: ${session.user.email}`);
    console.log(`🆔 User ID: ${session.user.id}\n`);

    // Test 2: Profile query performance (multiple iterations)
    console.log('🔍 Test 2: Profile query performance (5 iterations)');
    const profileTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const profileStart = performance.now();
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      const profileTime = performance.now() - profileStart;
      profileTimes.push(profileTime);
      
      if (profileError) {
        console.error(`❌ Profile query ${i + 1} failed:`, profileError.message);
      } else {
        console.log(`✅ Profile query ${i + 1}: ${profileTime.toFixed(2)}ms`);
        console.log(`   Role: ${profile.role}, Name: ${profile.full_name}`);
      }
      
      // Small delay between queries
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate statistics
    const avgTime = profileTimes.reduce((a, b) => a + b, 0) / profileTimes.length;
    const minTime = Math.min(...profileTimes);
    const maxTime = Math.max(...profileTimes);
    const variance = profileTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / profileTimes.length;
    const stdDev = Math.sqrt(variance);

    console.log('\n📈 Performance Statistics:');
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime.toFixed(2)}ms`);
    console.log(`   Max: ${maxTime.toFixed(2)}ms`);
    console.log(`   Standard Deviation: ${stdDev.toFixed(2)}ms`);
    console.log(`   Variance: ${(maxTime - minTime).toFixed(2)}ms`);

    // Performance assessment
    console.log('\n🎯 Performance Assessment:');
    
    if (avgTime < 100) {
      console.log('   🟢 EXCELLENT: Profile loading is very fast');
    } else if (avgTime < 200) {
      console.log('   🟡 GOOD: Profile loading is acceptable');
    } else if (avgTime < 500) {
      console.log('   🟠 FAIR: Profile loading is slow but tolerable');
    } else {
      console.log('   🔴 POOR: Profile loading is too slow');
    }

    if (stdDev < 50) {
      console.log('   🟢 CONSISTENT: Query times are stable');
    } else if (stdDev < 100) {
      console.log('   🟡 VARIABLE: Query times have some variation');
    } else {
      console.log('   🔴 UNSTABLE: Query times are highly variable');
    }

    // Test 3: Cache effectiveness
    console.log('\n🔍 Test 3: Cache effectiveness test');
    
    // First query (cache miss)
    const cacheMissStart = performance.now();
    const { data: profile1, error: error1 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    const cacheMissTime = performance.now() - cacheMissStart;
    
    if (error1) {
      console.error('❌ Cache miss query failed:', error1.message);
    } else {
      console.log(`✅ Cache miss query: ${cacheMissTime.toFixed(2)}ms`);
    }

    // Second query (potential cache hit)
    const cacheHitStart = performance.now();
    const { data: profile2, error: error2 } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    const cacheHitTime = performance.now() - cacheHitStart;
    
    if (error2) {
      console.error('❌ Cache hit query failed:', error2.message);
    } else {
      console.log(`✅ Cache hit query: ${cacheHitTime.toFixed(2)}ms`);
    }

    const cacheImprovement = ((cacheMissTime - cacheHitTime) / cacheMissTime) * 100;
    console.log(`📊 Cache improvement: ${cacheImprovement.toFixed(1)}%`);

    // Test 4: Database statistics
    console.log('\n🔍 Test 4: Database statistics');
    try {
      const { data: stats, error: statsError } = await supabase
        .rpc('get_profile_stats');
      
      if (statsError) {
        console.error('❌ Failed to get database stats:', statsError.message);
      } else if (stats && stats.length > 0) {
        const stat = stats[0];
        console.log('📊 Database Statistics:');
        console.log(`   Total profiles: ${stat.total_profiles}`);
        console.log(`   Active profiles: ${stat.active_profiles}`);
        console.log(`   Admin users: ${stat.admin_count}`);
        console.log(`   Client users: ${stat.client_count}`);
        console.log(`   Average profile size: ${stat.avg_profile_size}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch database statistics:', error.message);
    }

    // Test 5: Index performance
    console.log('\n🔍 Test 5: Index performance');
    try {
      const { data: indexStats, error: indexError } = await supabase
        .rpc('analyze_profiles_performance');
      
      if (indexError) {
        console.error('❌ Failed to get index stats:', indexError.message);
      } else if (indexStats && indexStats.length > 0) {
        console.log('📊 Index Statistics:');
        indexStats.forEach(index => {
          console.log(`   ${index.index_name}: ${index.index_size} (${index.index_usage_count} reads)`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch index statistics:', error.message);
    }

    // Recommendations
    console.log('\n💡 Performance Recommendations:');
    
    if (avgTime > 200) {
      console.log('   ⚠️ Profile queries are slow (>200ms)');
      console.log('      - Check database indexes');
      console.log('      - Consider implementing better caching');
      console.log('      - Monitor database performance');
    }
    
    if (stdDev > 100) {
      console.log('   ⚠️ Query times are inconsistent');
      console.log('      - Check for connection pooling issues');
      console.log('      - Monitor database load');
      console.log('      - Consider implementing request deduplication');
    }
    
    if (cacheImprovement < 20) {
      console.log('   ⚠️ Cache effectiveness is low');
      console.log('      - Check cache implementation');
      console.log('      - Verify cache invalidation strategy');
      console.log('      - Consider increasing cache duration');
    }

    console.log('\n✅ Profile performance monitoring completed');

  } catch (error) {
    console.error('❌ Monitoring failed:', error);
  }
}

// Run the monitoring
monitorProfilePerformance()
  .then(() => {
    console.log('\n🎉 Performance monitoring completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Monitoring failed:', error);
    process.exit(1);
  }); 