/**
 * ASYNC PDF GENERATION API
 * 
 * Returns immediately with a job ID
 * PDF generates in the background
 * Client polls /api/pdf-status/[jobId] for progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth-middleware';
import { queuePDFJob } from '@/lib/pdf-job-processor';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  logger.info('🚀 Async PDF Generation Request (instant response)');

  // 🔒 Apply rate limiting
  const { applyRateLimit, defaultRateLimiters } = await import('@/lib/api-rate-limiter');
  const rateLimitResponse = await applyRateLimit(request, defaultRateLimiters.pdf);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    
    // Validate required parameters
    if (!body.clientId || !body.dateRange) {
      return NextResponse.json(
        { error: 'Missing required parameters: clientId and dateRange' },
        { status: 400 }
      );
    }

    const { clientId, dateRange } = body;
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to this client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Check if user can access this client
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authResult.user.id)
      .single();

    const isOwnClient = client.email === authResult.user.email;
    const isAdmin = profile?.role === 'admin';

    if (!isOwnClient && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check for existing pending/processing job
    const { data: existingJob } = await supabase
      .from('pdf_generation_jobs')
      .select('*')
      .eq('client_id', clientId)
      .eq('date_range_start', dateRange.start)
      .eq('date_range_end', dateRange.end)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existingJob) {
      logger.info(`♻️ Returning existing job ${existingJob.id}`);
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'PDF generation already in progress',
        pollUrl: `/api/pdf-status/${existingJob.id}`
      });
    }

    // Create new job
    const { data: newJob, error: jobError } = await supabase
      .from('pdf_generation_jobs')
      .insert({
        client_id: clientId,
        date_range_start: dateRange.start,
        date_range_end: dateRange.end,
        status: 'pending',
        progress: 0
      })
      .select()
      .single();

    if (jobError || !newJob) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    logger.info(`✅ Created PDF job ${newJob.id} - queuing for processing`);

    // Queue job for background processing
    queuePDFJob({
      id: newJob.id,
      client_id: clientId,
      date_range_start: dateRange.start,
      date_range_end: dateRange.end
    });

    // Return immediately with job ID
    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      status: 'pending',
      message: 'PDF generation started',
      pollUrl: `/api/pdf-status/${newJob.id}`,
      estimatedTime: 30 // seconds
    });

  } catch (error) {
    logger.error('Error creating PDF job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start PDF generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

