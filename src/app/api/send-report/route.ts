import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../lib/flexible-email';
import logger from '../../../lib/logger';
import {
  getBelmontePotentialOfflineValue,
  getMicroConversionsForOfflineModel,
  isBelmonteClient,
  offlineMicroPartsFromCampaigns,
  offlineMicroPartsFromPlatformMetrics
} from '@/lib/offline-reservation-estimate';
import { adaptCampaignSummary } from '@/lib/report-adapters';
import { evaluatePreSend } from '@/lib/report-presend-guard';

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
    const { clientId, reportId, includePdf, reviewRecipientOverride } = await request.json();
    const allowedInternalRecipients = ['jac.honkisz@gmail.com', 'kontakt@piotrbajerlein.pl', 'pbajerlein@gmail.com'];
    const normalizedOverride = typeof reviewRecipientOverride === 'string' ? reviewRecipientOverride.trim().toLowerCase() : '';
    const internalRecipientOverride = allowedInternalRecipients.includes(normalizedOverride) ? normalizedOverride : undefined;

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

    // Generate real report data using same logic as reports
    let realReportData;
    
    // Define date range for monthly reports: previous full month (1st to last day)
    const now = new Date();
    const prevMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0)); // last day of previous month
    const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1)); // 1st of previous month
    const startDate = prevMonthStart;
    const endDate = prevMonthEnd;
    
    if (reportData && reportData.report_data) {
      // Use stored report data if available
      const storedData = reportData.report_data;
      const campaigns = storedData.campaigns || [];
      const stats = storedData.account_summary || {};
      const conversionMetrics = storedData.conversionMetrics || {};
      
      const platformData = (storedData as any).platformData;
      const offlineParts = platformData?.meta || platformData?.google
        ? offlineMicroPartsFromPlatformMetrics(
            platformData?.google?.conversionMetrics,
            platformData?.meta?.conversionMetrics
          )
        : offlineMicroPartsFromCampaigns(campaigns);
      const metaCampaigns = campaigns.filter(
        (c: any) => !c.platform || c.platform === 'meta'
      );
      const cn = client.name ?? '';
      const offlineMicroTotal = getMicroConversionsForOfflineModel(cn, offlineParts, {
        metaCampaigns
      });
      const potentialOfflineReservations = Math.round(offlineMicroTotal * 0.2);

      const totalReservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
      const totalReservations = campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0);
      const metaOnlineReservationValue = metaCampaigns.reduce(
        (s, c: any) => s + (Number(c.reservation_value) || 0),
        0
      );
      const metaReservationsCount = metaCampaigns.reduce(
        (s, c: any) => s + (Number(c.reservations) || 0),
        0
      );
      let averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
      if (isBelmonteClient(cn) && metaReservationsCount > 0) {
        averageReservationValue = metaOnlineReservationValue / metaReservationsCount;
      }
      const potentialOfflineValue = isBelmonteClient(cn)
        ? getBelmontePotentialOfflineValue(averageReservationValue)
        : potentialOfflineReservations * averageReservationValue;
      const totalPotentialValue = isBelmonteClient(cn)
        ? potentialOfflineValue + metaOnlineReservationValue
        : potentialOfflineValue + totalReservationValue;
      const metaSpend = metaCampaigns.reduce((s, c: any) => s + (Number(c.spend) || 0), 0);
      const spendForCost = isBelmonteClient(cn) ? metaSpend || stats.totalSpend || 0 : stats.totalSpend || 0;
      const costPercentage = totalPotentialValue > 0 ? (spendForCost / totalPotentialValue) * 100 : 0;
      
      realReportData = {
        dateRange: `${reportData.date_range_start} to ${reportData.date_range_end}`,
        totalSpend: stats.totalSpend || 0,
        totalImpressions: stats.totalImpressions || 0,
        totalClicks: stats.totalClicks || 0,
        ctr: stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) : 0,
        cpc: stats.totalClicks > 0 ? (stats.totalSpend / stats.totalClicks) : 0,
        // New metrics
        potentialOfflineReservations,
        totalPotentialValue,
        costPercentage,
        // Conversion metrics
        reservations: conversionMetrics.reservations || 0,
        reservationValue: conversionMetrics.reservation_value || 0
      } as any;
    } else {
      // Fallback: fetch fresh data using same system as reports
      try {
        const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
        const dateRange = {
          start: startDate.toISOString().split('T')[0]!,
          end: endDate.toISOString().split('T')[0]!
        };

        const fetchResult = await StandardizedDataFetcher.fetchData({
          clientId: client.id,
          dateRange,
          platform: 'meta',
          reason: 'email-report-generation'
        });

        let googleMetrics: any = undefined;
        if (client.google_ads_enabled) {
          try {
            const { GoogleAdsStandardizedDataFetcher } = await import(
              '../../../lib/google-ads-standardized-data-fetcher'
            );
            const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
              clientId: client.id,
              dateRange,
              reason: 'send-report-offline-google'
            });
            if (googleResult.success && googleResult.data) {
              googleMetrics = googleResult.data.conversionMetrics;
            }
          } catch (e) {
            logger.warn('send-report: Google fetch for offline micro skipped', e);
          }
        }

        if (fetchResult.success && fetchResult.data) {
          const data = fetchResult.data;
          const campaigns = data.campaigns || [];
          const stats = data.stats || {};
          const conversionMetrics = data.conversionMetrics || {};

          const offlineParts = offlineMicroPartsFromPlatformMetrics(googleMetrics, conversionMetrics);
          const metaCampaigns = campaigns.filter(
            (c: any) => !c.platform || c.platform === 'meta'
          );
          const cn = client.name ?? '';
          const offlineMicroTotal = getMicroConversionsForOfflineModel(cn, offlineParts, {
            metaCampaigns
          });
          const potentialOfflineReservations = Math.round(offlineMicroTotal * 0.2);

          const totalReservationValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
          const totalReservations = campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
          const metaOnlineReservationValue = metaCampaigns.reduce(
            (s, c: any) => s + (Number(c.reservation_value) || 0),
            0
          );
          const metaReservationsCount = metaCampaigns.reduce(
            (s, c: any) => s + (Number(c.reservations) || 0),
            0
          );
          let averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
          if (isBelmonteClient(cn) && metaReservationsCount > 0) {
            averageReservationValue = metaOnlineReservationValue / metaReservationsCount;
          }
          const potentialOfflineValue = isBelmonteClient(cn)
            ? getBelmontePotentialOfflineValue(averageReservationValue)
            : potentialOfflineReservations * averageReservationValue;
          const totalPotentialValue = isBelmonteClient(cn)
            ? potentialOfflineValue + metaOnlineReservationValue
            : potentialOfflineValue + totalReservationValue;
          const metaSpend = metaCampaigns.reduce((s, c: any) => s + (Number(c.spend) || 0), 0);
          const spendForCost = isBelmonteClient(cn) ? metaSpend || stats.totalSpend || 0 : stats.totalSpend || 0;
          const costPercentage = totalPotentialValue > 0 ? (spendForCost / totalPotentialValue) * 100 : 0;
          
          realReportData = {
            dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            totalSpend: stats.totalSpend || 0,
            totalImpressions: stats.totalImpressions || 0,
            totalClicks: stats.totalClicks || 0,
            totalConversions: stats.totalConversions || 0,
            ctr: stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) : 0,
            cpc: stats.totalClicks > 0 ? (stats.totalSpend / stats.totalClicks) : 0,
            // New metrics
            potentialOfflineReservations,
            totalPotentialValue,
            costPercentage,
            // Conversion metrics
            reservations: conversionMetrics.reservations || 0,
            reservationValue: conversionMetrics.reservation_value || 0
          };
        } else {
          throw new Error('Failed to fetch fresh data');
        }
      } catch (error) {
        logger.error('Failed to fetch real report data, using minimal fallback:', error);
        realReportData = {
          dateRange: 'Last 30 days',
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          ctr: 0,
          cpc: 0,
          potentialOfflineReservations: 0,
          totalPotentialValue: 0,
          costPercentage: 0,
          reservations: 0,
          reservationValue: 0
        };
      }
    }

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
    
    // Extract month and year for the monthly template (previous month)
    const reportStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const monthNames = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    const monthName = monthNames[reportStartDate.getMonth()];
    const year = reportStartDate.getFullYear();
    
    // Fetch real per-platform data from campaign_summaries for previous month
    const prevMonthDate = new Date(reportStartDate.getFullYear(), reportStartDate.getMonth(), 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: metaSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', 'meta')
      .eq('summary_date', prevMonthStr)
      .maybeSingle();

    const { data: googleSummary } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', 'google')
      .eq('summary_date', prevMonthStr)
      .maybeSingle();

    const { data: googleAdsSummary } = await supabase
      .from('google_ads_campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_type', 'monthly')
      .eq('period_start', prevMonthStr)
      .maybeSingle();

    const gData = googleAdsSummary || googleSummary;
    let googleAdsSection: any = undefined;
    if (gData) {
      const gSpend = Number(gData.total_spend || 0);
      const gImpressions = Number(gData.total_impressions || 0);
      const gClicks = Number(gData.total_clicks || 0);
      if (gSpend > 0 || gImpressions > 0) {
        googleAdsSection = {
          spend: gSpend, impressions: gImpressions, clicks: gClicks,
          cpc: gClicks > 0 ? gSpend / gClicks : 0,
          ctr: gImpressions > 0 ? (gClicks / gImpressions) * 100 : 0,
          formSubmits: Number(gData.total_form_submissions || gData.booking_step_1 || 0),
          emailClicks: Number(gData.total_email_clicks || gData.email_contacts || 0),
          phoneClicks: Number(gData.total_phone_clicks || gData.click_to_call || 0),
          bookingStep1: Number(gData.total_booking_step_1 || gData.booking_step_1 || 0),
          bookingStep2: Number(gData.total_booking_step_2 || gData.booking_step_2 || 0),
          bookingStep3: Number(gData.total_booking_step_3 || gData.booking_step_3 || 0),
          reservations: Number(gData.total_reservations || gData.reservations || 0),
          reservationValue: Number(gData.total_reservation_value || gData.reservation_value || 0),
          roas: gSpend > 0 ? Number(gData.total_reservation_value || gData.reservation_value || 0) / gSpend : 0
        };
      }
    }

    let metaAdsSection: any = undefined;
    if (metaSummary) {
      const mSpend = Number(metaSummary.total_spend || 0);
      const mImpressions = Number(metaSummary.total_impressions || 0);
      const mClicks = Number(metaSummary.total_clicks || 0);
      if (mSpend > 0 || mImpressions > 0) {
        metaAdsSection = {
          spend: mSpend, impressions: mImpressions, linkClicks: mClicks,
          formSubmits: Number(metaSummary.booking_step_1 || 0),
          emailClicks: Number(metaSummary.email_contacts || 0),
          phoneClicks: Number(metaSummary.click_to_call || 0),
          reservations: Number(metaSummary.reservations || 0),
          reservationValue: Number(metaSummary.reservation_value || 0),
          roas: mSpend > 0 ? Number(metaSummary.reservation_value || 0) / mSpend : 0
        };
      }
    }

    // Pre-send consistency check (soft mode: log warnings/blocks but do not abort).
    // Validates per-platform monthly summary against fresh live API baseline.
    try {
      const dateRange = {
        start: prevMonthStr,
        end: new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, 0))
          .toISOString()
          .slice(0, 10)
      };
      const guardChecks: Promise<unknown>[] = [];
      if (metaSummary) {
        const candidateMeta = adaptCampaignSummary({
          clientId,
          clientName: client.name ?? '',
          platform: 'meta',
          dateRange,
          summary: metaSummary
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
      if (googleSummary) {
        const candidateGoogle = adaptCampaignSummary({
          clientId,
          clientName: client.name ?? '',
          platform: 'google',
          dateRange,
          summary: googleSummary
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

    const gRes = googleAdsSection?.reservations || 0;
    const gVal = googleAdsSection?.reservationValue || 0;
    const mRes = metaAdsSection?.reservations || 0;
    const mVal = metaAdsSection?.reservationValue || 0;
    const totalOnlineReservations = gRes + mRes;
    const totalOnlineValue = gVal + mVal;
    const totalAdSpend = (googleAdsSection?.spend || 0) + (metaAdsSection?.spend || 0);
    const onlineCostPct = totalOnlineValue > 0 ? (totalAdSpend / totalOnlineValue) * 100 : 0;
    const metaCampaignsForEmail = Array.isArray((metaSummary as any)?.campaign_data)
      ? (metaSummary as any).campaign_data.filter((c: any) => !c.platform || c.platform === 'meta')
      : [];
    const clientNm = client.name ?? '';
    const totalMicroConversions = getMicroConversionsForOfflineModel(
      clientNm,
      {
        googleFormSubmits: googleAdsSection?.formSubmits || 0,
        googleEmail: googleAdsSection?.emailClicks || 0,
        googlePhone: googleAdsSection?.phoneClicks || 0,
        metaFormSubmits: metaAdsSection?.formSubmits || 0,
        metaEmail: metaAdsSection?.emailClicks || 0,
        metaPhone: metaAdsSection?.phoneClicks || 0
      },
      { metaCampaigns: metaCampaignsForEmail }
    );
    const estimatedOfflineReservations = Math.round(totalMicroConversions * 0.2);
    let avgResVal = totalOnlineReservations > 0 ? totalOnlineValue / totalOnlineReservations : 0;
    if (isBelmonteClient(clientNm) && mRes > 0) {
      avgResVal = mVal / mRes;
    }
    const mSpendForPct = metaAdsSection?.spend || 0;
    const estimatedOfflineValue = isBelmonteClient(clientNm)
      ? getBelmontePotentialOfflineValue(avgResVal)
      : estimatedOfflineReservations * avgResVal;
    const totalValue = isBelmonteClient(clientNm)
      ? estimatedOfflineValue + mVal
      : totalOnlineValue + estimatedOfflineValue;
    const spendForFinalPct = isBelmonteClient(clientNm) ? mSpendForPct || totalAdSpend : totalAdSpend;
    const finalCostPct = totalValue > 0 ? (spendForFinalPct / totalValue) * 100 : 0;

    const publicAppBase =
      (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') || appOrigin;
    const monthlyReportData = {
      dashboardUrl: `${publicAppBase}/dashboard`,
      googleAds: googleAdsSection,
      metaAds: metaAdsSection,
      totalOnlineReservations,
      totalOnlineValue,
      onlineCostPercentage: onlineCostPct,
      totalMicroConversions,
      estimatedOfflineReservations,
      estimatedOfflineValue,
      finalCostPercentage: finalCostPct,
      totalValue
    };
    
    let emailResults = [];
    for (const email of contactEmails) {
      try {
        const emailResult = await emailService.sendClientMonthlyReport(
          email,
          clientId,
          client.name ?? '',
          monthName ?? '',
          year,
          monthlyReportData,
          pdfBuffer,
          undefined,
          internalRecipientOverride ? { reviewRecipientOverride: internalRecipientOverride } : undefined
        );
        emailResults.push({ email, success: emailResult.success, error: emailResult.error });
      } catch (error) {
        emailResults.push({ 
          email, 
          success: false, 
          error: error instanceof Error ? error.message : 'Nieznany błąd' 
        });
      }
    }
    
    // Check if at least one email was sent successfully
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    if (successfulEmails.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to send email to any recipients',
        details: failedEmails.map(f => `${f.email}: ${f.error}`).join(', ')
      }, { status: 500 });
    }

    // Log email sending in database for all emails
    for (const result of emailResults) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'monthly_report',
          recipient_email: result.email,
          subject: `Podsumowanie miesiąca - ${monthName} ${year} | ${client.name}`,
          message_id: result.success ? 'sent' : null,
          sent_at: new Date().toISOString(),
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null
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

    return NextResponse.json({
      success: true,
      message: `Report sent successfully to ${successfulEmails.length} recipient(s)${failedEmails.length > 0 ? `, failed to send to ${failedEmails.length} recipient(s)` : ''}`,
      pdfSize: pdfBuffer ? pdfBuffer.byteLength : 0,
      details: {
        successful: successfulEmails.map(e => e.email),
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