/**
 * Test API Response Structure
 * Verify exactly what the API is returning
 */

const fs = require('fs').promises;

async function testApiResponseStructure() {
  console.log('🔍 TESTING API RESPONSE STRUCTURE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Read the API file to see exactly what it returns
    console.log('📡 Reading API file structure...');
    
    const apiFilePath = 'src/app/api/fetch-live-data/route.ts';
    const apiContent = await fs.readFile(apiFilePath, 'utf8');
    
    // Find the cache return statements
    const cacheReturnPatterns = [
      /return NextResponse\.json\(\{[\s\S]*?data: \{[\s\S]*?\.\.\.cachedData\.cache_data[\s\S]*?\}\)/g
    ];
    
    console.log('🔍 Cache return statements found:');
    cacheReturnPatterns.forEach((pattern, index) => {
      const matches = apiContent.match(pattern);
      if (matches) {
        console.log(`✅ Pattern ${index + 1}: Found ${matches.length} cache return statements`);
        matches.forEach((match, matchIndex) => {
          console.log(`   Return ${matchIndex + 1}:`, match.substring(0, 200).replace(/\s+/g, ' ') + '...');
        });
      } else {
        console.log(`❌ Pattern ${index + 1}: No cache return statements found`);
      }
    });
    
    console.log('');
    console.log('🔍 Analyzing cache data structure...');
    
    // Check if the API spreads cache_data correctly
    if (apiContent.includes('...cachedData.cache_data')) {
      console.log('✅ API uses spread operator for cache_data');
      console.log('   This means if cache_data has "stats", it should be returned directly');
    } else {
      console.log('❌ API does not properly spread cache_data');
    }
    
    // Check for any transformations
    if (apiContent.includes('fromCache: true')) {
      console.log('✅ API adds fromCache flag');
    }
    
    if (apiContent.includes('cacheAge:')) {
      console.log('✅ API adds cacheAge information');
    }
    
    console.log('');
    console.log('🎯 EXPECTED API RESPONSE STRUCTURE:');
    console.log('Based on the code analysis, the API should return:');
    console.log('');
    console.log('{');
    console.log('  success: true,');
    console.log('  data: {');
    console.log('    stats: {');
    console.log('      totalSpend: 14033.08,');
    console.log('      totalImpressions: 1976321,');
    console.log('      totalClicks: 24011,');
    console.log('      totalConversions: 0,');
    console.log('      averageCtr: 1.21,');
    console.log('      averageCpc: 0.58');
    console.log('    },');
    console.log('    // ... other cache_data properties');
    console.log('    fromCache: true,');
    console.log('    cacheAge: <number>');
    console.log('  },');
    console.log('  debug: {');
    console.log('    source: "database-cache",');
    console.log('    // ... other debug info');
    console.log('  }');
    console.log('}');
    
    console.log('');
    console.log('🔧 NEXT DEBUGGING STEPS:');
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Go to Console tab');
    console.log('3. Refresh dashboard page');
    console.log('4. Look for these specific logs:');
    console.log('   • "✅ Using cached stats directly:" - should show the stats object');
    console.log('   • "💰 Cached totalSpend:" - should show 14033.08');
    console.log('   • "🎯 Final stats being returned:" - should show the final stats');
    console.log('   • "💰 Final totalSpend:" - should show 14033.08');
    console.log('');
    console.log('5. If you see zeros instead of 14033.08, there\'s a data flow issue');
    console.log('6. Share the console output so we can identify the exact problem');

  } catch (error) {
    console.error('💥 ERROR analyzing API structure:', error);
  }
}

// Run test
if (require.main === module) {
  testApiResponseStructure();
}

module.exports = { testApiResponseStructure }; 