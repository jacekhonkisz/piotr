const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJacekDetails() {
  console.log('🔍 CLIENT JACEK DETAILED ANALYSIS\n');
  console.log('=' .repeat(60));

  try {
    // Get jacek client details
    const { data: jacekClient, error: clientError } = await supabase
      .from('clients')
      .select(`
        *,
        profiles!clients_admin_id_fkey (
          id,
          email,
          full_name,
          role
        )
      `)
      .eq('name', 'jacek')
      .single();

    if (clientError) {
      console.error('❌ Error fetching jacek client:', clientError);
      return;
    }

    console.log('📧 CLIENT DETAILS:');
    console.log('-'.repeat(30));
    console.log(`Name: ${jacekClient.name}`);
    console.log(`Email: ${jacekClient.email}`);
    console.log(`Company: ${jacekClient.company || 'Not set'}`);
    console.log(`ID: ${jacekClient.id}`);
    console.log(`Created: ${new Date(jacekClient.created_at).toLocaleString()}`);
    console.log(`Updated: ${new Date(jacekClient.updated_at).toLocaleString()}`);

    console.log('\n📊 EMAIL SCHEDULING CONFIG:');
    console.log('-'.repeat(30));
    console.log(`Frequency: ${jacekClient.reporting_frequency}`);
    console.log(`Send Day: ${jacekClient.send_day}`);
    console.log(`API Status: ${jacekClient.api_status}`);
    console.log(`Last Report Sent: ${jacekClient.last_report_sent_at || 'Never'}`);
    console.log(`Email Send Count: ${jacekClient.email_send_count || 0}`);
    console.log(`Next Scheduled: ${jacekClient.next_report_scheduled_at || 'Not set'}`);

    console.log('\n📧 CONTACT EMAILS:');
    console.log('-'.repeat(30));
    if (jacekClient.contact_emails && jacekClient.contact_emails.length > 0) {
      jacekClient.contact_emails.forEach((email, index) => {
        console.log(`${index + 1}. ${email}`);
      });
    } else {
      console.log('No additional contact emails set');
    }

    console.log('\n👤 ADMIN DETAILS:');
    console.log('-'.repeat(30));
    if (jacekClient.profiles) {
      console.log(`Admin ID: ${jacekClient.profiles.id}`);
      console.log(`Admin Email: ${jacekClient.profiles.email}`);
      console.log(`Admin Name: ${jacekClient.profiles.full_name || 'Not set'}`);
      console.log(`Admin Role: ${jacekClient.profiles.role}`);
    } else {
      console.log('No admin profile found');
    }

    console.log('\n📅 SCHEDULING ANALYSIS:');
    console.log('-'.repeat(30));
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    console.log(`Today: ${today.toDateString()} (Day ${currentDay} of month ${currentMonth})`);
    console.log(`Client Schedule: Monthly on day ${jacekClient.send_day}`);
    
    if (jacekClient.reporting_frequency === 'monthly') {
      const shouldSendToday = currentDay === jacekClient.send_day;
      console.log(`Should send today: ${shouldSendToday ? 'YES' : 'NO'}`);
      
      if (!shouldSendToday) {
        const daysUntilNext = jacekClient.send_day > currentDay 
          ? jacekClient.send_day - currentDay 
          : (new Date(currentYear, currentMonth, 0).getDate() - currentDay) + jacekClient.send_day;
        console.log(`Days until next send: ${daysUntilNext}`);
        
        const nextSendDate = new Date(today);
        nextSendDate.setDate(today.getDate() + daysUntilNext);
        console.log(`Next send date: ${nextSendDate.toDateString()}`);
      }
    }

    console.log('\n🔍 EMAIL HISTORY:');
    console.log('-'.repeat(30));
    
    // Check email logs for this client
    const { data: emailLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('recipient_email', jacekClient.email)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.error('❌ Error fetching email logs:', logsError);
    } else {
      console.log(`Found ${emailLogs?.length || 0} email logs:`);
      emailLogs?.forEach(log => {
        console.log(`   ${new Date(log.sent_at).toLocaleString()} - ${log.recipient_email} (${log.status})`);
      });
    }

    console.log('\n📝 SCHEDULER LOGS:');
    console.log('-'.repeat(30));
    
    // Check scheduler logs for this client
    const { data: schedulerLogs, error: schedulerError } = await supabase
      .from('email_scheduler_logs')
      .select('*')
      .eq('client_id', jacekClient.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (schedulerError) {
      console.error('❌ Error fetching scheduler logs:', schedulerError);
    } else {
      console.log(`Found ${schedulerLogs?.length || 0} scheduler logs:`);
      schedulerLogs?.forEach(log => {
        console.log(`   ${new Date(log.created_at).toLocaleString()} - ${log.operation_type} (${log.email_sent ? 'Sent' : 'Failed'})`);
        if (log.error_message) {
          console.log(`      Error: ${log.error_message}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ANALYSIS COMPLETE');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

checkJacekDetails(); 