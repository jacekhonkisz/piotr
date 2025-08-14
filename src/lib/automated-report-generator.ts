/**
 * Automated Report Generation Service
 * Generates and stores reports after periods end
 */

import { createClient } from '@supabase/supabase-js';
import {
  generatePolishSubject,
  generatePolishSummary,
  generatePolishEmailTemplate,
  formatPolishCurrency,
  formatPolishNumber,
  getLastCompleteMonth,
  getLastCompleteWeek,
  isPeriodComplete,
  generatePDFStoragePath
} from './polish-content-generator';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GeneratedReport {
  id: string;
  client_id: string;
  report_type: 'monthly' | 'weekly';
  period_start: string;
  period_end: string;
  polish_summary: string;
  polish_subject: string;
  pdf_url: string | null;
  pdf_size_bytes: number | null;
  pdf_generated_at: string | null;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  generated_at: string;
  status: 'generating' | 'completed' | 'failed';
  error_message: string | null;
}

interface ReportMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
}

/**
 * Check if a report already exists for the given parameters
 */
export async function checkExistingReport(
  clientId: string,
  reportType: 'monthly' | 'weekly',
  periodStart: string,
  periodEnd: string
): Promise<GeneratedReport | null> {
  const { data, error } = await supabase
    .from('generated_reports')
    .select('*')
    .eq('client_id', clientId)
    .eq('report_type', reportType)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned, report doesn't exist
      return null;
    }
    throw error;
  }

  return data as GeneratedReport;
}

/**
 * Fetch campaign data for the specified period
 */
async function fetchCampaignData(clientId: string, periodStart: string, periodEnd: string) {
  logger.info(`📊 Fetching campaign data for client ${clientId} from ${periodStart} to ${periodEnd}`);

  // Try campaign_summaries first (optimized data)
  const { data: summaryData, error: summaryError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', periodStart)
    .lte('date', periodEnd);

  if (!summaryError && summaryData && summaryData.length > 0) {
    logger.info(`✅ Found ${summaryData.length} summary records`);
    return summaryData;
  }

  // Fallback to campaigns table
  logger.info('📊 Falling back to campaigns table...');
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', clientId)
    .gte('date_start', periodStart)
    .lte('date_stop', periodEnd);

  if (campaignError) {
    throw new Error(`Failed to fetch campaign data: ${campaignError.message}`);
  }

  logger.info(`✅ Found ${campaignData?.length || 0} campaign records`);
  return campaignData || [];
}

/**
 * Calculate metrics from campaign data
 */
function calculateMetrics(campaigns: any[]): ReportMetrics {
  const totals = campaigns.reduce(
    (acc, campaign) => {
      acc.totalSpend += parseFloat(campaign.spend || campaign.total_spend || 0);
      acc.totalImpressions += parseInt(campaign.impressions || campaign.total_impressions || 0);
      acc.totalClicks += parseInt(campaign.clicks || campaign.total_clicks || 0);
      acc.totalConversions += parseInt(campaign.conversions || campaign.total_conversions || 0);
      return acc;
    },
    { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 }
  );

  const ctr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
  const cpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
  const cpm = totals.totalImpressions > 0 ? (totals.totalSpend / totals.totalImpressions) * 1000 : 0;
  const cpa = totals.totalConversions > 0 ? totals.totalSpend / totals.totalConversions : 0;

  return {
    totalSpend: totals.totalSpend,
    totalImpressions: totals.totalImpressions,
    totalClicks: totals.totalClicks,
    totalConversions: totals.totalConversions,
    ctr: Math.round(ctr * 100) / 100, // Round to 2 decimal places
    cpc: Math.round(cpc * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    cpa: Math.round(cpa * 100) / 100
  };
}

/**
 * Generate PDF for the report
 */
async function generateReportPDF(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  campaigns: any[]
): Promise<{ pdfBuffer: Buffer; size: number }> {
  logger.info('📄 Generating PDF report...');

  // Call the existing PDF generation API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      clientId,
      dateRange: {
        start: periodStart,
        end: periodEnd
      },
      campaigns: [],
      totals: null,
      client: null,
      metaTables: null
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`PDF generation failed: ${response.status} ${errorData}`);
  }

  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  logger.info(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
  
  return {
    pdfBuffer,
    size: pdfBuffer.length
  };
}

/**
 * Upload PDF to Supabase Storage
 */
async function uploadPDFToStorage(
  pdfBuffer: Buffer,
  clientId: string,
  reportType: string,
  periodStart: string,
  periodEnd: string
): Promise<string> {
  const filePath = generatePDFStoragePath(clientId, reportType, periodStart, periodEnd);
  
  logger.info(`📤 Uploading PDF to storage: ${filePath}`);

  const { data, error } = await supabase.storage
    .from('generated-reports')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true // Overwrite if exists
    });

  if (error) {
    throw new Error(`PDF upload failed: ${error.message}`);
  }

  // Generate public URL
  const { data: urlData } = supabase.storage
    .from('generated-reports')
    .getPublicUrl(filePath);

  logger.info(`✅ PDF uploaded successfully: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Save generated report to database
 */
async function saveGeneratedReport(reportData: {
  clientId: string;
  reportType: 'monthly' | 'weekly';
  periodStart: string;
  periodEnd: string;
  polishSummary: string;
  polishSubject: string;
  pdfUrl: string;
  pdfSize: number;
  metrics: ReportMetrics;
}): Promise<GeneratedReport> {
  logger.info('💾 Saving generated report to database...');

  const { data, error } = await supabase
    .from('generated_reports')
    .insert({
      client_id: reportData.clientId,
      report_type: reportData.reportType,
      period_start: reportData.periodStart,
      period_end: reportData.periodEnd,
      polish_summary: reportData.polishSummary,
      polish_subject: reportData.polishSubject,
      pdf_url: reportData.pdfUrl,
      pdf_size_bytes: reportData.pdfSize,
      pdf_generated_at: new Date().toISOString(),
      total_spend: reportData.metrics.totalSpend,
      total_impressions: reportData.metrics.totalImpressions,
      total_clicks: reportData.metrics.totalClicks,
      total_conversions: reportData.metrics.totalConversions,
      ctr: reportData.metrics.ctr,
      cpc: reportData.metrics.cpc,
      cpm: reportData.metrics.cpm,
      cpa: reportData.metrics.cpa,
      status: 'completed'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save report: ${error.message}`);
  }

  logger.info(`✅ Report saved with ID: ${data.id}`);
  return data as GeneratedReport;
}

