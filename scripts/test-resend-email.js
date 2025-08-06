require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function testResendEmail() {
  console.log('🧪 Testing Resend Email Configuration...\n');

  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in environment variables');
    return;
  }

  console.log('✅ RESEND_API_KEY found:', process.env.RESEND_API_KEY.substring(0, 10) + '...');

  // Initialize Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log('📧 Attempting to send test email...');

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || 'reports@yourdomain.com',
      to: ['pbajerlein@gmail.com'], // Your verified email address
      subject: 'Test Email from Resend Integration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Test Email</h2>
          <p>This is a test email to verify that your Resend integration is working correctly.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>API Key: ${process.env.RESEND_API_KEY.substring(0, 10)}...</li>
            <li>From Address: ${process.env.EMAIL_FROM_ADDRESS || 'reports@yourdomain.com'}</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
          </ul>
          <p>If you receive this email, your Resend setup is working! 🎉</p>
        </div>
      `,
      text: `
        Test Email
        
        This is a test email to verify that your Resend integration is working correctly.
        
        Configuration Details:
        - API Key: ${process.env.RESEND_API_KEY.substring(0, 10)}...
        - From Address: ${process.env.EMAIL_FROM_ADDRESS || 'reports@yourdomain.com'}
        - Timestamp: ${new Date().toISOString()}
        
        If you receive this email, your Resend setup is working! 🎉
      `
    });

    if (error) {
      console.error('❌ Email sending failed:', error);
      return;
    }

    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', data?.id);
    console.log('📧 To:', 'pbajerlein@gmail.com');
    console.log('📧 From:', process.env.EMAIL_FROM_ADDRESS || 'reports@yourdomain.com');
    
    console.log('\n🎉 Resend integration is working correctly!');
    console.log('\nNext steps:');
    console.log('1. Email sent to your verified address: pbajerlein@gmail.com');
    console.log('2. Test the email functionality in your admin panel');
    console.log('3. Configure your domain in Resend dashboard for production use');

  } catch (error) {
    console.error('❌ Error testing Resend:', error);
  }
}

testResendEmail(); 