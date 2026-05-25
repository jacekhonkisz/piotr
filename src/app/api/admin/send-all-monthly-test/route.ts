import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FlexibleEmailService } from '../../../../lib/flexible-email';
import logger from '../../../../lib/logger';
import {
  getBelmontePotentialOfflineValue,
  getMicroConversionsForOfflineModel,
  isBelmonteClient
} from '@/lib/offline-reservation-estimate';
import { googleEmailContactsFromRow, googlePhoneContactsFromRow } from '@/lib/google-ads-contact-metrics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function verifyAdmin(request: NextRequest): Promise<{ userId: string; token: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);

  // Allow service role key for local testing (matches generate-pdf calls)
  if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();
    return adminProfile ? { userId: adminProfile.id, token } : null;
  }

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
    const testRecipient = body.testRecipient || 'jac.honkisz@gmail.com';
    const singleClientId = body.clientId; // optional: test just one client

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const monthNames = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    const monthName = monthNames[lastMonth.getMonth()]!;
    const year = lastMonth.getFullYear();

    let clientsQuery = supabase.from('clients').select('*').eq('admin_id', admin.userId);
    if (singleClientId) {
      clientsQuery = clientsQuery.eq('id', singleClientId);
    }
    const { data: clients, error: clientsError } = await clientsQuery;
    if (clientsError || !clients?.length) {
      return NextResponse.json({ error: 'No clients found', details: clientsError?.message }, { status: 404 });
    }

    const emailService = FlexibleEmailService.getInstance();
    const results: any[] = [];

    for (const client of clients) {
      logger.info(`\n========== Processing ${client.name} (${client.id}) ==========`);

      try {
        // 1) Fetch Meta data from campaign_summaries
        const { data: metaSummary } = await supabase
          .from('campaign_summaries')
          .select('*')
          .eq('client_id', client.id)
          .eq('summary_type', 'monthly')
          .eq('platform', 'meta')
          .eq('summary_date', prevMonthStr)
          .maybeSingle();

        // 2) Fetch Google data from campaign_summaries
        const { data: googleSummary } = await supabase
          .from('campaign_summaries')
          .select('*')
          .eq('client_id', client.id)
          .eq('summary_type', 'monthly')
          .eq('platform', 'google')
          .eq('summary_date', prevMonthStr)
          .maybeSingle();

        // 3) Fetch Google Ads from dedicated table
        const { data: googleAdsSummary } = await supabase
          .from('google_ads_campaign_summaries')
          .select('*')
          .eq('client_id', client.id)
          .eq('period_type', 'monthly')
          .eq('period_start', prevMonthStr)
          .maybeSingle();

        logger.info(`  Meta summary: ${metaSummary ? 'found' : 'none'}, Google summary: ${googleSummary ? 'found' : 'none'}, Google Ads: ${googleAdsSummary ? 'found' : 'none'}`);

        // Build Google Ads data (prefer dedicated table, fall back to campaign_summaries)
        const gData = googleAdsSummary || googleSummary;
        let googleAdsSection: any = undefined;
        if (gData) {
          const gSpend = Number(gData.total_spend || 0);
          const gImpressions = Number(gData.total_impressions || 0);
          const gClicks = Number(gData.total_clicks || 0);
          const gEmailClicks = googleEmailContactsFromRow(gData as Record<string, unknown>);
          const gPhoneClicks = googlePhoneContactsFromRow(gData as Record<string, unknown>);
          const gBooking1 = Number(gData.total_booking_step_1 || gData.booking_step_1 || 0);
          const gBooking2 = Number(gData.total_booking_step_2 || gData.booking_step_2 || 0);
          const gBooking3 = Number(gData.total_booking_step_3 || gData.booking_step_3 || 0);
          const gReservations = Number(gData.total_reservations || gData.reservations || 0);
          const gReservationValue = Number(gData.total_reservation_value || gData.reservation_value || 0);
          const gCpc = gClicks > 0 ? gSpend / gClicks : 0;
          const gCtr = gImpressions > 0 ? (gClicks / gImpressions) * 100 : 0;
          const gRoas = gSpend > 0 ? gReservationValue / gSpend : 0;

          if (gSpend > 0 || gImpressions > 0) {
            googleAdsSection = {
              spend: gSpend,
              impressions: gImpressions,
              clicks: gClicks,
              cpc: gCpc,
              ctr: gCtr,
              emailClicks: gEmailClicks,
              phoneClicks: gPhoneClicks,
              bookingStep1: gBooking1,
              bookingStep2: gBooking2,
              bookingStep3: gBooking3,
              reservations: gReservations,
              reservationValue: gReservationValue,
              roas: gRoas
            };
            logger.info(`  Google Ads: spend=${gSpend}, clicks=${gClicks}, reservations=${gReservations}, value=${gReservationValue}`);
          }
        }

        // Build Meta Ads data
        let metaAdsSection: any = undefined;
        if (metaSummary) {
          const mSpend = Number(metaSummary.total_spend || 0);
          const mImpressions = Number(metaSummary.total_impressions || 0);
          const mClicks = Number(metaSummary.total_clicks || 0);
          const mEmailClicks = Number(metaSummary.email_contacts || 0);
          const mPhoneClicks = Number(metaSummary.click_to_call || 0);
          const mReservations = Number(metaSummary.reservations || 0);
          const mReservationValue = Number(metaSummary.reservation_value || 0);
          const mRoas = mSpend > 0 ? mReservationValue / mSpend : 0;

          if (mSpend > 0 || mImpressions > 0) {
            metaAdsSection = {
              spend: mSpend,
              impressions: mImpressions,
              linkClicks: mClicks,
              emailClicks: mEmailClicks,
              phoneClicks: mPhoneClicks,
              reservations: mReservations,
              reservationValue: mReservationValue,
              roas: mRoas
            };
            logger.info(`  Meta Ads: spend=${mSpend}, clicks=${mClicks}, reservations=${mReservations}, value=${mReservationValue}`);
          }
        }

        // Compute totals for the summary section
        const gResCount = googleAdsSection?.reservations || 0;
        const gResValue = googleAdsSection?.reservationValue || 0;
        const mResCount = metaAdsSection?.reservations || 0;
        const mResValue = metaAdsSection?.reservationValue || 0;
        const totalOnlineReservations = gResCount + mResCount;
        const totalOnlineValue = gResValue + mResValue;

        const totalSpend = (googleAdsSection?.spend || 0) + (metaAdsSection?.spend || 0);
        const onlineCostPct = totalOnlineValue > 0 ? (totalSpend / totalOnlineValue) * 100 : 0;

        const metaCampaignsForEmail = Array.isArray((metaSummary as any)?.campaign_data)
          ? (metaSummary as any).campaign_data.filter((c: any) => !c.platform || c.platform === 'meta')
          : [];
        const clientNm = client.name ?? '';
        const totalMicroConversions = getMicroConversionsForOfflineModel(
          clientNm,
          {
            googleFormSubmits: 0,
            googleEmail: googleAdsSection?.emailClicks || 0,
            googlePhone: googleAdsSection?.phoneClicks || 0,
            metaFormSubmits: 0,
            metaEmail: metaAdsSection?.emailClicks || 0,
            metaPhone: metaAdsSection?.phoneClicks || 0
          },
          { metaCampaigns: metaCampaignsForEmail }
        );

        const estimatedOfflineReservations = Math.round(totalMicroConversions * 0.2);
        let avgReservationValue = totalOnlineReservations > 0 ? totalOnlineValue / totalOnlineReservations : 0;
        if (isBelmonteClient(clientNm) && mResCount > 0) {
          avgReservationValue = mResValue / mResCount;
        }
        const estimatedOfflineValue = isBelmonteClient(clientNm)
          ? getBelmontePotentialOfflineValue(avgReservationValue)
          : estimatedOfflineReservations * avgReservationValue;
        const totalValue = isBelmonteClient(clientNm)
          ? estimatedOfflineValue + mResValue
          : totalOnlineValue + estimatedOfflineValue;
        const mSpendForPct = metaAdsSection?.spend || 0;
        const spendForFinalPct = isBelmonteClient(clientNm) ? mSpendForPct || totalSpend : totalSpend;
        const finalCostPct = totalValue > 0 ? (spendForFinalPct / totalValue) * 100 : 0;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const reportData = {
          dashboardUrl: `${appUrl}/dashboard`,
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

        logger.info(`  Summary: onlineRes=${totalOnlineReservations}, onlineVal=${totalOnlineValue}, microConv=${totalMicroConversions}, totalVal=${totalValue}`);

        // 4) Generate real PDF
        let pdfBuffer: Buffer | null = null;
        try {
          const dateRange = {
            start: lastMonth.toISOString().split('T')[0],
            end: lastMonthEnd.toISOString().split('T')[0]
          };
          const pdfResponse = await fetch(`${appUrl}/api/generate-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${admin.token}`
            },
            body: JSON.stringify({ clientId: client.id, dateRange })
          });

          if (pdfResponse.ok) {
            const contentType = pdfResponse.headers.get('content-type') || '';
            if (contentType.includes('application/pdf')) {
              const ab = await pdfResponse.arrayBuffer();
              pdfBuffer = Buffer.from(ab);
            } else if (contentType.includes('application/json')) {
              const json = await pdfResponse.json();
              if (json.pdf) {
                pdfBuffer = Buffer.from(json.pdf, 'base64');
              }
            }
          }
          logger.info(`  PDF: ${pdfBuffer ? `${(pdfBuffer.length / 1024).toFixed(0)} KB` : 'FAILED'}`);
        } catch (pdfErr) {
          logger.error(`  PDF error: ${pdfErr}`);
        }

        if (!pdfBuffer || pdfBuffer.length === 0) {
          logger.warn(`  Skipping ${client.name} – no PDF generated`);
          results.push({ client: client.name, success: false, error: 'PDF generation failed' });
          continue;
        }

        // 5) Send via SMTP directly (bypass review mode by calling sendEmail directly)
        const template = (emailService as any).generateClientMonthlyReportTemplate(
          client.name,
          monthName,
          year,
          reportData
        );

        const fromAddress = process.env.CUSTOM_SMTP_USER || 'kontakt@piotrbajerlein.pl';
        const fromName = process.env.CUSTOM_SMTP_FROM_NAME || 'Piotr Bajerlein - Raporty';
        const fileName = `Raport_${monthName}_${year}_${client.name.replace(/\s+/g, '_')}.pdf`;

        const emailData = {
          to: testRecipient,
          from: `"${fromName}" <${fromAddress}>`,
          subject: template.subject,
          html: template.html,
          text: template.text,
          attachments: [{
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf' as const
          }]
        };

        // Use custom SMTP transporter directly to bypass review-mode redirect
        const transporter = (emailService as any).customSmtpTransporter;
        if (!transporter) {
          results.push({ client: client.name, success: false, error: 'No custom SMTP configured' });
          continue;
        }

        const info = await transporter.sendMail(emailData);
        logger.info(`  ✅ Sent to ${testRecipient}: ${info.messageId}`);
        results.push({
          client: client.name,
          success: true,
          messageId: info.messageId,
          pdfSize: pdfBuffer.length,
          hasGoogleAds: !!googleAdsSection,
          hasMetaAds: !!metaAdsSection,
          totalValue
        });

      } catch (clientErr: any) {
        logger.error(`  ❌ Error for ${client.name}: ${clientErr.message}`);
        results.push({ client: client.name, success: false, error: clientErr.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      testRecipient,
      period: `${monthName} ${year}`,
      totalClients: clients.length,
      successCount,
      failedCount: clients.length - successCount,
      results
    });

  } catch (err: any) {
    logger.error('send-all-monthly-test error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
