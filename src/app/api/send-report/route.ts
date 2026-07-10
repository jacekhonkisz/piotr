import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../lib/flexible-email';
import logger from '../../../lib/logger';
import { buildMonthlyReportData, builtPlatformToSummaryShape } from '@/lib/monthly-report-data-builder';
import { adaptCampaignSummary } from '@/lib/report-adapters';
import { evaluatePreSend } from '@/lib/report-presend-guard';
import { normalizeReviewRecipientsOverride } from '@/lib/email-recipients';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const appOrigin = request.nextUrl.origin;

    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token and get user
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('Token verification failed:', userAuthError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse request body
    const { clientId, reportId, includePdf, reviewRecipientOverride, reviewRecipientsOverride } = await request.json();
    const internalRecipientsOverride =
      normalizeReviewRecipientsOverride(reviewRecipientsOverride ?? reviewRecipientOverride);

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('admin_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get report information if reportId is provided
    let reportData: any = null;
    if (reportId) {
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .eq('client_id', clientId)
        .single();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        // Continue without report data
      } else {
        reportData = report;
      }
    }

    // Define date range for monthly reports: previous full month (1st to last day)
    const now = new Date();
    const prevMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0)); // last day of previous month
    const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1)); // 1st of previous month
    const startDate = prevMonthStart;
    const endDate = prevMonthEnd;

    const emailDateRange = {
      start: startDate.toISOString().split('T')[0]!,
      end: endDate.toISOString().split('T')[0]!
    };

    // SINGLE fetch for the whole send cycle. Builds the exact email payload via
    // the shared builder (StandardizedDataFetcher + prepareClientMonthlyReportData),
    // identical to the scheduler, so manual and scheduled sends never diverge on
    // data source, ROAS, konwersje or the offline model. For a completed month
    // the fetcher reads stored summaries, so this is not a live-API hit.
    const built = await buildMonthlyReportData({
      client: {
        id: client.id,
        name: client.name ?? '',
        google_ads_enabled: client.google_ads_enabled,
        meta_access_token: client.meta_access_token
      },
      period: emailDateRange,
      sessionToken: token,
      reasonPrefix: 'send-report'
    });

    // Lightweight summary for the sent_reports audit record, derived from the
    // same fetch (no extra round-trip).
    const realReportData = {
      dateRange: `${emailDateRange.start} to ${emailDateRange.end}`,
      totalSpend: (built.metaAdsData?.spend || 0) + (built.googleAdsData?.spend || 0),
      totalImpressions: (built.metaAdsData?.impressions || 0) + (built.googleAdsData?.impressions || 0),
      totalClicks: (built.metaAdsData?.linkClicks || 0) + (built.googleAdsData?.clicks || 0)
    } as any;

    // Generate PDF if requested and fetch AI summary
    let pdfBuffer: Buffer | undefined;
    let aiSummary: string | undefined;
    
    if (includePdf) {
      try {
        logger.info('📄 Generating PDF with UNIFIED AI summary...');
        
        // FIXED APPROACH: Get PDF directly (smaller, reliable) and AI summary separately
        const pdfResponse = await fetch(`${appOrigin}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            }
          })
        });

        if (pdfResponse.ok) {
          // Get PDF as direct buffer (reliable, smaller size)
          const pdfArrayBuffer = await pdfResponse.arrayBuffer();
          pdfBuffer = Buffer.from(pdfArrayBuffer);
          
          // Get AI summary separately using JSON API
          const aiSummaryResponse = await fetch(`${appOrigin}/api/generate-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              clientId,
              dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
              }
            })
          });

          if (aiSummaryResponse.ok) {
            const aiResult = await aiSummaryResponse.json();
            if (aiResult.success && aiResult.aiSummary) {
              aiSummary = aiResult.aiSummary;
            }
          }
          
          logger.info('✅ FIXED PDF and AI summary generated:', {
            pdfSize: pdfBuffer.byteLength,
            pdfSizeKB: `${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`,
            pdfSizeMB: `${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
            hasAiSummary: !!aiSummary,
            aiSummaryLength: aiSummary?.length || 0,
            aiSummaryPreview: aiSummary?.substring(0, 50) || 'No AI summary'
          });
        } else {
          logger.error('❌ PDF generation request failed:', pdfResponse.status);
        }
      } catch (error) {
        logger.error('❌ Error generating unified PDF and AI summary:', error);
      }
    } else {
      // If no PDF requested, still generate AI summary using JSON API
      try {
        logger.info('🤖 Generating AI summary only (no PDF requested)...');
        
        const aiSummaryResponse = await fetch(`${appOrigin}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            }
          })
        });

        if (aiSummaryResponse.ok) {
          const aiResult = await aiSummaryResponse.json();
          if (aiResult.success && aiResult.aiSummary) {
            aiSummary = aiResult.aiSummary;
            logger.info('✅ AI summary generated (no PDF):', {
              hasAiSummary: !!aiSummary,
              aiSummaryLength: aiSummary?.length || 0
            });
          }
        }
      } catch (error) {
        logger.error('❌ Error generating AI summary:', error);
      }
    }

    // Send email to all contact emails using NEW MONTHLY TEMPLATE
    const emailService = FlexibleEmailService.getInstance();
    const contactEmails = client.contact_emails?.length ? client.contact_emails : [client.email];

    // Email payload + month/year come from the single shared build above.
    const monthName = built.monthName;
    const year = built.year;
    const monthlyReportData = built.reportData;

    // Pre-send consistency check (soft mode: log warnings/blocks but do not abort).
    // Validates per-platform data against a fresh live API baseline.
    try {
      const guardChecks: Promise<unknown>[] = [];
      if (built.metaAdsData) {
        const candidateMeta = adaptCampaignSummary({
          clientId,
          clientName: client.name ?? '',
          platform: 'meta',
          dateRange: emailDateRange,
          summary: builtPlatformToSummaryShape(built.metaAdsData, 'meta')
        });
        guardChecks.push(
          evaluatePreSend(candidateMeta, { sessionToken: token }).then((result) => {
            logger.info('send-report pre-send guard (meta)', {
              clientId,
              decision: result.decision,
              score: result.score,
              reason: result.reason
            });
          }).catch((err) => {
            logger.warn('send-report pre-send guard (meta) failed', { error: err instanceof Error ? err.message : 'unknown' });
          })
        );
      }
      if (built.googleAdsData) {
        const candidateGoogle = adaptCampaignSummary({
          clientId,
          clientName: client.name ?? '',
          platform: 'google',
          dateRange: emailDateRange,
          summary: builtPlatformToSummaryShape(built.googleAdsData, 'google')
        });
        guardChecks.push(
          evaluatePreSend(candidateGoogle, { sessionToken: token }).then((result) => {
            logger.info('send-report pre-send guard (google)', {
              clientId,
              decision: result.decision,
              score: result.score,
              reason: result.reason
            });
          }).catch((err) => {
            logger.warn('send-report pre-send guard (google) failed', { error: err instanceof Error ? err.message : 'unknown' });
          })
        );
      }
      // Fire-and-forget; do not block email sending in soft rollout.
      Promise.all(guardChecks).catch(() => undefined);
    } catch (guardError) {
      logger.warn('send-report pre-send guard wiring error', {
        error: guardError instanceof Error ? guardError.message : 'unknown'
      });
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json({
        error: 'Failed to generate PDF attachment',
        details: 'PDF attachment is mandatory for monthly report emails'
      }, { status: 500 });
    }
    
    // Send ONE email to all contact emails.
    // Primary contact = To, remaining contacts = CC ("DW"). The admin preview
    // address (kontakt@piotrbajerlein.pl) is added to CC automatically by the
    // email service so every report is copied to the admin for oversight.
    const [primaryRecipient, ...ccRecipients] = contactEmails;
    let emailResults: { email: string; success: boolean; error?: string }[] = [];
    let routedCc: string[] = [];
    let providerMessageId: string | null = null;

    try {
      const emailResult = await emailService.sendClientMonthlyReport(
        primaryRecipient!,
        clientId,
        client.name ?? '',
        monthName ?? '',
        year,
        monthlyReportData,
        pdfBuffer,
        undefined,
        { reviewRecipientsOverride: internalRecipientsOverride, cc: ccRecipients }
      );
      routedCc = emailResult.cc || [];
      providerMessageId = emailResult.messageId || null;
      emailResults.push({ email: primaryRecipient!, success: emailResult.success, error: emailResult.error });
    } catch (error) {
      emailResults.push({
        email: primaryRecipient!,
        success: false,
        error: error instanceof Error ? error.message : 'Nieznany błąd'
      });
    }

    // Check if the email was sent successfully
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    if (successfulEmails.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to send email to any recipients',
        details: failedEmails.map(f => `${f.email}: ${f.error}`).join(', ')
      }, { status: 500 });
    }

    // Log email sending in database — one row per recipient (To + CC).
    const sentSuccessfully = successfulEmails.length > 0;
    const allLoggedRecipients = sentSuccessfully
      ? [primaryRecipient!, ...ccRecipients]
      : [primaryRecipient!];
    for (const recipientEmail of allLoggedRecipients) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'monthly_report',
          recipient_email: recipientEmail,
          subject: `Podsumowanie miesiąca - ${monthName} ${year} | ${client.name}`,
          message_id: sentSuccessfully ? (providerMessageId || 'sent') : null,
          sent_at: new Date().toISOString(),
          status: sentSuccessfully ? 'sent' : 'failed',
          error_message: failedEmails[0]?.error || null
        });

      if (logError) {
        console.error('Error logging email:', logError);
        // Don't fail the request if logging fails
      }
    }

    // Update report if it exists
    if (reportData) {
      await supabase
        .from('reports')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', reportId);
    }

    // Create sent report record (if we have report data)
    if (reportData) {
      const reportPeriod = `${new Date(reportData.date_range_start).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
      
      // Create sent report record
      const { error: sentReportError } = await supabase
        .from('sent_reports')
        .insert({
          report_id: reportId,
          client_id: clientId,
          pdf_url: '', // Will be updated when PDF is actually generated
          recipient_email: client.email,
          report_period: reportPeriod,
          status: 'sent',
          meta: {
            dateRange: realReportData.dateRange,
            totalSpend: realReportData.totalSpend,
            totalImpressions: realReportData.totalImpressions,
            totalClicks: realReportData.totalClicks
          }
        });

      if (sentReportError) {
        console.error('Error creating sent report record:', sentReportError);
        // Don't fail the request if sent report creation fails
      }
    }

    const deliveredRecipients = successfulEmails.length > 0
      ? [primaryRecipient!, ...routedCc]
      : [];

    return NextResponse.json({
      success: true,
      message: `Report sent successfully to ${deliveredRecipients.length} recipient(s)${failedEmails.length > 0 ? `, failed to send to ${failedEmails.length} recipient(s)` : ''}`,
      pdfSize: pdfBuffer ? pdfBuffer.byteLength : 0,
      details: {
        to: successfulEmails.length > 0 ? primaryRecipient : null,
        cc: routedCc,
        successful: deliveredRecipients,
        failed: failedEmails.map(e => ({ email: e.email, error: e.error }))
      }
    });

  } catch (error) {
    console.error('Error in send report API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 