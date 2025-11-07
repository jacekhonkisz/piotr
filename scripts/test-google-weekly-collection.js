/**
 * Test Google Ads weekly data collection for Belmonte
 */

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function testGoogleWeeklyCollection() {
  console.log('🧪 Testing Google Ads Weekly Data Collection\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Trigger weekly data collection
    console.log('📅 Triggering weekly data collection for Belmonte...\n');
    
    const response = await fetch('http://localhost:3000/api/admin/collect-weekly-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: BELMONTE_ID
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Weekly collection triggered successfully!\n');
      console.log(result);
      console.log('\n⏳ Collection is running in background...');
      console.log('📊 This will collect 53 weeks of data (1 year + 1 week) for both Meta and Google Ads\n');
      console.log('⏰ Check logs in a few minutes to see progress\n');
      console.log('═══════════════════════════════════════════\n');
      console.log('🔍 To verify Google Ads weekly data after collection:');
      console.log('   Run: node scripts/check-google-weekly-data.js\n');
    } else {
      console.error('❌ Failed to trigger collection:', result.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGoogleWeeklyCollection();

