const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearCacheForDev() {
  console.log('🧹 Clearing Executive Summary Cache for Development...\n');

  try {
    // Count current summaries
    const { data: summaries, error: countError } = await supabase
      .from('executive_summaries')
      .select('id');

    if (countError) {
      console.error('❌ Error fetching summaries:', countError);
      return;
    }

    console.log(`📊 Found ${summaries.length} cached summaries`);

    if (summaries.length === 0) {
      console.log('✅ Cache is already empty!');
      return;
    }

    // Delete all summaries
    const { error: deleteError } = await supabase
      .from('executive_summaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('❌ Error deleting summaries:', deleteError);
      return;
    }

    console.log(`✅ Successfully cleared ${summaries.length} cached summaries`);
    console.log('🎉 Cache cleared! You can now test generating new executive summaries.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
clearCacheForDev()
  .then(() => {
    console.log('\n✅ Development cache clear completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 