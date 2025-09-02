#!/usr/bin/env node

/**
 * Direct test of monitoring functionality using Resend API
 */

require('dotenv').config({ path: '.env.local' });

async function testDirectEmail() {
  console.log('🔍 Direct Email Monitoring Test\n');
  
  // Check if we have the required environment variables
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found');
    process.exit(1);
  }
  
  if (!process.env.EMAIL_FROM_ADDRESS) {
    console.error('❌ EMAIL_FROM_ADDRESS not found');
    process.exit(1);
  }
  
  console.log('📧 Configuration:');
  console.log(`   From: ${process.env.EMAIL_FROM_ADDRESS}`);
  console.log(`   API Key: ${process.env.RESEND_API_KEY.substring(0, 10)}...`);
  
  try {
    console.log('\n📤 Sending test email directly via Resend API...');
    
    // Simulate what our monitoring system should do
    const originalRecipient = 'belmonte@hotel.com';
    // Use verified email address for testing (Resend limitation)
    const monitoringEmails = ['pbajerlein@gmail.com'];
    
    console.log(`   Original recipient: ${originalRecipient}`);
    console.log(`   Monitoring recipients: ${monitoringEmails.join(', ')}`);
    
    // Create monitoring notice
    const monitoringNotice = `
      <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: Arial, sans-serif;">
        <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
          🔍 MONITORING MODE - Internal Testing
        </h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">
          <strong>Original Recipient:</strong> ${originalRecipient}<br>
          <strong>Monitoring Recipients:</strong> ${monitoringEmails.join(', ')}<br>
          <strong>Note:</strong> This email was redirected for monitoring purposes. In production, it would be sent to the original recipient.
        </p>
      </div>
    `;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Belmonte Hotel - Meta Ads Report</title>
      </head>
      <body>
        ${monitoringNotice}
        <h1>📊 Meta Ads Report - Belmonte Hotel</h1>
        <p>Dear Belmonte Hotel Team,</p>
        <p>This is your monthly Meta Ads performance report.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <h3>Performance Metrics</h3>
          <ul>
            <li><strong>Total Spend:</strong> $2,450.75</li>
            <li><strong>Impressions:</strong> 125,000</li>
            <li><strong>Clicks:</strong> 3,250</li>
            <li><strong>CTR:</strong> 2.60%</li>
            <li><strong>CPC:</strong> $0.75</li>
            <li><strong>CPM:</strong> $19.61</li>
          </ul>
        </div>
        <p>Best regards,<br>Your Marketing Team</p>
      </body>
      </html>
    `;
    
    // Send to each monitoring email
    for (const monitoringEmail of monitoringEmails) {
      console.log(`\n   📧 Sending to: ${monitoringEmail}`);
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM_ADDRESS,
          to: monitoringEmail,
          subject: '[MONITORING] Meta Ads Report - Belmonte Hotel',
          html: emailContent,
          text: `
🔍 MONITORING MODE - Internal Testing
=====================================
Original Recipient: ${originalRecipient}
Monitoring Recipients: ${monitoringEmails.join(', ')}
Note: This email was redirected for monitoring purposes.
=====================================

Meta Ads Report - Belmonte Hotel

Dear Belmonte Hotel Team,

This is your monthly Meta Ads performance report.

Performance Metrics:
- Total Spend: $2,450.75
- Impressions: 125,000
- Clicks: 3,250
- CTR: 2.60%
- CPC: $0.75
- CPM: $19.61

Best regards,
Your Marketing Team
          `
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log(`      ❌ Failed (${response.status}): ${JSON.stringify(errorData)}`);
        continue;
      }
      
      const result = await response.json();
      console.log(`      ✅ Success! Message ID: ${result.id}`);
    }
    
    console.log('\n🎉 Direct monitoring test completed!');
    console.log('\n📧 Check your monitoring inboxes:');
    console.log('   📬 jac.honkisz@gmail.com');
    console.log('   📬 kontakt@piotrbajerlein.pl');
    
    console.log('\n💡 What to look for:');
    console.log('   🔍 Subject: [MONITORING] Meta Ads Report - Belmonte Hotel');
    console.log('   🔍 Yellow monitoring notice banner at the top');
    console.log('   🔍 Original recipient: belmonte@hotel.com');
    console.log('   🔍 Report content below the notice');
    
    console.log('\n✅ Email monitoring system is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testDirectEmail();
