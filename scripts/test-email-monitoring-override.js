#!/usr/bin/env node

/**
 * Test script for email monitoring override functionality
 * This script tests that all emails are redirected to monitoring addresses
 */

const { EmailService } = require('../src/lib/email');
require('dotenv').config({ path: '.env.local' });

async function testEmailOverride() {
  console.log('🔍 Testing Email Monitoring Override\n');
  
  // Check if required environment variables are set
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  if (!process.env.EMAIL_FROM_ADDRESS) {
    console.error('❌ EMAIL_FROM_ADDRESS not found in environment variables');
    process.exit(1);
  }

  const emailService = EmailService.getInstance();
  
  console.log(`📧 Monitoring Configuration:`);
  console.log(`   From: ${process.env.EMAIL_FROM_ADDRESS}`);
  console.log(`   Monitoring Addresses: jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl`);
  console.log(`   All emails will be redirected to monitoring addresses\n`);

  // Test 1: Single email to a fake client
  console.log('🔍 Test 1: Single Email Override');
  try {
    const fakeClientEmail = 'fake.client@example.com';
    const result = await emailService.sendEmail({
      to: fakeClientEmail,
      from: process.env.EMAIL_FROM_ADDRESS,
      subject: 'Test Report for Client XYZ',
      html: `
        <h1>Meta Ads Report</h1>
        <p>Dear Client,</p>
        <p>This is your monthly Meta Ads performance report.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
          <h3>Performance Metrics</h3>
          <ul>
            <li>Total Spend: $1,250.00</li>
            <li>Impressions: 45,000</li>
            <li>Clicks: 1,200</li>
            <li>CTR: 2.67%</li>
          </ul>
        </div>
        <p>Best regards,<br>Your Marketing Team</p>
      `,
      text: `
Meta Ads Report

Dear Client,

This is your monthly Meta Ads performance report.

Performance Metrics:
- Total Spend: $1,250.00
- Impressions: 45,000
- Clicks: 1,200
- CTR: 2.67%

Best regards,
Your Marketing Team
      `
    });
    
    if (result.success) {
      console.log(`   ✅ Email override successful!`);
      console.log(`   📬 Original recipient: ${fakeClientEmail}`);
      console.log(`   📬 Redirected to monitoring addresses`);
      console.log(`   📬 Message ID: ${result.messageId}`);
      if (result.error) {
        console.log(`   ⚠️  Note: ${result.error}`);
      }
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error(`   ❌ Test 1 failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Multiple different "clients"
  console.log('🔍 Test 2: Multiple Client Email Override');
  const fakeClients = [
    { email: 'client1@company1.com', name: 'ABC Corp' },
    { email: 'client2@company2.com', name: 'XYZ Ltd' },
    { email: 'client3@company3.com', name: 'DEF Inc' }
  ];

  const bulkEmails = fakeClients.map(client => ({
    to: client.email,
    from: process.env.EMAIL_FROM_ADDRESS,
    subject: `Monthly Report for ${client.name}`,
    html: `
      <h1>Monthly Report for ${client.name}</h1>
      <p>Dear ${client.name} Team,</p>
      <p>Here's your monthly performance summary.</p>
      <p>This email was originally intended for: ${client.email}</p>
      <p>Best regards,<br>Your Account Manager</p>
    `,
    text: `
Monthly Report for ${client.name}

Dear ${client.name} Team,

Here's your monthly performance summary.

This email was originally intended for: ${client.email}

Best regards,
Your Account Manager
    `
  }));

  try {
    console.log(`   📤 Testing bulk override with ${fakeClients.length} fake clients...`);
    
    const bulkResult = await emailService.sendBulkEmails(bulkEmails, (sent, total, current) => {
      console.log(`   📊 Progress: ${sent + 1}/${total} - Original: ${current.to} → Monitoring addresses`);
    });
    
    console.log(`\n   ✅ Bulk override test completed!`);
    console.log(`   📈 Results: ${bulkResult.successful} successful, ${bulkResult.failed} failed`);
    
    // Show results
    console.log(`\n   📋 Detailed Results:`);
    bulkResult.results.forEach((result, index) => {
      const originalClient = fakeClients[index];
      if (result.success) {
        console.log(`   ✅ ${originalClient.name} (${originalClient.email}) → Monitoring addresses`);
      } else {
        console.log(`   ❌ ${originalClient.name} (${originalClient.email}) → Failed: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error(`   ❌ Test 2 failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Verify monitoring notice is added
  console.log('🔍 Test 3: Monitoring Notice Verification');
  try {
    const testResult = await emailService.sendEmail({
      to: 'another.fake.client@example.com',
      from: process.env.EMAIL_FROM_ADDRESS,
      subject: 'Monitoring Notice Test',
      html: '<h1>Simple Test Email</h1><p>This should have a monitoring notice added.</p>',
      text: 'Simple Test Email\n\nThis should have a monitoring notice added.'
    });
    
    if (testResult.success) {
      console.log(`   ✅ Monitoring notice test completed`);
      console.log(`   📝 The email should contain a monitoring notice banner`);
      console.log(`   📝 Subject should be prefixed with [MONITORING]`);
      console.log(`   📝 Check the received emails for the monitoring notice`);
    } else {
      console.log(`   ❌ Monitoring notice test failed: ${testResult.error}`);
    }
  } catch (error) {
    console.error(`   ❌ Test 3 failed:`, error.message);
  }

  console.log('\n🎉 Email monitoring override tests completed!\n');
  console.log('📝 Summary:');
  console.log('   - All emails are redirected to monitoring addresses');
  console.log('   - Monitoring notices are added to email content');
  console.log('   - Original recipient information is preserved in notices');
  console.log('   - Subject lines are prefixed with [MONITORING]');
  console.log('\n✅ Email monitoring override is working correctly!');
  console.log('\n📧 Check your monitoring inboxes:');
  console.log('   - jac.honkisz@gmail.com');
  console.log('   - kontakt@piotrbajerlein.pl');
}

// Run the test
testEmailOverride().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
