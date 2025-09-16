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
    const { clientId, reportId, includePdf } = await request.json();

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
    
    // Define date range for API calls
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // Last 30 days
    
    if (reportData && reportData.report_data) {
      // Use stored report data if available
      const storedData = reportData.report_data;
      const campaigns = storedData.campaigns || [];
      const stats = storedData.account_summary || {};
      const conversionMetrics = storedData.conversionMetrics || {};
      
      // Calculate new metrics using same logic as WeeklyReportView
      const totalEmailContacts = campaigns.reduce((sum: number, c: any) => sum + (c.email_contacts || 0), 0);
      const totalPhoneContacts = campaigns.reduce((sum: number, c: any) => sum + (c.click_to_call || 0), 0);
      const potentialOfflineReservations = Math.round((totalEmailContacts + totalPhoneContacts) * 0.2);
      
      const totalReservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
      const totalReservations = campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0);
      const averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
      const potentialOfflineValue = potentialOfflineReservations * averageReservationValue;
      const totalPotentialValue = potentialOfflineValue + totalReservationValue;
      const costPercentage = totalPotentialValue > 0 ? (stats.totalSpend / totalPotentialValue) * 100 : 0;
      
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
        
        const fetchResult = await StandardizedDataFetcher.fetchData({
          clientId: client.id,
          dateRange: {
            start: startDate.toISOString().split('T')[0]!,
            end: endDate.toISOString().split('T')[0]!
          },
          platform: 'meta',
          reason: 'email-report-generation'
        });
        
        if (fetchResult.success && fetchResult.data) {
          const data = fetchResult.data;
          const campaigns = data.campaigns || [];
          const stats = data.stats || {};
          const conversionMetrics = data.conversionMetrics || {};
          
          // Calculate new metrics using same logic as WeeklyReportView
          const totalEmailContacts = campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0);
          const totalPhoneContacts = campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0);
          const potentialOfflineReservations = Math.round((totalEmailContacts + totalPhoneContacts) * 0.2);
          
          const totalReservationValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
          const totalReservations = campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
          const averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
          const potentialOfflineValue = potentialOfflineReservations * averageReservationValue;
          const totalPotentialValue = potentialOfflineValue + totalReservationValue;
          const costPercentage = totalPotentialValue > 0 ? (stats.totalSpend / totalPotentialValue) * 100 : 0;
          
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
        const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // NO Accept header - get direct PDF (1.8MB instead of 3.2MB)
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
          const aiSummaryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json' // Request JSON for AI summary only
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
        
        const aiSummaryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json' // Request JSON response with AI summary
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

    // Send email to all contact emails
    const emailService = FlexibleEmailService.getInstance();
    const contactEmails = client.contact_emails || [client.email];
    
    let emailResults = [];
    for (const email of contactEmails) {
      try {
        const emailResult = await emailService.sendReportEmail(
          email,
          client.name,
          realReportData,
          pdfBuffer,
          undefined, // provider (auto-detect)
          aiSummary
        );
        emailResults.push({ email, success: emailResult.success, error: emailResult.error });
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

    // Log email sending in database for all emails
    for (const result of emailResults) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'report',
          recipient_email: result.email,
          subject: `Your Meta Ads Report - ${realReportData.dateRange}`,
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