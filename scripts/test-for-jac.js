#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function sendTestForJac() {
  console.log('📧 Sending test email with Jac as original recipient...');
  
  const monitoringNotice = `
    <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; font-family: Arial, sans-serif;">
      <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
        🔍 MONITORING MODE - Internal Testing
      </h3>
      <p style="color: #856404; margin: 0; font-size: 14px;">
        <strong>Original Recipient:</strong> jac.honkisz@gmail.com<br>
        <strong>Monitoring Recipients:</strong> pbajerlein@gmail.com<br>
        <strong>Note:</strong> This email was redirected for monitoring purposes. In production, it would be sent to jac.honkisz@gmail.com.
      </p>
    </div>
  `;
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM_ADDRESS,
      to: 'pbajerlein@gmail.com',
      subject: '[MONITORING] Test Email for Jac Honkisz - Belmonte Report',
      html: `
        <!DOCTYPE html>
        <html>
        <head><title>Test Email for Jac</title></head>
        <body>
          ${monitoringNotice}
          <h1>📧 Test Email for Jac Honkisz</h1>
          <p>Hi Jac,</p>
          <p>This is a test of the email monitoring system. This email was originally intended for <strong>jac.honkisz@gmail.com</strong> but has been redirected to the monitoring address due to Resend testing limitations.</p>
          <div style="background: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #0066cc;">
            <h3>📊 Sample Belmonte Hotel Report</h3>
            <ul>
              <li><strong>Total Spend:</strong> $2,450.75</li>
              <li><strong>Impressions:</strong> 125,000</li>
              <li><strong>Clicks:</strong> 3,250</li>
              <li><strong>CTR:</strong> 2.60%</li>
            </ul>
          </div>
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Verify domain in Resend to send directly to jac.honkisz@gmail.com</li>
            <li>Update monitoring configuration</li>
            <li>Test production email flow</li>
          </ol>
          <p>Best regards,<br>Email Monitoring System</p>
        </body>
        </html>
      `,
      text: `
🔍 MONITORING MODE - Internal Testing
=====================================
Original Recipient: jac.honkisz@gmail.com
Monitoring Recipients: pbajerlein@gmail.com
Note: This email was redirected for monitoring purposes.
=====================================

Test Email for Jac Honkisz

Hi Jac,

This is a test of the email monitoring system. This email was originally intended for jac.honkisz@gmail.com but has been redirected to the monitoring address due to Resend testing limitations.

Sample Belmonte Hotel Report:
- Total Spend: $2,450.75
- Impressions: 125,000
- Clicks: 3,250
- CTR: 2.60%

Next Steps:
1. Verify domain in Resend to send directly to jac.honkisz@gmail.com
2. Update monitoring configuration  
3. Test production email flow

Best regards,
Email Monitoring System
      `
    })
  });
  
  const result = await response.json();
  if (response.ok) {
    console.log(`✅ Test email sent! Message ID: ${result.id}`);
    console.log('📬 Check pbajerlein@gmail.com for the test email');
    console.log('📝 The email shows jac.honkisz@gmail.com as the original recipient');
    console.log('📧 Subject: [MONITORING] Test Email for Jac Honkisz - Belmonte Report');
  } else {
    console.log(`❌ Failed: ${JSON.stringify(result)}`);
  }
}

sendTestForJac().catch(console.error);
