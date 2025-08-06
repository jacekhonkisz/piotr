require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function debugResendEmail() {
  console.log('🔍 Debugging Resend Email...\n');

  const resend = new Resend(process.env.RESEND_API_KEY);
  
  console.log('📋 Configuration:');
  console.log(`API Key: ${process.env.RESEND_API_KEY ? 'Set' : 'Missing'}`);
  console.log(`From Email: ${process.env.EMAIL_FROM_ADDRESS}`);
  console.log('');

  try {
    console.log('📧 Testing simple email...');
    
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
      to: ['jac.honkisz@gmail.com'],
      subject: 'Test Email - Debug',
      html: '<h1>Test Email</h1><p>This is a test email for debugging.</p>',
      text: 'Test Email\n\nThis is a test email for debugging.'
    });

    if (error) {
      console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
    } else {
      console.log(`✅ Success! Message ID: ${data?.id}`);
    }
    
  } catch (error) {
    console.log(`❌ Exception: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

debugResendEmail(); 