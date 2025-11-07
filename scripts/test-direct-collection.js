/**
 * Test direct collection for a single client
 */

async function testCollection() {
  console.log('🧪 Testing Direct Collection\n');

  const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

  try {
    // Import the BackgroundDataCollector
    const { BackgroundDataCollector } = await import('../src/lib/background-data-collector.js');
    const collector = BackgroundDataCollector.getInstance();

    console.log('✅ Collector initialized');
    console.log('📊 Starting weekly collection for Belmonte...\n');

    // Collect weekly data
    await collector.collectWeeklySummariesForSingleClient(BELMONTE_ID);

    console.log('\n✅ Collection completed!');
    console.log('📋 Check the database to see new records');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testCollection();

