#!/usr/bin/env node

/**
 * Simple email test using direct EmailService import
 */

// Use dynamic import for ES modules
async function testEmail() {
  console.log('🔍 Testing Email Monitoring System\n');
  
  try {
    // Dynamic import of the email service
    const { EmailService } = await import('../src/lib/email.js');
    
    console.log('📧 Initializing email service...');
    const emailService = EmailService.getInstance();
    
    console.log('📤 Sending test email...');
    console.log('   Original recipient: belmonte@hotel.com');
    console.log('   Will be redirected to: jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl');
    
    const result = await emailService.sendEmail({
      to: 'belmonte@hotel.com',
      from: process.env.EMAIL_FROM_ADDRESS || 'test@example.com',
      subject: 'Test Report for Belmonte Hotel',
      html: `
        <h1>Meta Ads Report - Belmonte Hotel</h1>
        <p>Dear Belmonte Hotel Team,</p>
        <p>This is your monthly Meta Ads performance report.</p>
        <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
          <h3>Performance Metrics</h3>
          <ul>
            <li>Total Spend: $2,450.75</li>
            <li>Impressions: 125,000</li>
            <li>Clicks: 3,250</li>
            <li>CTR: 2.60%</li>
          </ul>
        </div>
        <p>Best regards,<br>Your Marketing Team</p>
      `,
      text: `
Meta Ads Report - Belmonte Hotel

Dear Belmonte Hotel Team,

This is your monthly Meta Ads performance report.

Performance Metrics:
- Total Spend: $2,450.75
- Impressions: 125,000
- Clicks: 3,250
- CTR: 2.60%

Best regards,
Your Marketing Team
      `
    });
    
    if (result.success) {
      console.log('\n✅ Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      if (result.error) {
        console.log(`   Note: ${result.error}`);
      }
      
      console.log('\n📧 Email should be delivered to:');
      console.log('   📬 jac.honkisz@gmail.com');
      console.log('   📬 kontakt@piotrbajerlein.pl');
      
      console.log('\n💡 What to look for in the email:');
      console.log('   🔍 Subject: [MONITORING] Test Report for Belmonte Hotel');
      console.log('   🔍 Yellow monitoring notice banner at the top');
      console.log('   🔍 Original recipient: belmonte@hotel.com');
      console.log('   🔍 Report content below the notice');
      
    } else {
      console.log('\n❌ Failed to send email');
      console.log(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Run the test
testEmail();
