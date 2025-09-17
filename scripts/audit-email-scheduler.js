const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditEmailScheduler() {
  console.log('🔍 EMAIL SCHEDULER SYSTEM AUDIT\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check System Settings
    console.log('\n📋 1. SYSTEM SETTINGS');
    console.log('-'.repeat(30));
    
    const { data: systemSettings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', [
        'global_default_frequency',
        'global_default_send_day',
        'email_scheduler_enabled',
        'email_scheduler_time',
        'email_retry_attempts',
        'email_retry_delay_minutes'
      ]);

    if (settingsError) {
      console.error('❌ Error fetching system settings:', settingsError);
    } else {
      console.log('✅ System Settings Found:');
      systemSettings?.forEach(setting => {
        console.log(`   ${setting.key}: ${setting.value} (${setting.description})`);
      });
    }

    // 2. Check All Clients
    console.log('\n👥 2. ALL CLIENTS CONFIGURATION');
    console.log('-'.repeat(30));
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        email,
        reporting_frequency,
        send_day,
        last_report_sent_at,
        next_report_scheduled_at,
        email_send_count,
        api_status,
        admin_id
      `)
      .order('name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
    } else {
      console.log(`✅ Found ${clients?.length || 0} clients:`);
      clients?.forEach(client => {
        console.log(`\n   📧 ${client.name} (${client.email})`);
        console.log(`      Frequency: ${client.reporting_frequency}`);
        console.log(`      Send Day: ${client.send_day}`);
        console.log(`      API Status: ${client.api_status}`);
        console.log(`      Last Sent: ${client.last_report_sent_at || 'Never'}`);
        console.log(`      Email Count: ${client.email_send_count || 0}`);
        console.log(`      Next Scheduled: ${client.next_report_scheduled_at || 'Not set'}`);
      });
    }

    // 3. Specific Client "jacek" Analysis
    console.log('\n🎯 3. CLIENT "JACEK" DETAILED ANALYSIS');
    console.log('-'.repeat(30));
    
    const jacekClient = clients?.find(c => c.name.toLowerCase().includes('jacek') || c.email.includes('jacek'));
    
    if (jacekClient) {
      console.log('✅ Client "jacek" found:');
      console.log(`   ID: ${jacekClient.id}`);
      console.log(`   Name: ${jacekClient.name}`);
      console.log(`   Email: ${jacekClient.email}`);
      console.log(`   Frequency: ${jacekClient.reporting_frequency}`);
      console.log(`   Send Day: ${jacekClient.send_day}`);
      console.log(`   API Status: ${jacekClient.api_status}`);
      console.log(`   Last Report Sent: ${jacekClient.last_report_sent_at || 'Never'}`);
      console.log(`   Total Emails Sent: ${jacekClient.email_send_count || 0}`);
      console.log(`   Next Scheduled: ${jacekClient.next_report_scheduled_at || 'Not set'}`);

      // Calculate next scheduled date
      const today = new Date();
      const currentDay = today.getDate();
      const currentWeekday = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      console.log('\n   📅 SCHEDULING ANALYSIS:');
      console.log(`   Today: ${today.toDateString()} (Day ${currentDay}, Weekday ${currentWeekday})`);
      
      if (jacekClient.reporting_frequency === 'monthly') {
        const shouldSendToday = currentDay === jacekClient.send_day;
        console.log(`   Monthly Schedule: Send on day ${jacekClient.send_day} of each month`);
        console.log(`   Should send today: ${shouldSendToday ? 'YES' : 'NO'}`);
        
        if (!shouldSendToday) {
          const daysUntilNext = jacekClient.send_day > currentDay 
            ? jacekClient.send_day - currentDay 
            : (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - currentDay) + jacekClient.send_day;
          console.log(`   Days until next send: ${daysUntilNext}`);
        }
      } else if (jacekClient.reporting_frequency === 'weekly') {
        const weekday = currentWeekday === 0 ? 7 : currentWeekday; // Convert to Monday=1, Sunday=7
        const shouldSendToday = weekday === jacekClient.send_day;
        console.log(`   Weekly Schedule: Send on weekday ${jacekClient.send_day} (${getWeekdayName(jacekClient.send_day)})`);
        console.log(`   Should send today: ${shouldSendToday ? 'YES' : 'NO'}`);
        
        if (!shouldSendToday) {
          const daysUntilNext = jacekClient.send_day > weekday 
            ? jacekClient.send_day - weekday 
            : (7 - weekday) + jacekClient.send_day;
          console.log(`   Days until next send: ${daysUntilNext}`);
        }
      } else {
        console.log(`   On-Demand: No automatic scheduling`);
      }
    } else {
      console.log('❌ Client "jacek" not found');
    }

    // 4. Email Scheduler Logs
    console.log('\n📊 4. EMAIL SCHEDULER LOGS');
    console.log('-'.repeat(30));
    
    const { data: schedulerLogs, error: logsError } = await supabase
      .from('email_scheduler_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (logsError) {
      console.error('❌ Error fetching scheduler logs:', logsError);
    } else {
      console.log(`✅ Found ${schedulerLogs?.length || 0} recent scheduler logs:`);
      schedulerLogs?.forEach(log => {
        const client = clients?.find(c => c.id === log.client_id);
        console.log(`\n   📝 ${log.operation_type.toUpperCase()} - ${client?.name || 'Unknown Client'}`);
        console.log(`      Period: ${log.report_period_start} to ${log.report_period_end}`);
        console.log(`      Status: ${log.email_sent ? '✅ Sent' : '❌ Failed'}`);
        console.log(`      Created: ${new Date(log.created_at).toLocaleString()}`);
        if (log.error_message) {
          console.log(`      Error: ${log.error_message}`);
        }
      });
    }

    // 5. System Health Check
    console.log('\n🏥 5. SYSTEM HEALTH CHECK');
    console.log('-'.repeat(30));
    
    const activeClients = clients?.filter(c => c.api_status === 'valid' && c.reporting_frequency !== 'on_demand');
    const monthlyClients = clients?.filter(c => c.reporting_frequency === 'monthly');
    const weeklyClients = clients?.filter(c => c.reporting_frequency === 'weekly');
    const onDemandClients = clients?.filter(c => c.reporting_frequency === 'on_demand');
    
    console.log(`✅ Total Clients: ${clients?.length || 0}`);
    console.log(`✅ Active Clients (valid API): ${activeClients?.length || 0}`);
    console.log(`✅ Monthly Clients: ${monthlyClients?.length || 0}`);
    console.log(`✅ Weekly Clients: ${weeklyClients?.length || 0}`);
    console.log(`✅ On-Demand Clients: ${onDemandClients?.length || 0}`);
    
    // Check for clients that should have received emails recently
    const today = new Date();
    const currentDay = today.getDate();
    const currentWeekday = today.getDay();
    const weekday = currentWeekday === 0 ? 7 : currentWeekday;
    
    const shouldSendToday = activeClients?.filter(client => {
      if (client.reporting_frequency === 'monthly') {
        return currentDay === client.send_day;
      } else if (client.reporting_frequency === 'weekly') {
        return weekday === client.send_day;
      }
      return false;
    });
    
    console.log(`✅ Clients that should send today: ${shouldSendToday?.length || 0}`);
    shouldSendToday?.forEach(client => {
      console.log(`   - ${client.name} (${client.reporting_frequency}, day ${client.send_day})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 AUDIT COMPLETE');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

function getWeekdayName(day) {
  const weekdays = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return weekdays[day] || 'Unknown';
}

auditEmailScheduler(); 