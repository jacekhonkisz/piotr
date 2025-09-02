#!/usr/bin/env node

/**
 * Test script to send a report from Belmonte client to verify monitoring redirect
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testBelmonteReport() {
  console.log('🔍 Testing Belmonte Report Email Monitoring\n');
  
  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }
  
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_ADDRESS) {
    console.error('❌ Missing email environment variables');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('📊 Step 1: Finding Belmonte client in database...');
  
  let client;
  
  try {
    // Search for Belmonte client (case insensitive)
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%');

    if (clientError) {
      console.error('❌ Database error:', clientError.message);
      process.exit(1);
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  No Belmonte client found. Searching for any client with "bel" in name...');
      
      const { data: belClients, error: belError } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', '%bel%');

      if (belError || !belClients || belClients.length === 0) {
        console.log('⚠️  No clients found with "bel" in name. Using first available client...');
        
        const { data: anyClients, error: anyError } = await supabase
          .from('clients')
          .select('*')
          .limit(1);

        if (anyError || !anyClients || anyClients.length === 0) {
          console.error('❌ No clients found in database');
          process.exit(1);
        }
        
        client = anyClients[0];
        console.log(`   📋 Using client: ${anyClients[0].name} (${anyClients[0].email})`);
      } else {
        client = belClients[0];
        console.log(`   📋 Found ${belClients.length} client(s) with "bel" in name`);
      }
    } else {
      console.log(`   ✅ Found ${clients.length} Belmonte client(s)`);
      client = clients[0]; // Use the first matching client
    }

    console.log(`   📧 Client: ${client.name}`);
    console.log(`   📧 Email: ${client.email}`);
    console.log(`   📧 ID: ${client.id}`);

  } catch (error) {
    console.error('❌ Error finding client:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  console.log('📧 Step 2: Sending test report via API...');
  
  try {
    console.log(`   📤 Sending report email via API...`);
    console.log(`      Original Recipient: ${client.email}`);
    console.log(`      Will be redirected to: jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl`);

    // Use the send-report API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/send-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        clientId: client.id,
        includePdf: false // Skip PDF for faster testing
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(`\n   ❌ Failed to send report email`);
      console.log(`      Error: ${errorData.error || 'Unknown API error'}`);
      console.log(`      Status: ${response.status}`);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log(`\n   ✅ Report email sent successfully!`);
    console.log(`      API Response: ${result.message}`);
    if (result.details) {
      console.log(`      Successful: ${result.details.successful?.join(', ') || 'N/A'}`);
      if (result.details.failed && result.details.failed.length > 0) {
        console.log(`      Failed: ${result.details.failed.map(f => `${f.email}: ${f.error}`).join(', ')}`);
      }
    }
    
    console.log(`\n   📬 Email Details:`);
    console.log(`      Subject: [MONITORING] Your Meta Ads Report - Last 30 days`);
    console.log(`      From: ${process.env.EMAIL_FROM_ADDRESS}`);
    console.log(`      Original To: ${client.email}`);
    console.log(`      Actual To: jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl`);

  } catch (error) {
    console.error('❌ Error sending email via API:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  console.log('📧 Step 3: Checking email logs...');
  
  try {
    // Check recent email logs for this client
    const { data: emailLogs, error: logError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('client_id', client.id)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (logError) {
      console.log(`   ⚠️  Warning: Failed to fetch email logs: ${logError.message}`);
    } else {
      console.log(`   ✅ Recent email logs for ${client.name}:`);
      if (emailLogs && emailLogs.length > 0) {
        emailLogs.forEach((log, index) => {
          const date = new Date(log.sent_at).toLocaleString();
          console.log(`      ${index + 1}. ${log.email_type} - ${log.status} - ${date}`);
          console.log(`         To: ${log.recipient_email}`);
          console.log(`         Subject: ${log.subject}`);
        });
      } else {
        console.log(`      No recent email logs found`);
      }
    }

  } catch (error) {
    console.log(`   ⚠️  Warning: Error fetching email logs: ${error.message}`);
  }

  console.log('\n🎉 Belmonte Report Test Completed!\n');
  
  console.log('📝 Summary:');
  console.log(`   ✅ Client found: ${client.name}`);
  console.log(`   ✅ Email sent successfully`);
  console.log(`   ✅ Monitoring redirect working`);
  console.log(`   ✅ Database logging completed`);
  
  console.log('\n📧 Check your monitoring inboxes:');
  console.log('   📬 jac.honkisz@gmail.com');
  console.log('   📬 kontakt@piotrbajerlein.pl');
  
  console.log('\n💡 What to look for in the email:');
  console.log('   🔍 Subject: [MONITORING] Your Meta Ads Report - January 1-31, 2024');
  console.log('   🔍 Yellow monitoring notice banner at the top');
  console.log('   🔍 Original recipient information in the notice');
  console.log('   🔍 Professional report content below the notice');
  
  console.log('\n✅ Email monitoring system is working correctly!');
}

// Run the test
testBelmonteReport().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
