/**
 * Run collection directly without API
 */

async function runCollection() {
  console.log('🚀 Starting Direct Collection\n');
  console.log('═'.repeat(70) + '\n');

  try {
    // Dynamic import to use ESM
    const module = await import('../src/lib/background-data-collector.js');
    const BackgroundDataCollector = module.BackgroundDataCollector || module.default?.BackgroundDataCollector;
    
    if (!BackgroundDataCollector) {
      throw new Error('BackgroundDataCollector not found in module exports');
    }

    const collector = BackgroundDataCollector.getInstance();
    
    console.log('✅ Collector initialized\n');
    
    // Run weekly collection
    console.log('📅 Starting WEEKLY collection for ALL clients...');
    console.log('   This will collect 53 weeks for both Meta + Google\n');
    
    await collector.collectWeeklySummaries();
    
    console.log('\n✅ Weekly collection completed!\n');
    console.log('─'.repeat(70) + '\n');
    
    // Run monthly collection
    console.log('📅 Starting MONTHLY collection for ALL clients...');
    console.log('   This will collect 12 months for both Meta + Google\n');
    
    await collector.collectMonthlySummaries();
    
    console.log('\n✅ Monthly collection completed!\n');
    console.log('═'.repeat(70) + '\n');
    
    console.log('🎉 ALL COLLECTION COMPLETED!');
    console.log('📊 Run: node scripts/audit-4-categories.js to see results\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runCollection();

