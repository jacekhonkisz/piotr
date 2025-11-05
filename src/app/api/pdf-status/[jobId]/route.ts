import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = params;

    // Get job status
    const { data: job, error } = await supabase
      .from('pdf_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check access (user can only see their own jobs unless admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authResult.user.id)
      .single();

    const { data: client } = await supabase
      .from('clients')
      .select('email')
      .eq('id', job.client_id)
      .single();

    const isOwnJob = client?.email === authResult.user.email;
    const isAdmin = profile?.role === 'admin';

    if (!isOwnJob && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Return job status
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      pdfUrl: job.pdf_url,
      pdfSize: job.pdf_size_bytes,
      error: job.error_message,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      estimatedTimeRemaining: estimateTimeRemaining(job)
    });

  } catch (error) {
    console.error('Error fetching PDF job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Estimate time remaining based on progress
 */
function estimateTimeRemaining(job: any): number | null {
  if (job.status === 'completed' || job.status === 'failed') {
    return 0;
  }

  if (job.status === 'pending') {
    return 30; // Assume 30 seconds for pending jobs
  }

  if (job.status === 'processing' && job.started_at && job.progress > 0) {
    const elapsedMs = Date.now() - new Date(job.started_at).getTime();
    const elapsedSeconds = elapsedMs / 1000;
    
    // Calculate rate: progress per second
    const rate = job.progress / elapsedSeconds;
    
    if (rate > 0) {
      const remainingProgress = 100 - job.progress;
      const remainingSeconds = remainingProgress / rate;
      return Math.ceil(remainingSeconds);
    }
  }

  return 20; // Default estimate
}

