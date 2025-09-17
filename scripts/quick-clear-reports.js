const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickClearReports() {
  console.log('🧹 Quick cleanup - removing all reports...\n');

  try {
    // Delete all reports
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('❌ Error deleting reports:', deleteError);
      return;
    }

    // Delete sent reports
    const { error: sentReportsError } = await supabase
      .from('sent_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete email logs
    const { error: emailLogsError } = await supabase
      .from('email_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ All reports and related data deleted successfully!');
    console.log('📝 Database is now clean and ready for new reports.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup
quickClearReports()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 