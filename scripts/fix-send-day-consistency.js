#!/usr/bin/env node

/**
 * Script to fix send_day consistency issues
 * This script ensures all clients have proper send_day values
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSystemDefaultSendDay() {
  try {
    const { data: sendDaySettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_reporting_day')
      .single();
    
    return sendDaySettings?.value ? parseInt(sendDaySettings.value) : 5;
  } catch (error) {
    console.warn('Failed to get system default send_day, using fallback:', error.message);
    return 5;
  }
}

async function fixSendDayConsistency() {
  console.log('🔧 FIXING SEND_DAY CONSISTENCY ISSUES\n');

  try {
    // Get system default
    const defaultSendDay = await getSystemDefaultSendDay();
    console.log(`📋 System default send_day: ${defaultSendDay}`);

    // Get all clients with potential issues
    console.log('🔍 Finding clients with send_day issues...');
    
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id, name, email, reporting_frequency, send_day')
      .order('name');

    if (fetchError) {
      throw new Error(`Failed to fetch clients: ${fetchError.message}`);
    }

    console.log(`📊 Found ${clients.length} total clients`);

    let issuesFound = 0;
    let fixed = 0;
    const issues = [];

    // Analyze each client
    for (const client of clients) {
      let hasIssue = false;
      let expectedSendDay = null;
      let reason = '';

      if (client.reporting_frequency === 'on_demand') {
        if (client.send_day !== null) {
          hasIssue = true;
          expectedSendDay = null;
          reason = 'On-demand clients should have send_day = null';
        }
      } else if (client.reporting_frequency === 'monthly') {
        if (client.send_day === null) {
          hasIssue = true;
          expectedSendDay = defaultSendDay;
          reason = 'Monthly clients should not have null send_day';
        } else if (client.send_day < 1 || client.send_day > 31) {
          hasIssue = true;
          expectedSendDay = defaultSendDay;
          reason = 'Monthly send_day must be between 1-31';
        }
      } else if (client.reporting_frequency === 'weekly') {
        if (client.send_day === null) {
          hasIssue = true;
          expectedSendDay = 1; // Default to Monday
          reason = 'Weekly clients should not have null send_day';
        } else if (client.send_day < 1 || client.send_day > 7) {
          hasIssue = true;
          expectedSendDay = 1;
          reason = 'Weekly send_day must be between 1-7';
        }
      }

      if (hasIssue) {
        issuesFound++;
        issues.push({
          client,
          expectedSendDay,
          reason
        });

        console.log(`⚠️  Issue #${issuesFound}: ${client.name} (${client.email})`);
        console.log(`   Current: frequency=${client.reporting_frequency}, send_day=${client.send_day}`);
        console.log(`   Expected: send_day=${expectedSendDay}`);
        console.log(`   Reason: ${reason}\n`);
      }
    }

    if (issuesFound === 0) {
      console.log('✅ No send_day consistency issues found!');
      return;
    }

    console.log(`📊 Summary: Found ${issuesFound} clients with send_day issues`);
    console.log('\n🔧 Applying fixes...\n');

    // Apply fixes
    for (const issue of issues) {
      try {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ send_day: issue.expectedSendDay })
          .eq('id', issue.client.id);

        if (updateError) {
          console.error(`❌ Failed to fix ${issue.client.name}: ${updateError.message}`);
        } else {
          fixed++;
          console.log(`✅ Fixed ${issue.client.name}: send_day = ${issue.expectedSendDay}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing ${issue.client.name}: ${error.message}`);
      }
    }

    console.log(`\n📊 Final Summary:`);
    console.log(`   Issues found: ${issuesFound}`);
    console.log(`   Successfully fixed: ${fixed}`);
    console.log(`   Failed to fix: ${issuesFound - fixed}`);

    if (fixed === issuesFound) {
      console.log('\n🎉 All send_day consistency issues have been resolved!');
    } else {
      console.log('\n⚠️  Some issues could not be resolved. Please check the errors above.');
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Verify environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Run the script
fixSendDayConsistency().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
