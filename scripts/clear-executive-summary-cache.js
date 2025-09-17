const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearExecutiveSummaryCache() {
  console.log('🧹 Clearing Executive Summary Cache for Development Testing...\n');

  try {
    // First, let's see what's in the cache
    console.log('📊 Current cache status:');
    
    const { data: summaries, error: countError } = await supabase
      .from('executive_summaries')
      .select('id, client_id, date_range_start, date_range_end, generated_at, is_ai_generated');

    if (countError) {
      console.error('❌ Error fetching current summaries:', countError);
      return;
    }

    console.log(`   Total cached summaries: ${summaries.length}`);
    
    if (summaries.length > 0) {
      console.log('\n📋 Current cached summaries:');
      summaries.forEach((summary, index) => {
        console.log(`   ${index + 1}. Client: ${summary.client_id}`);
        console.log(`      Date Range: ${summary.date_range_start} to ${summary.date_range_end}`);
        console.log(`      Generated: ${summary.generated_at}`);
        console.log(`      AI Generated: ${summary.is_ai_generated}`);
        console.log('');
      });
    }

    // Confirm before deletion
    console.log('⚠️  WARNING: This will delete ALL cached executive summaries!');
    console.log('   This action cannot be undone.');
    console.log('   Only proceed if you want to clear the cache for development testing.\n');

    // For safety, we'll ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('Type "CLEAR" to confirm deletion: ', (input) => {
        rl.close();
        resolve(input);
      });
    });

    if (answer !== 'CLEAR') {
      console.log('❌ Deletion cancelled. Cache remains unchanged.');
      return;
    }

    // Delete all executive summaries
    console.log('\n🗑️  Deleting all cached executive summaries...');
    
    const { error: deleteError } = await supabase
      .from('executive_summaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (this condition is always true)

    if (deleteError) {
      console.error('❌ Error deleting executive summaries:', deleteError);
      return;
    }

    // Verify deletion
    const { data: remainingSummaries, error: verifyError } = await supabase
      .from('executive_summaries')
      .select('id');

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError);
      return;
    }

    console.log(`✅ Successfully deleted ${summaries.length} cached executive summaries`);
    console.log(`   Remaining summaries: ${remainingSummaries.length}`);
    
    if (remainingSummaries.length === 0) {
      console.log('🎉 Cache completely cleared!');
      console.log('\n📝 Next steps:');
      console.log('   1. Generate new executive summaries in the reports page');
      console.log('   2. Test the AI generation functionality');
      console.log('   3. Verify that new summaries are being cached properly');
      console.log('   4. Check that PDF generation works with fresh summaries');
    } else {
      console.log('⚠️  Some summaries may still exist. Check the database manually.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
clearExecutiveSummaryCache()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 