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

        const pdfResponse = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(pdfRequestBody)
        });

        if (!pdfResponse.ok) {
          const errorData = await pdfResponse.json();
          console.error('❌ Failed to generate PDF:', errorData);
          throw new Error(errorData.error || 'Failed to generate PDF');
        }

        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        pdfBuffer = Buffer.from(pdfArrayBuffer);
        logger.info('Success', pdfBuffer.byteLength, 'bytes');

        // Generate report data from the same source used for PDF
        const finalTotals = totals || {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0
        };

        const finalCampaigns = campaigns || [];

        // Calculate metrics exactly like the PDF does
        const totalSpend = finalTotals.spend || 0;
        const totalImpressions = finalTotals.impressions || 0;
        const totalClicks = finalTotals.clicks || 0;
        const totalConversions = finalTotals.conversions || 0;
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

        // Generate the same summary (podsumowanie) that appears in the PDF
        reportSummary = generateReportSummary({
          dateRange,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          ctr,
          cpc,
          campaigns: finalCampaigns
        });

        reportData = {
          dateRange: `${dateRange.start} to ${dateRange.end}`,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          ctr: ctr / 100, // Convert to decimal for consistency
          cpc,
          cpm
        };

      } catch (error) {
        console.error('❌ Error generating PDF:', error);
        return NextResponse.json({ 
          error: 'Failed to generate PDF', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
    }

    // Send email to all contact emails
    const emailService = FlexibleEmailService.getInstance();
    const contactEmails = client.contact_emails || [client.email];
    
    let emailResults = [];
    for (const email of contactEmails) {
      try {
        const emailResult = await emailService.sendCustomReportEmail(
          email,
          client.name,
          reportData || {
            dateRange: `${dateRange.start} to ${dateRange.end}`,
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0
          },
          {
            summary: reportSummary,
            customMessage: customMessage || ''
          },
          pdfBuffer
        );
        emailResults.push({ email, success: emailResult.success, error: emailResult.error });

        // Log the email attempt
        await supabase
          .from('email_logs')
          .insert({
            client_id: clientId,
            admin_id: user.id,
            email_type: 'custom_report',
            recipient_email: email,
            subject: `Raport Meta Ads - ${formatDateRange(dateRange)}`,
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