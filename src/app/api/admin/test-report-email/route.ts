import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FlexibleEmailService } from '../../../../lib/flexible-email';
import { EMAIL_CONFIG, isReviewMode } from '../../../../lib/email-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest): Promise<{ userId: string; token: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? { userId: user.id, token } : null;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, includePdf = true } = body;

    const reviewMode = await isReviewMode();
    const emailService = FlexibleEmailService.getInstance();

    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;

    if (includePdf && clientId) {
      try {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const dateRange = {
          start: lastMonth.toISOString().split('T')[0],
          end: lastMonthEnd.toISOString().split('T')[0]
        };

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const pdfResponse = await fetch(`${appUrl}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${admin.token}`
          },
          body: JSON.stringify({ clientId, dateRange })
        });

        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          if (pdfData.success && pdfData.pdf) {
            pdfBuffer = Buffer.from(pdfData.pdf, 'base64');
          } else {
            pdfError = 'PDF generated but data was empty';
          }
        } else {
          const errText = await pdfResponse.text().catch(() => 'Unknown error');
          pdfError = `PDF generation failed (${pdfResponse.status}): ${errText.substring(0, 200)}`;
        }
      } catch (err) {
        pdfError = `PDF generation error: ${err instanceof Error ? err.message : 'Unknown'}`;
      }
    }

    let clientName = 'Test Client';
    let clientEmail = EMAIL_CONFIG.REVIEW_EMAIL;
    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, email')
        .eq('id', clientId)
        .single();
      if (client) {
        clientName = client.name;
        clientEmail = client.email;
      }
    }

    const now = new Date();
    const testSubject = `Test raportu - ${clientName} - ${now.toLocaleDateString('pl-PL')}`;

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0;">Test wysylki raportu</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${now.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333;">Walidacja systemu e-mail</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 12px; font-weight: 600; color: #555;">Klient:</td>
              <td style="padding: 12px;">${clientName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 12px; font-weight: 600; color: #555;">Docelowy e-mail klienta:</td>
              <td style="padding: 12px;">${clientEmail}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 12px; font-weight: 600; color: #555;">Tryb weryfikacji:</td>
              <td style="padding: 12px;">
                <span style="background: ${reviewMode ? '#d4edda' : '#f8d7da'}; color: ${reviewMode ? '#155724' : '#721c24'}; padding: 4px 12px; border-radius: 20px; font-size: 13px;">
                  ${reviewMode ? 'WLACZONY' : 'WYLACZONY'}
                </span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 12px; font-weight: 600; color: #555;">PDF zalacznik:</td>
              <td style="padding: 12px;">
                ${pdfBuffer ? `<span style="color: #155724;">Tak (${(pdfBuffer.length / 1024).toFixed(0)} KB)</span>` : `<span style="color: #721c24;">Nie${pdfError ? ` — ${pdfError}` : ''}</span>`}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 12px; font-weight: 600; color: #555;">Custom SMTP:</td>
              <td style="padding: 12px;">${emailService.hasCustomSmtp() ? `Tak (${process.env.CUSTOM_SMTP_USER})` : 'Nie skonfigurowano'}</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: 600; color: #555;">Wyslano o:</td>
              <td style="padding: 12px;">${now.toLocaleTimeString('pl-PL')}</td>
            </tr>
          </table>

          ${reviewMode ? `
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <strong>Tryb weryfikacji aktywny</strong><br>
            Ten e-mail zostal przekierowany do ${EMAIL_CONFIG.REVIEW_EMAIL} zamiast do ${clientEmail}.
            Zweryfikuj dane i PDF, a nastepnie przeslij go recznie do klienta.
          </div>
          ` : ''}

          <p style="color: #666; font-size: 13px; margin-top: 30px;">
            Ten e-mail jest testem systemu wysylki raportow. Jesli wszystko wyglada poprawnie,
            mozesz uzyc przycisku "Wyslij" w kalendarzu aby wyslac raporty do klientow.
          </p>
        </div>
      </body>
      </html>
    `;

    const testText = `TEST WYSYLKI RAPORTU
Klient: ${clientName}
Docelowy e-mail: ${clientEmail}
Tryb weryfikacji: ${reviewMode ? 'WLACZONY' : 'WYLACZONY'}
PDF: ${pdfBuffer ? `Tak (${(pdfBuffer.length / 1024).toFixed(0)} KB)` : `Nie${pdfError ? ` — ${pdfError}` : ''}`}
Custom SMTP: ${emailService.hasCustomSmtp() ? 'Tak' : 'Nie'}
Wyslano: ${now.toLocaleTimeString('pl-PL')}`;

    const emailData = {
      to: clientEmail,
      from: emailService.hasCustomSmtp()
        ? (process.env.CUSTOM_SMTP_USER || 'kontakt@piotrbajerlein.pl')
        : (process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev'),
      subject: testSubject,
      html: testHtml,
      text: testText,
      attachments: pdfBuffer ? [{
        filename: `Test_Raport_${clientName.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf' as const
      }] : undefined
    };

    const result = await emailService.sendEmail(emailData);

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      provider: result.provider,
      reviewMode,
      redirectedTo: result.redirectedTo,
      pdfIncluded: !!pdfBuffer,
      pdfSize: pdfBuffer ? pdfBuffer.length : 0,
      pdfError,
      clientName,
      clientEmail,
      sentTo: result.redirectedTo || (reviewMode ? EMAIL_CONFIG.REVIEW_EMAIL : clientEmail)
    });

  } catch (err) {
    console.error('Test report email error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
