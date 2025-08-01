const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearAllReports() {
  console.log('🧹 Starting database cleanup - removing all reports...\n');

  try {
    // First, let's see how many reports we have
    const { data: reports, error: countError } = await supabase
      .from('reports')
      .select('id, client_id, date_range_start, date_range_end, generated_at');

    if (countError) {
      console.error('❌ Error fetching reports:', countError);
      return;
    }

    console.log(`📊 Found ${reports.length} reports in database`);
    
    if (reports.length === 0) {
      console.log('✅ No reports to delete - database is already clean!');
      return;
    }

    // Show some sample reports before deletion
    console.log('\n📋 Sample reports to be deleted:');
    reports.slice(0, 5).forEach((report, index) => {
      console.log(`   ${index + 1}. ID: ${report.id} | Client: ${report.client_id} | Date: ${report.date_range_start} - ${report.date_range_end} | Generated: ${report.generated_at}`);
    });

    if (reports.length > 5) {
      console.log(`   ... and ${reports.length - 5} more reports`);
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete ALL reports from the database!');
    console.log('   This action cannot be undone.');
    
    // For safety, we'll require manual confirmation
    console.log('\n🔒 To proceed with deletion, please:');
    console.log('   1. Review the reports above');
    console.log('   2. Set the environment variable CONFIRM_DELETE=true');
    console.log('   3. Run this script again');
    
    if (process.env.CONFIRM_DELETE !== 'true') {
      console.log('\n❌ Deletion cancelled - set CONFIRM_DELETE=true to proceed');
      return;
    }

    console.log('\n🗑️  Proceeding with deletion...');

    // Delete all reports
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except dummy records

    if (deleteError) {
      console.error('❌ Error deleting reports:', deleteError);
      return;
    }

    // Verify deletion
    const { data: remainingReports, error: verifyError } = await supabase
      .from('reports')
      .select('id');

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError);
      return;
    }

    console.log(`✅ Successfully deleted ${reports.length} reports!`);
    console.log(`📊 Remaining reports in database: ${remainingReports.length}`);

    // Also clean up related data if needed
    console.log('\n🧹 Cleaning up related data...');

    // Delete sent reports
    const { error: sentReportsError } = await supabase
      .from('sent_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sentReportsError) {
      console.error('⚠️  Warning: Could not delete sent_reports:', sentReportsError);
    } else {
      console.log('✅ Deleted sent_reports data');
    }

    // Delete email logs
    const { error: emailLogsError } = await supabase
      .from('email_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (emailLogsError) {
      console.error('⚠️  Warning: Could not delete email_logs:', emailLogsError);
    } else {
      console.log('✅ Deleted email_logs data');
    }

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('📝 You can now generate new reports with the updated design.');

  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error);
  }
}

// Run the cleanup
clearAllReports()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 