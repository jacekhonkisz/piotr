/**
 * PDF JOB PROCESSOR
 * 
 * Processes PDF generation jobs in the background
 * Allows instant API response while PDF generates asynchronously
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PDFJob {
  id: string;
  client_id: string;
  date_range_start: string;
  date_range_end: string;
  report_id?: string;
}

/**
 * Update job progress
 */
async function updateJobProgress(
  jobId: string,
  progress: number,
  status?: string
): Promise<void> {
  const updates: any = { progress };
  
  if (status) {
    updates.status = status;
    
    if (status === 'processing' && progress === 0) {
      updates.started_at = new Date().toISOString();
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
  }
  
  await supabase
    .from('pdf_generation_jobs')
    .update(updates)
    .eq('id', jobId);
  
  logger.info(`📊 PDF Job ${jobId} progress: ${progress}%`);
}

/**
 * Process a single PDF job
 */
export async function processPDFJob(job: PDFJob): Promise<void> {
  const { id: jobId, client_id: clientId, date_range_start, date_range_end } = job;
  
  logger.info(`🚀 Starting PDF generation for job ${jobId}`);
  
  try {
    // Update status to processing
    await updateJobProgress(jobId, 0, 'processing');
    
    // Step 1: Fetch report data (40% of work)
    logger.info(`📊 Fetching report data for ${clientId}...`);
    await updateJobProgress(jobId, 10);
    
    const reportData = await fetchReportDataForPDF(clientId, {
      start: date_range_start,
      end: date_range_end
    });
    
    await updateJobProgress(jobId, 40);
    
    // Step 2: Generate HTML (20% of work)
    logger.info(`📝 Generating PDF HTML...`);
    const html = await generatePDFHTMLForJob(reportData);
    await updateJobProgress(jobId, 60);
    
    // Step 3: Generate PDF (30% of work)
    logger.info(`🖨️ Rendering PDF...`);
    const pdfBuffer = await generatePDFFromHTML(html);
    await updateJobProgress(jobId, 80);
    
    // Step 4: Upload to storage (10% of work)
    logger.info(`☁️ Uploading PDF to storage...`);
    const { pdfUrl, pdfSize } = await uploadPDFToStorage(pdfBuffer, clientId, {
      start: date_range_start,
      end: date_range_end
    });
    await updateJobProgress(jobId, 95);
    
    // Step 5: Update job as completed
    await supabase
      .from('pdf_generation_jobs')
      .update({
        status: 'completed',
        progress: 100,
        pdf_url: pdfUrl,
        pdf_size_bytes: pdfSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    logger.info(`✅ PDF job ${jobId} completed successfully`);
    
  } catch (error) {
    logger.error(`❌ PDF job ${jobId} failed:`, error);
    
    // Update job as failed
    await supabase
      .from('pdf_generation_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

/**
 * Fetch report data (reuses existing logic)
 */
async function fetchReportDataForPDF(clientId: string, dateRange: { start: string; end: string }): Promise<any> {
  // Import the existing fetch function
  const { default: fetchReportData } = await import('@/app/api/generate-pdf/route');
  
  // Create a minimal request object
  const mockRequest = {
    headers: new Headers(),
    json: async () => ({ clientId, dateRange })
  } as any;
  
  // This is a placeholder - in reality we'd need to refactor fetchReportData
  // to be a standalone function that doesn't depend on NextRequest
  throw new Error('fetchReportDataForPDF needs to be implemented with refactored logic');
}

/**
 * Generate PDF HTML (reuses existing logic)
 */
async function generatePDFHTMLForJob(reportData: any): Promise<string> {
  // Import the existing HTML generator
  throw new Error('generatePDFHTMLForJob needs to be implemented with refactored logic');
}

/**
 * Generate PDF from HTML using puppeteer-core + @sparticuz/chromium (serverless-compatible)
 */
async function generatePDFFromHTML(html: string): Promise<Buffer> {
  const puppeteerCore = await import('puppeteer-core');
  const chromiumModule = await import('@sparticuz/chromium');
  const chromium = chromiumModule.default || chromiumModule;
  
  const isProduction = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';
  
  let executablePath: string | undefined;
  if (isProduction) {
    executablePath = await chromium.executablePath();
  } else {
    const { execSync } = require('child_process');
    try {
      executablePath = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf-8' }).trim();
    } catch {
      const fs = require('fs');
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
      executablePath = macPaths.find((p: string) => fs.existsSync(p));
    }
  }

  if (!executablePath) {
    throw new Error('No Chrome/Chromium executable found');
  }

  const browser = await puppeteerCore.default.launch({
    executablePath,
    headless: true,
    args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Upload PDF to Supabase Storage
 */
async function uploadPDFToStorage(
  pdfBuffer: Buffer,
  clientId: string,
  dateRange: { start: string; end: string }
): Promise<{ pdfUrl: string; pdfSize: number }> {
  const fileName = `report-${clientId}-${dateRange.start}-${dateRange.end}.pdf`;
  const filePath = `pdfs/${clientId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('reports')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('reports')
    .getPublicUrl(filePath);
  
  return {
    pdfUrl: publicUrl,
    pdfSize: pdfBuffer.length
  };
}

/**
 * Queue a PDF job for processing (simple setTimeout for now)
 * In production, use a proper job queue like BullMQ or pg-boss
 */
export function queuePDFJob(job: PDFJob): void {
  // Process immediately in background (non-blocking)
  setTimeout(() => {
    processPDFJob(job).catch((error) => {
      logger.error(`Failed to process PDF job ${job.id}:`, error);
    });
  }, 0);
}

