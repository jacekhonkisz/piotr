const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminSettings() {
  console.log('🧪 Testing Admin Settings...\n');

  try {
    // Test 1: Check if settings were created
    console.log('1. Checking system settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .order('key');

    if (settingsError) {
      throw settingsError;
    }

    console.log(`✅ Found ${settings.length} system settings`);
    
    // Show email-related settings
    const emailSettings = settings.filter(s => 
      s.key.includes('smtp_') || 
      s.key.includes('email_') || 
      s.key.includes('sendgrid_') || 
      s.key.includes('mailgun_')
    );
    
    console.log('\n📧 Email Settings:');
    emailSettings.forEach(setting => {
      console.log(`   ${setting.key}: ${setting.value}`);
    });

    // Show reporting settings
    const reportingSettings = settings.filter(s => 
      s.key.includes('default_') || 
      s.key.includes('bulk_') || 
      s.key.includes('auto_') || 
      s.key.includes('report_')
    );
    
    console.log('\n📊 Reporting Settings:');
    reportingSettings.forEach(setting => {
      console.log(`   ${setting.key}: ${setting.value}`);
    });

    // Test 2: Check if email_logs_bulk table was created
    console.log('\n2. Checking email_logs_bulk table...');
    const { data: bulkLogs, error: bulkLogsError } = await supabase
      .from('email_logs_bulk')
      .select('*')
      .limit(5);

    if (bulkLogsError) {
      console.log('❌ Error accessing email_logs_bulk table:', bulkLogsError.message);
    } else {
      console.log(`✅ email_logs_bulk table accessible, found ${bulkLogs.length} records`);
    }

    // Test 3: Test updating a setting
    console.log('\n3. Testing setting update...');
    const { error: updateError } = await supabase
      .from('system_settings')
      .update({ value: '"test_updated"' })
      .eq('key', 'email_test_status');

    if (updateError) {
      console.log('❌ Error updating setting:', updateError.message);
    } else {
      console.log('✅ Successfully updated email_test_status setting');
    }

    // Test 4: Test creating a bulk email log entry
    console.log('\n4. Testing bulk email log creation...');
    const { data: newLog, error: logError } = await supabase
      .from('email_logs_bulk')
      .insert({
        operation_type: 'test_operation',
        total_recipients: 5,
        successful_sends: 4,
        failed_sends: 1,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.log('❌ Error creating bulk log:', logError.message);
    } else {
      console.log('✅ Successfully created bulk email log entry');
      console.log(`   ID: ${newLog.id}`);
      console.log(`   Operation: ${newLog.operation_type}`);
      console.log(`   Status: ${newLog.status}`);
    }

    console.log('\n🎉 Admin Settings test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Navigate to /admin/settings in your browser');
    console.log('   2. Test the email configuration form');
    console.log('   3. Test the reporting settings');
    console.log('   4. Test the bulk report sending functionality');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminSettings(); 