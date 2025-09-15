import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../../lib/flexible-email';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const emailConfig = await request.json();
    
    // Validate required fields
    if (!emailConfig.email_from_address) {
      return NextResponse.json({ error: 'From email address is required' }, { status: 400 });
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ 
        error: 'Email service not configured. Please set RESEND_API_KEY environment variable.' 
      }, { status: 500 });
    }

    // Send a real test email using the FlexibleEmailService
    const emailService = FlexibleEmailService.getInstance();
    
    const testEmailData = {
      to: emailConfig.email_from_address, // Send to self for testing
      from: emailConfig.email_from_address,
      subject: 'Email Configuration Test - Meta Ads Reporting',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Configuration Test</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1877f2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
            .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Configuration Test</h1>
            </div>
            <div class="content">
              <div class="success">
                <h2>🎉 Success!</h2>
                <p>Your email configuration is working correctly.</p>
              </div>
              
              <p>This is a test email to verify your email configuration is working properly.</p>
              
              <div class="details">
                <h3>Configuration Details:</h3>
                <p><strong>Provider:</strong> ${emailConfig.email_provider}</p>
                <p><strong>From Address:</strong> ${emailConfig.email_from_address}</p>
                <p><strong>From Name:</strong> ${emailConfig.email_from_name || 'Not set'}</p>
                <p><strong>Test Sent At:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p>If you received this email, your email configuration is working properly and you can now:</p>
              <ul>
                <li>Send automated reports to clients</li>
                <li>Send bulk reports to all clients</li>
                <li>Receive system notifications</li>
              </ul>
              
              <p>Best regards,<br>Meta Ads Reporting System</p>
            </div>
            <div class="footer">
              <p>This is an automated test email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Email Configuration Test - Meta Ads Reporting

🎉 Success!

Your email configuration is working correctly.

This is a test email to verify your email configuration is working properly.

Configuration Details:
- Provider: ${emailConfig.email_provider}
- From Address: ${emailConfig.email_from_address}
- From Name: ${emailConfig.email_from_name || 'Not set'}
- Test Sent At: ${new Date().toLocaleString()}

If you received this email, your email configuration is working properly and you can now:
- Send automated reports to clients
- Send bulk reports to all clients
- Receive system notifications

Best regards,
Meta Ads Reporting System

---
This is an automated test email. Please do not reply.
      `
    };

    const emailResult = await emailService.sendEmail(testEmailData);

    if (!emailResult.success) {
      return NextResponse.json({ 
        error: 'Failed to send test email',
        details: emailResult.error 
      }, { status: 500 });
    }

    // Update the email test status in database
    await supabase
      .from('system_settings')
      .update({ 
        value: 'success',
        updated_at: new Date().toISOString()
      })
      .eq('key', 'email_test_status');
      
    await supabase
      .from('system_settings')
      .update({ 
        value: 'Test email sent successfully!',
        updated_at: new Date().toISOString()
      })
      .eq('key', 'email_test_result');

    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent successfully!',
      messageId: emailResult.messageId
    });

  } catch (error: any) {
    console.error('Email test error:', error);
    
    // Update the email test status in database
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      await supabase
        .from('system_settings')
        .update({ 
          value: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('key', 'email_test_status');
        
      await supabase
        .from('system_settings')
        .update({ 
          value: error.message || 'Failed to send test email',
          updated_at: new Date().toISOString()
        })
        .eq('key', 'email_test_result');
    } catch (dbError) {
      console.error('Error updating test status:', dbError);
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to send test email' 
    }, { status: 500 });
  }
} 