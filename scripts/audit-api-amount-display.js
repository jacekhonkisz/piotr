/**
 * Comprehensive API Amount Display Audit
 * Checks all places where API amounts should be displayed
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function auditApiAmountDisplay() {
  console.log('🔍 COMPREHENSIVE API AMOUNT DISPLAY AUDIT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // 1. Check what's actually in the cache
    console.log('📊 STEP 1: Verify cache data');
    const { data: cacheData } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('period_id', '2025-08')
      .single();

    if (cacheData) {
      console.log('✅ Cache exists with:');
      console.log(`   💰 Total Spend: ${cacheData.cache_data?.stats?.totalSpend} PLN`);
      console.log(`   👁️ Impressions: ${cacheData.cache_data?.stats?.totalImpressions}`);
      console.log(`   🖱️ Clicks: ${cacheData.cache_data?.stats?.totalClicks}`);
      console.log(`   🔄 Conversions: ${cacheData.cache_data?.stats?.totalConversions}`);
      console.log(`   📅 Updated: ${cacheData.last_updated}`);
    } else {
      console.log('❌ No cache data found!');
      return;
    }
    console.log('');

    // 2. Test API response directly
    console.log('📡 STEP 2: Test API response');
    try {
      const apiResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy-token-for-test'
        },
        body: JSON.stringify({
          clientId: BELMONTE_CLIENT_ID,
          dateRange: {
            start: '2025-08-01',
            end: '2025-08-30'
          },
          forceFresh: false
        })
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        console.log('✅ API Response received:');
        console.log(`   📊 Success: ${apiData.success}`);
        console.log(`   🔍 Source: ${apiData.debug?.source}`);
        console.log(`   💰 Stats in response: ${!!apiData.data?.stats}`);
        
        if (apiData.data?.stats) {
          console.log(`   💰 API Total Spend: ${apiData.data.stats.totalSpend} PLN`);
          console.log(`   👁️ API Impressions: ${apiData.data.stats.totalImpressions}`);
          console.log(`   🖱️ API Clicks: ${apiData.data.stats.totalClicks}`);
        } else {
          console.log('   ❌ No stats in API response!');
          console.log('   📋 Response structure:', Object.keys(apiData.data || {}));
        }
      } else {
        console.log(`❌ API call failed: ${apiResponse.status} ${apiResponse.statusText}`);
      }
    } catch (apiError) {
      console.log('❌ API test failed:', apiError.message);
    }
    console.log('');

    // 3. Check dashboard component structure
    console.log('🔍 STEP 3: Audit dashboard component');
    
    const dashboardPath = 'src/app/dashboard/page.tsx';
    const dashboardContent = await fs.readFile(dashboardPath, 'utf8');
    
    // Check for key display patterns
    const patterns = {
      'Stats usage': /monthData\.data\?\.stats/g,
      'Campaign calculation': /campaigns\.reduce.*sum.*spend/g,
      'MetaPerformanceLive props': /sharedData=\{[\s\S]*?\}/g,
      'formatCurrency calls': /formatCurrency\([^)]+\)/g,
      'Console logging stats': /console\.log.*stats/g
    };

    console.log('📋 Dashboard component patterns found:');
    for (const [name, pattern] of Object.entries(patterns)) {
      const matches = dashboardContent.match(pattern);
      console.log(`   ${matches ? '✅' : '❌'} ${name}: ${matches ? matches.length : 0} occurrences`);
      if (matches && matches.length > 0) {
        console.log(`      Examples: ${matches.slice(0, 2).join(', ').substring(0, 100)}...`);
      }
    }
    console.log('');

    // 4. Check MetaPerformanceLive component
    console.log('🔍 STEP 4: Audit MetaPerformanceLive component');
    
    const metaPerformancePath = 'src/components/MetaPerformanceLive.tsx';
    const metaContent = await fs.readFile(metaPerformancePath, 'utf8');
    
    const metaPatterns = {
      'SharedData usage': /sharedData.*stats/g,
      'Stats state setting': /setStats\(/g,
      'Format currency': /formatCurrency\(/g,
      'Stats totalSpend usage': /stats\.totalSpend/g,
      'Safe conversion function': /safeConversion/g
    };

    console.log('📋 MetaPerformanceLive patterns found:');
    for (const [name, pattern] of Object.entries(metaPatterns)) {
      const matches = metaContent.match(pattern);
      console.log(`   ${matches ? '✅' : '❌'} ${name}: ${matches ? matches.length : 0} occurrences`);
    }
    console.log('');

    // 5. Check for common display issues
    console.log('🔍 STEP 5: Check for common display issues');
    
    const issues = [];
    
    // Check if dashboard is still calculating from campaigns
    if (dashboardContent.includes('campaigns.reduce((sum: number, campaign: any) => sum + (campaign.spend || 0), 0)')) {
      issues.push('Dashboard still calculating spend from campaigns instead of using cached stats');
    }
    
    // Check if MetaPerformanceLive is properly using sharedData
    if (!metaContent.includes('sharedData.stats')) {
      issues.push('MetaPerformanceLive not properly accessing sharedData.stats');
    }
    
    // Check if proper stats are being passed
    if (!dashboardContent.includes('stats: stats,')) {
      issues.push('Dashboard not properly passing stats to MetaPerformanceLive');
    }

    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ No obvious code issues found');
    }
    console.log('');

    // 6. Summary and recommendations
    console.log('🎯 SUMMARY & NEXT STEPS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (cacheData?.cache_data?.stats?.totalSpend > 0) {
      console.log('✅ Cache has correct data (14,033 PLN)');
      
      console.log('');
      console.log('🔧 DEBUGGING STEPS:');
      console.log('1. Open browser dev tools (F12)');
      console.log('2. Go to Console tab');
      console.log('3. Refresh dashboard page');
      console.log('4. Look for these logs:');
      console.log('   - "✅ Using cached stats directly:"');
      console.log('   - "📊 Dashboard data received:"');
      console.log('   - Any error messages');
      console.log('');
      console.log('5. If you see errors or wrong data, share the console output');
    } else {
      console.log('❌ Cache data is missing or incorrect');
      console.log('🔧 Need to refresh cache data first');
    }

  } catch (error) {
    console.error('💥 ERROR in audit:', error);
    console.error('Stack:', error.stack);
  }
}

// Run audit
if (require.main === module) {
  auditApiAmountDisplay();
}

module.exports = { auditApiAmountDisplay }; 