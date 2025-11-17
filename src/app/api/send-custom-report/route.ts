import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../lib/flexible-email';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
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
    const { 
      clientId, 
      dateRange, 
      customMessage, 
      includePdf = true,
      campaigns,
      totals,
      client: directClient,
      metaTables: directMetaTables 
    } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Client ID and date range are required' }, { status: 400 });
    }

    logger.info('📧 Custom Report Email Request:', { 
      clientId, 
      dateRange, 
      includePdf,
      customMessage: !!customMessage 
    });

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

    let pdfBuffer: Buffer | undefined;
    let reportSummary = '';
    let reportData = null;

    // Generate PDF and extract summary if requested
    if (includePdf) {
      try {
        logger.info('🔄 Generating PDF for client:', client.name);
        
        const pdfRequestBody = {
          clientId: client.id,
          dateRange,
          campaigns,
          totals,
          client: directClient || client,
          metaTables: directMetaTables
        };

        // FIXED APPROACH: Get PDF directly (smaller, reliable) and AI summary separately
        const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
            // NO Accept header - get direct PDF (1.8MB instead of 3.2MB)
          },
          body: JSON.stringify(pdfRequestBody)
        });

        if (!pdfResponse.ok) {
          const errorText = await pdfResponse.text();
          console.error('❌ Failed to generate PDF:', pdfResponse.status, errorText);
          throw new Error(`Failed to generate PDF: ${pdfResponse.status}`);
        }

        // Get PDF as direct buffer (reliable, smaller size)
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        pdfBuffer = Buffer.from(pdfArrayBuffer);
        
        // Get AI summary separately using JSON API
        const aiSummaryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json' // Request JSON for AI summary only
          },
          body: JSON.stringify(pdfRequestBody)
        });

        if (aiSummaryResponse.ok) {
          const aiResult = await aiSummaryResponse.json();
          if (aiResult.success && aiResult.aiSummary) {
            reportSummary = aiResult.aiSummary;
          }
        }
        
        logger.info('✅ UNIFIED PDF and AI summary generated:', {
          pdfSize: pdfBuffer.byteLength,
          hasAiSummary: !!reportSummary,
          aiSummaryLength: reportSummary.length,
          aiSummaryPreview: reportSummary.substring(0, 50) || 'No AI summary'
        });

        // AI summary already extracted from PDF generation above (reportSummary)
        logger.info('✅ Using AI summary directly from PDF generation - no separate fetch needed');
        
        // Get report data for email metrics (without AI summary generation)
        let pdfReportData = null;
        try {
          const dataResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/get-report-data-only`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              clientId,
              dateRange
            })
          });

          if (dataResponse.ok) {
            const dataResult = await dataResponse.json();
            pdfReportData = dataResult.data;
            logger.info('✅ Report data fetched for email metrics (AI summary from PDF)');
          }
        } catch (error) {
          logger.warn('⚠️ Error fetching report data for email metrics:', error);
        }
        
        // Use the data for email metrics
        const metaData: any = pdfReportData?.metaData;
        const googleData: any = pdfReportData?.googleData;
        
        // Calculate combined metrics using the same structure as PDF
        const metaSpend = metaData?.metrics?.totalSpend || 0;
        const googleSpend = googleData?.metrics?.totalSpend || 0;
        const totalSpend = metaSpend + googleSpend;
        
        const metaImpressions = metaData?.metrics?.totalImpressions || 0;
        const googleImpressions = googleData?.metrics?.totalImpressions || 0;
        const totalImpressions = metaImpressions + googleImpressions;
        
        const metaClicks = metaData?.metrics?.totalClicks || 0;
        const googleClicks = googleData?.metrics?.totalClicks || 0;
        const totalClicks = metaClicks + googleClicks;
        
        const metaConversions = metaData?.metrics?.totalConversions || 0;
        const googleConversions = googleData?.metrics?.totalConversions || 0;
        const totalConversions = metaConversions + googleConversions;
        
        const metaReservations = metaData?.metrics?.totalReservations || 0;
        const googleReservations = googleData?.metrics?.totalReservations || 0;
        const totalReservations = metaReservations + googleReservations;
        
        const metaReservationValue = metaData?.metrics?.totalReservationValue || 0;
        const googleReservationValue = googleData?.metrics?.totalReservationValue || 0;
        const totalReservationValue = metaReservationValue + googleReservationValue;
        
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

        logger.info('✅ Combined data calculated:', {
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          totalReservations,
          totalReservationValue,
          hasMetaData: !!metaData,
          hasGoogleData: !!googleData
        });

        // Generate AI summary with platform breakdown (same as PDF)
        // Determine platform attribution and breakdown
        const hasMetaData = metaData && (metaData.metrics?.totalSpend || 0) > 0;
        const hasGoogleData = googleData && (googleData.metrics?.totalSpend || 0) > 0;
        
        let platformAttribution = 'kampanie reklamowe';
        let platformSources: string[] = [];
        let platformBreakdown: any = null;
        
        if (hasMetaData && hasGoogleData) {
          platformAttribution = 'kampanie Meta Ads i Google Ads';
          platformSources = ['meta', 'google'];
          platformBreakdown = {
            meta: {
              spend: metaData?.metrics?.totalSpend || 0,
              impressions: metaData?.metrics?.totalImpressions || 0,
              clicks: metaData?.metrics?.totalClicks || 0,
              conversions: metaData?.metrics?.totalConversions || 0,
              reservations: metaData?.metrics?.totalReservations || 0,
              reservationValue: metaData?.metrics?.totalReservationValue || 0
            },
            google: {
              spend: googleData?.metrics?.totalSpend || 0,
              impressions: googleData?.metrics?.totalImpressions || 0,
              clicks: googleData?.metrics?.totalClicks || 0,
              conversions: googleData?.metrics?.totalConversions || 0,
              reservations: googleData?.metrics?.totalReservations || 0,
              reservationValue: googleData?.metrics?.totalReservationValue || 0
            }
          };
        } else if (hasMetaData) {
          platformAttribution = 'kampanie Meta Ads';
          platformSources = ['meta'];
        } else if (hasGoogleData) {
          platformAttribution = 'kampanie Google Ads';
          platformSources = ['google'];
        }
        
        // AI summary already extracted from PDF generation above (reportSummary)
        // No need for additional AI generation - we have the EXACT same summary as PDF
        if (!reportSummary) {
          // Only use manual fallback if PDF generation didn't provide AI summary
          reportSummary = `W okresie od ${dateRange.start} do ${dateRange.end} przeprowadziliśmy ${platformAttribution} o łącznym budżecie ${totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}. Kampanie wygenerowały ${totalImpressions.toLocaleString('pl-PL')} wyświetleń i ${totalClicks.toLocaleString('pl-PL')} kliknięć, osiągając CTR na poziomie ${ctr.toFixed(2)}%. Działania reklamowe przyniosły ${totalReservations} rezerwacji o łącznej wartości ${totalReservationValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}, co dało ROAS na poziomie ${totalSpend > 0 ? (totalReservationValue / totalSpend).toFixed(2) : 0}x.`;
          logger.warn('⚠️ Using manual fallback summary - PDF generation did not provide AI summary');
        }
        
        logger.info('✅ Using AI summary directly from PDF generation:', { 
          length: reportSummary.length,
          hasAiSummary: !!reportSummary,
          summaryPreview: reportSummary.substring(0, 100)
        });

        reportData = {
          dateRange: `${dateRange.start} to ${dateRange.end}`,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          ctr: ctr, // Keep as percentage for display
          cpc,
          cpm,
          reservations: totalReservations,
          reservationValue: totalReservationValue,
          // Separate platform data for email templates
          metaData: metaData ? {
            spend: metaSpend,
            impressions: metaImpressions,
            clicks: metaClicks,
            conversions: metaConversions,
            ctr: metaImpressions > 0 ? (metaClicks / metaImpressions) : 0,
            cpc: metaClicks > 0 ? (metaSpend / metaClicks) : 0,
            cpm: metaImpressions > 0 ? (metaSpend / metaImpressions * 1000) : 0,
            reservations: metaReservations,
            reservationValue: metaReservationValue
          } : undefined,
          googleData: googleData ? {
            spend: googleSpend,
            impressions: googleImpressions,
            clicks: googleClicks,
            conversions: googleConversions,
            ctr: googleImpressions > 0 ? (googleClicks / googleImpressions) : 0,
            cpc: googleClicks > 0 ? (googleSpend / googleClicks) : 0,
            cpm: googleImpressions > 0 ? (googleSpend / googleImpressions * 1000) : 0,
            reservations: googleReservations,
            reservationValue: googleReservationValue
          } : undefined
        };

      } catch (error) {
        console.error('❌ Error generating PDF:', error);
        return NextResponse.json({ 
          error: 'Failed to generate PDF', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
    }

    // Send email to all contact emails using NEW MONTHLY TEMPLATE
    const emailService = FlexibleEmailService.getInstance();
    const contactEmails = client.contact_emails || [client.email];
    
    // Extract month and year from date range for NEW template
    const startDate = new Date(dateRange.start);
    const monthNames = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    const monthName = monthNames[startDate.getMonth()];
    const year = startDate.getFullYear();
    
    // Prepare NEW monthly report data (simplified for now - real data would come from fetcher)
    const monthlyReportData = {
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      totalOnlineReservations: 0,
      totalOnlineValue: 0,
      onlineCostPercentage: 0,
      totalMicroConversions: 0,
      estimatedOfflineReservations: 0,
      estimatedOfflineValue: 0,
      finalCostPercentage: 0,
      totalValue: 0
    };
    
    let emailResults = [];
    for (const email of contactEmails) {
      try {
        const emailResult = await emailService.sendClientMonthlyReport(
          email,
          clientId,
          client.name,
          monthName,
          year,
          monthlyReportData,
          pdfBuffer
        );
        emailResults.push({ email, success: emailResult.success, error: emailResult.error });

        // Log the email attempt
        await supabase
          .from('email_logs')
          .insert({
            client_id: clientId,
            admin_id: user.id,
            email_type: 'monthly_report',
            recipient_email: email,
            subject: `Podsumowanie miesiąca - ${monthName} ${year} | ${client.name}`,
            message_id: emailResult.messageId,
            sent_at: new Date().toISOString(),
            status: emailResult.success ? 'sent' : 'failed',
            error_message: emailResult.error || null
          });

      } catch (error) {
        emailResults.push({ 
          email, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
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

    return NextResponse.json({
      success: true,
      message: `Report sent successfully to ${successfulEmails.length} recipient(s)`,
      sentTo: successfulEmails.map(r => r.email),
      failed: failedEmails.length > 0 ? failedEmails.map(f => ({ email: f.email, error: f.error })) : undefined
    });

  } catch (error) {
    console.error('❌ Error in send-custom-report:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Helper function to generate the same summary (podsumowanie) as in PDF
function generateReportSummary(data: {
  dateRange: { start: string; end: string };
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  campaigns: any[];
}): string {
  const { dateRange, totalSpend, totalImpressions, totalClicks, totalConversions, ctr, cpc } = data;
  
  // Detect if it's weekly or monthly
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isWeekly = daysDiff === 7;
  const periodLabel = isWeekly ? 'tygodniu' : 'miesiącu';
  
  // Format dates in Polish
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { 
      style: 'currency', 
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format numbers
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(value));
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('pl-PL', { 
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  };

  const summaryParts = [];
  
  const startDateFormatted = formatDate(dateRange.start);
  const endDateFormatted = formatDate(dateRange.end);
  
  summaryParts.push(`W ${periodLabel} od ${startDateFormatted} do ${endDateFormatted} wydaliśmy na kampanie reklamowe ${formatCurrency(totalSpend)}.`);
  
  if (totalImpressions > 0) {
    summaryParts.push(`Działania te zaowocowały ${formatNumber(totalImpressions)} wyświetleniami`);
    if (totalClicks > 0) {
      summaryParts.push(`a liczba kliknięć wyniosła ${formatNumber(totalClicks)}, co dało CTR na poziomie ${formatPercentage(ctr)}.`);
      summaryParts.push(`Średni koszt kliknięcia (CPC) wyniósł ${formatCurrency(cpc)}.`);
    } else {
      summaryParts.push('.');
    }
  }
  
  if (totalConversions > 0) {
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;
    summaryParts.push(`W tym okresie zaobserwowaliśmy ${formatNumber(totalConversions)} konwersje, co przekłada się na koszt pozyskania konwersji (CPA) na poziomie ${formatCurrency(costPerConversion)}.`);
  }
  
  return summaryParts.join(' ');
}

// Helper function to format date range for subject
function formatDateRange(dateRange: { start: string; end: string }): string {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (daysDiff === 7) {
    // Weekly report
    return `Tydzień ${startDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } else if (daysDiff >= 28 && daysDiff <= 31) {
    // Monthly report
    return startDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  } else {
    // Custom range
    return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
  }
} 