/**
 * Main function to generate a complete report for a period
 */
export async function generateReportForPeriod(
  clientId: string,
  reportType: 'monthly' | 'weekly',
  periodStart: string,
  periodEnd: string
): Promise<GeneratedReport> {
  logger.info(`🚀 Starting report generation for client ${clientId}`);
  logger.info(`📅 Period: ${periodStart} to ${periodEnd} (${reportType})`);

  try {
    // 1. Check if report already exists
    const existingReport = await checkExistingReport(clientId, reportType, periodStart, periodEnd);
    if (existingReport) {
      logger.info('✅ Report already exists, returning existing report');
      return existingReport;
    }

    // 2. Set status to generating
    const { data: generatingReport } = await supabase
      .from('generated_reports')
      .insert({
        client_id: clientId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        polish_summary: 'Generowanie w toku...',
        polish_subject: 'Generowanie w toku...',
        total_spend: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cpa: 0,
        status: 'generating'
      })
      .select()
      .single();

    // 3. Fetch client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // 4. Fetch campaign data
    const campaigns = await fetchCampaignData(clientId, periodStart, periodEnd);

    // 5. Calculate metrics
    const metrics = calculateMetrics(campaigns);

    // 6. Generate Polish content
    const polishSubject = generatePolishSubject(reportType, periodStart, periodEnd);
    const polishSummary = generatePolishSummary(metrics, {
      start: periodStart,
      end: periodEnd,
      type: reportType
    });

    // 7. Generate PDF
    const { pdfBuffer, size } = await generateReportPDF(clientId, periodStart, periodEnd, campaigns);

    // 8. Upload PDF to storage
    const pdfUrl = await uploadPDFToStorage(pdfBuffer, clientId, reportType, periodStart, periodEnd);

    // 9. Update the report record with complete data
    const { data: updatedReport, error: updateError } = await supabase
      .from('generated_reports')
      .update({
        polish_summary: polishSummary,
        polish_subject: polishSubject,
        pdf_url: pdfUrl,
        pdf_size_bytes: size,
        pdf_generated_at: new Date().toISOString(),
        total_spend: metrics.totalSpend,
        total_impressions: metrics.totalImpressions,
        total_clicks: metrics.totalClicks,
        total_conversions: metrics.totalConversions,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        cpa: metrics.cpa,
        status: 'completed',
        error_message: null
      })
      .eq('id', generatingReport!.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update report: ${updateError.message}`);
    }

    logger.info('🎉 Report generation completed successfully!');
    return updatedReport as GeneratedReport;

  } catch (error) {
    logger.error('❌ Report generation failed:', error);

    // Update status to failed if we have a record
    try {
      await supabase
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd);
    } catch (updateError) {
      logger.error('Failed to update error status:', updateError);
    }

    throw error;
  }
}

/**
 * Get generated report from database
 */
export async function getGeneratedReport(
  clientId: string,
  reportType: 'monthly' | 'weekly',
  periodStart: string,
  periodEnd: string
): Promise<GeneratedReport | null> {
  return await checkExistingReport(clientId, reportType, periodStart, periodEnd);
}

/**
 * Generate reports for all clients for the last complete month
 */
export async function generateMonthlyReportsForAllClients(): Promise<void> {
  logger.info('📅 Starting monthly report generation for all clients...');

  const { start, end } = getLastCompleteMonth();
  
  // Get all active clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, reporting_frequency')
    .eq('reporting_frequency', 'monthly');

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  logger.info(`👥 Found ${clients?.length || 0} monthly clients`);

  for (const client of clients || []) {
    try {
      logger.info(`🔄 Processing client: ${client.name} (${client.id})`);
      await generateReportForPeriod(client.id, 'monthly', start, end);
      logger.info(`✅ Monthly report completed for ${client.name}`);
    } catch (error) {
      logger.error(`❌ Failed to generate monthly report for ${client.name}:`, error);
    }
  }

  logger.info('🎉 Monthly report generation completed for all clients');
}

/**
 * Generate reports for all clients for the last complete week
 */
export async function generateWeeklyReportsForAllClients(): Promise<void> {
  logger.info('📅 Starting weekly report generation for all clients...');

  const { start, end } = getLastCompleteWeek();
  
  // Get all active clients
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, reporting_frequency')
    .eq('reporting_frequency', 'weekly');

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  logger.info(`👥 Found ${clients?.length || 0} weekly clients`);

  for (const client of clients || []) {
    try {
      logger.info(`🔄 Processing client: ${client.name} (${client.id})`);
      await generateReportForPeriod(client.id, 'weekly', start, end);
      logger.info(`✅ Weekly report completed for ${client.name}`);
    } catch (error) {
      logger.error(`❌ Failed to generate weekly report for ${client.name}:`, error);
    }
  }

  logger.info('🎉 Weekly report generation completed for all clients');
} 