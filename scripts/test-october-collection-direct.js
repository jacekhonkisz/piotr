#!/usr/bin/env node

/**
 * Direct test of October 2025 Google Ads collection
 */

async function testOctoberCollection() {
  console.log('🔍 TESTING OCTOBER 2025 GOOGLE ADS COLLECTION\n');

  try {
    // Import the background collector
    const { BackgroundDataCollector } = await import('../src/lib/background-data-collector.ts');
    
    const collector = BackgroundDataCollector.getInstance();
    const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

    console.log('📊 Starting collection for Belmonte...');
    await collector.collectMonthlySummariesForSingleClient(BELMONTE_ID);
    
    console.log('\n✅ Collection completed!');
    console.log('Now check the database for October 2025 data...');
    
  } catch (error) {
    console.error('\n❌ Collection failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOctoberCollection()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

