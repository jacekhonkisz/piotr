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
      html: '', // Empty HTML for text-only emails
      text: `✅ TEST KONFIGURACJI EMAIL - META ADS REPORTING

🎉 SUKCES!

Wasza konfiguracja email działa poprawnie.

To jest testowy email weryfikujący, że konfiguracja email działa prawidłowo.

SZCZEGÓŁY KONFIGURACJI:
• Dostawca: ${emailConfig.email_provider}
• Adres nadawcy: ${emailConfig.email_from_address}
• Nazwa nadawcy: ${emailConfig.email_from_name || 'Nie ustawiono'}
• Test wysłany: ${new Date().toLocaleString()}

Jeśli otrzymaliście ten email, wasza konfiguracja email działa poprawnie i możecie teraz:
• Wysyłać automatyczne raporty do klientów
• Wysyłać zbiorcze raporty do wszystkich klientów
• Otrzymywać powiadomienia systemowe

Z poważaniem,
System Raportów Meta Ads

---
To jest automatyczny email testowy. Prosimy nie odpowiadać.`
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