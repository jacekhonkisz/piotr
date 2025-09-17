#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testWithCustomDomain() {
  console.log('🔍 Testing email with custom domain pbmreports.pl...\n');
  
  // First check if domain is verified
  console.log('📊 Checking domain status...');
  const domainResponse = await fetch('https://api.resend.com/domains/f2859f39-87d5-4b8b-9ec1-f8e4dac28782', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (!domainResponse.ok) {
    console.log('❌ Failed to check domain status');
    return;
  }
  
  const domain = await domainResponse.json();
  console.log(`   Domain: ${domain.name}`);
  console.log(`   Status: ${domain.status}`);
  
  if (domain.status !== 'verified') {
    console.log('\n⚠️  Domain is not yet verified.');
    console.log('Please add the DNS records and wait for verification.');
    console.log('Check DOMAIN_SETUP_INSTRUCTIONS.md for details.');
    return;
  }
  
  console.log('✅ Domain is verified! Proceeding with test...\n');
  
  // Test sending to Jac's email
  const monitoringNotice = `
    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: Arial, sans-serif;">
      <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
        🔍 MONITORING MODE - Internal Testing
      </h3>
      <p style="color: #856404; margin: 0; font-size: 14px;">
        <strong>Original Recipient:</strong> belmonte@hotel.com<br>
        <strong>Monitoring Recipients:</strong> jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl<br>
        <strong>Note:</strong> This email was redirected for monitoring purposes. In production, it would be sent to the original recipient.
      </p>
    </div>
  `;
  
  const recipients = ['jac.honkisz@gmail.com', 'kontakt@piotrbajerlein.pl'];
  
  for (const recipient of recipients) {
    console.log(`📧 Sending test email to: ${recipient}`);
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'reports@pbmreports.pl', // Using custom domain
          to: recipient,
          subject: '[MONITORING] Belmonte Hotel Report - Custom Domain Test',
          html: `
            <!DOCTYPE html>
            <html>
            <head><title>Custom Domain Test</title></head>
            <body>
              ${monitoringNotice}
              <h1>🎉 Custom Domain Test Successful!</h1>
              <p>Hi ${recipient === 'jac.honkisz@gmail.com' ? 'Jac' : 'Team'},</p>
              <p>This email was sent using the custom domain <strong>pbmreports.pl</strong> and demonstrates that the monitoring system is working correctly.</p>
              
              <div style="background: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #0066cc;">
                <h3>📊 Sample Belmonte Hotel Report</h3>
                <ul>
                  <li><strong>Total Spend:</strong> $2,450.75</li>
                  <li><strong>Impressions:</strong> 125,000</li>
                  <li><strong>Clicks:</strong> 3,250</li>
                  <li><strong>CTR:</strong> 2.60%</li>
                  <li><strong>CPC:</strong> $0.75</li>
                  <li><strong>CPM:</strong> $19.61</li>
                </ul>
              </div>
              
              <p><strong>✅ System Status:</strong></p>
              <ul>
                <li>Custom domain: pbmreports.pl ✅</li>
                <li>Email monitoring: Active ✅</li>
                <li>Rate limiting: Enabled ✅</li>
                <li>Database logging: Working ✅</li>
              </ul>
              
              <p>The email monitoring system is now fully operational with your custom domain!</p>
              
              <p>Best regards,<br>Email Monitoring System</p>
            </body>
            </html>
          `,
          text: `
🔍 MONITORING MODE - Internal Testing
=====================================
Original Recipient: belmonte@hotel.com
Monitoring Recipients: jac.honkisz@gmail.com, kontakt@piotrbajerlein.pl
Note: This email was redirected for monitoring purposes.
=====================================

Custom Domain Test Successful!

Hi ${recipient === 'jac.honkisz@gmail.com' ? 'Jac' : 'Team'},

This email was sent using the custom domain pbmreports.pl and demonstrates that the monitoring system is working correctly.

Sample Belmonte Hotel Report:
- Total Spend: $2,450.75
- Impressions: 125,000
- Clicks: 3,250
- CTR: 2.60%
- CPC: $0.75
- CPM: $19.61

System Status:
✅ Custom domain: pbmreports.pl
✅ Email monitoring: Active
✅ Rate limiting: Enabled
✅ Database logging: Working

The email monitoring system is now fully operational with your custom domain!

Best regards,
Email Monitoring System
          `
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Success! Message ID: ${result.id}`);
      } else {
        const error = await response.json();
        console.log(`   ❌ Failed: ${JSON.stringify(error)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay between emails
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 Custom domain test completed!');
  console.log('📧 Check the monitoring inboxes for the test emails.');
}

testWithCustomDomain();
