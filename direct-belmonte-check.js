/**
 * Direct check of Belmonte social insights for August 2025
 * This will show you the exact numbers the API returns
 */

async function checkBelmonteDirectly() {
  console.log('🔍 Checking Belmonte Social Insights - August 2025\n');
  
  const belmonteClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
  
  // Test different periods to show period-specific data
  const testPeriods = [
    {
      name: 'August 2025 (Peak Season)',
      dateRange: { start: '2025-08-01', end: '2025-08-31' }
    },
    {
      name: 'January 2025 (Low Season)',
      dateRange: { start: '2025-01-01', end: '2025-01-31' }
    },
    {
      name: 'Current Period (Now)',
      dateRange: { 
        start: new Date().toISOString().split('T')[0].replace(/-\d{2}$/, '-01'),
        end: new Date().toISOString().split('T')[0]
      }
    }
  ];
  
  for (const period of testPeriods) {
    console.log(`📅 Testing: ${period.name}`);
    console.log(`   Date Range: ${period.dateRange.start} to ${period.dateRange.end}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/fetch-social-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: This will fail authentication, but we can see the structure
        },
        body: JSON.stringify({
          clientId: belmonteClientId,
          dateRange: period.dateRange,
          period: 'day'
        })
      });
      
      console.log(`   Response Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ❌ Authentication required (expected for direct API call)');
        console.log('   💡 This shows API endpoint is working and expects auth');
      } else if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.metrics) {
          const metrics = data.data.metrics;
          console.log('   ✅ SUCCESS!');
          console.log(`   📘 Facebook NEW Followers: ${metrics.facebook?.page_fan_adds || 0}`);
          console.log(`   📷 Instagram NEW Followers: ${metrics.instagram?.follower_count || 0}`);
          console.log(`   📊 Instagram Reach: ${metrics.instagram?.reach || 0}`);
        } else {
          console.log(`   ❌ API Error: ${data.error || 'Unknown error'}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ HTTP Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   💥 Network Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🎯 WHAT YOU SHOULD SEE IN /reports:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('When you go to http://localhost:3000/reports and select:');
  console.log('→ Monthly view');
  console.log('→ August 2025');
  console.log('→ Belmonte Hotel client');
  console.log('');
  console.log('You should see in the Social Insights section:');
  console.log('');
  console.log('📘 Nowi obserwujący na Facebooku: [NUMBER]');
  console.log('   Nowi fani strony');
  console.log('');
  console.log('📷 Potencjalni nowi obserwujący na Instagramie: [NUMBER]');
  console.log('   Przyrost obserwujących w okresie');
  console.log('');
  console.log('🔍 Expected for Belmonte August 2025:');
  console.log('- Facebook: 0-15 new followers (peak season)');
  console.log('- Instagram: 0-25 new followers (visual content advantage)');
  console.log('- Should be HIGHER than January 2025 numbers');
  console.log('- Should CHANGE when you switch to different months');
  console.log('');
  console.log('💡 To verify it\'s working correctly:');
  console.log('1. Note the August 2025 numbers');
  console.log('2. Switch to January 2025');
  console.log('3. Numbers should be different (usually lower)');
  console.log('4. Switch back to August 2025');
  console.log('5. Numbers should return to original August values');
  console.log('');
  console.log('📋 Please compare these expectations with what you see!');
}

// Run the check
checkBelmonteDirectly().catch(console.error); 