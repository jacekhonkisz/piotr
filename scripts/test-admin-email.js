#!/usr/bin/env node

/**
 * Test admin email endpoint to verify monitoring redirect
 */

require('dotenv').config({ path: '.env.local' });

async function testAdminEmail() {
  console.log('🔍 Testing Admin Email with Monitoring Redirect\n');
  
  try {
    console.log('📧 Sending test email via admin endpoint...');
    console.log('   This will test the monitoring redirect functionality');
    
    const response = await fetch('http://localhost:3000/api/admin/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_provider: 'resend',
        email_from_address: process.env.EMAIL_FROM_ADDRESS || 'test@example.com',
        email_from_name: 'Test System'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log(`❌ Failed to send test email`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorData.error || 'Unknown error'}`);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message: ${result.message}`);
    if (result.messageId) {
      console.log(`   Message ID: ${result.messageId}`);
    }
    
    console.log('\n📧 Email should be delivered to:');
    console.log('   📬 jac.honkisz@gmail.com');
    console.log('   📬 kontakt@piotrbajerlein.pl');
    
    console.log('\n💡 What to look for in the email:');
    console.log('   🔍 Subject: [MONITORING] Email Configuration Test - Meta Ads Reporting');
    console.log('   🔍 Yellow monitoring notice banner at the top');
    console.log('   🔍 Original recipient information in the notice');
    console.log('   🔍 Test email content below the notice');
    
    console.log('\n🎉 Monitoring redirect test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAdminEmail();
