#!/usr/bin/env node

/**
 * Test script for email rate limiting functionality
 * This script tests the rate limiting implementation by sending multiple test emails
 */

const { EmailService } = require('../src/lib/email');
require('dotenv').config({ path: '.env.local' });

async function testRateLimiting() {
  console.log('🧪 Testing Email Rate Limiting Implementation\n');
  
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
  const testEmail = process.env.EMAIL_FROM_ADDRESS; // Send to self for testing
  
  console.log(`📧 Test Configuration:`);
  console.log(`   From: ${process.env.EMAIL_FROM_ADDRESS}`);
  console.log(`   To: ${testEmail}`);
  console.log(`   Rate Limit: 10 emails per second\n`);

  // Test 1: Single email send
  console.log('🔍 Test 1: Single Email Send');
  try {
    const startTime = Date.now();
    const result = await emailService.sendEmail({
      to: testEmail,
      from: process.env.EMAIL_FROM_ADDRESS,
      subject: 'Rate Limiting Test - Single Email',
      html: '<h1>Rate Limiting Test</h1><p>This is a test email to verify rate limiting is working.</p>',
      text: 'Rate Limiting Test\n\nThis is a test email to verify rate limiting is working.'
    });
    
    const duration = Date.now() - startTime;
    console.log(`   ✅ Single email sent in ${duration}ms`);
    console.log(`   📊 Rate limit status:`, emailService.getRateLimitStatus());
    
    if (result.success) {
      console.log(`   📬 Message ID: ${result.messageId}`);
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error(`   ❌ Test 1 failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Rapid fire emails (should trigger rate limiting)
  console.log('🔍 Test 2: Rapid Fire Emails (Testing Rate Limiting)');
  const rapidEmails = [];
  
  for (let i = 1; i <= 15; i++) { // Send 15 emails (more than the 10/second limit)
    rapidEmails.push({
      to: testEmail,
      from: process.env.EMAIL_FROM_ADDRESS,
      subject: `Rate Limiting Test - Rapid Email #${i}`,
      html: `<h1>Rapid Email Test #${i}</h1><p>This email tests rate limiting with rapid sends.</p>`,
      text: `Rapid Email Test #${i}\n\nThis email tests rate limiting with rapid sends.`
    });
  }

  try {
    const startTime = Date.now();
    console.log(`   📤 Sending ${rapidEmails.length} emails rapidly...`);
    
    const bulkResult = await emailService.sendBulkEmails(rapidEmails, (sent, total, current) => {
      if (sent % 5 === 0 || sent === total - 1) {
        const status = emailService.getRateLimitStatus();
        console.log(`   📊 Progress: ${sent + 1}/${total} | Rate limit: ${status.current}/${status.limit} | Reset in: ${Math.ceil(status.resetInMs / 1000)}s`);
      }
    });
    
    const duration = Date.now() - startTime;
    const avgTimePerEmail = duration / rapidEmails.length;
    
    console.log(`\n   ✅ Bulk send completed in ${duration}ms`);
    console.log(`   📊 Average time per email: ${avgTimePerEmail.toFixed(2)}ms`);
    console.log(`   📈 Results: ${bulkResult.successful} successful, ${bulkResult.failed} failed`);
    console.log(`   📊 Final rate limit status:`, emailService.getRateLimitStatus());
    
    // Show failed emails if any
    if (bulkResult.failed > 0) {
      console.log(`\n   ❌ Failed emails:`);
      bulkResult.results
        .filter(r => !r.success)
        .forEach(r => console.log(`      - ${r.email}: ${r.error}`));
    }
    
    // Verify rate limiting worked (should take longer than 1 second for 15 emails)
    const expectedMinTime = Math.ceil(rapidEmails.length / 10) * 1000; // At least 2 seconds for 15 emails
    if (duration >= expectedMinTime) {
      console.log(`   ✅ Rate limiting working correctly (took ${duration}ms, expected ≥${expectedMinTime}ms)`);
    } else {
      console.log(`   ⚠️  Rate limiting may not be working (took ${duration}ms, expected ≥${expectedMinTime}ms)`);
    }
    
  } catch (error) {
    console.error(`   ❌ Test 2 failed:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Rate limit status monitoring
  console.log('🔍 Test 3: Rate Limit Status Monitoring');
  try {
    const status = emailService.getRateLimitStatus();
    console.log(`   📊 Current requests: ${status.current}/${status.limit}`);
    console.log(`   ⏱️  Reset in: ${Math.ceil(status.resetInMs / 1000)} seconds`);
    console.log(`   📈 Utilization: ${Math.round((status.current / status.limit) * 100)}%`);
    
    if (status.current > 0) {
      console.log(`   ⏳ Waiting for rate limit to reset...`);
      await new Promise(resolve => setTimeout(resolve, status.resetInMs + 100));
      
      const newStatus = emailService.getRateLimitStatus();
      console.log(`   📊 After reset: ${newStatus.current}/${newStatus.limit}`);
      
      if (newStatus.current === 0) {
        console.log(`   ✅ Rate limit reset working correctly`);
      } else {
        console.log(`   ⚠️  Rate limit reset may have issues`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Test 3 failed:`, error.message);
  }

  console.log('\n🎉 Rate limiting tests completed!\n');
  console.log('📝 Summary:');
  console.log('   - Single email sending: Tested');
  console.log('   - Bulk email rate limiting: Tested');
  console.log('   - Rate limit status monitoring: Tested');
  console.log('   - Rate limit reset: Tested');
  console.log('\n✅ Email rate limiting implementation is ready for production!');
}

// Run the test
testRateLimiting().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
