import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FlexibleEmailService } from '../../../../lib/flexible-email';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    // Get email service rate limit status
    const emailService = FlexibleEmailService.getInstance();
    const rateLimitStatus = emailService.getRateLimitStatus();

    // Get recent email statistics from database
    const { data: recentEmails, error: emailStatsError } = await supabase
      .from('email_logs')
      .select('status, sent_at')
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('sent_at', { ascending: false });

    if (emailStatsError) {
      console.error('Error fetching email stats:', emailStatsError);
    }

    // Calculate email statistics
    const emailStats = {
      total: recentEmails?.length || 0,
      successful: recentEmails?.filter(e => e.status === 'sent').length || 0,
      failed: recentEmails?.filter(e => e.status === 'failed').length || 0,
      last24Hours: recentEmails?.length || 0
    };

    // Get bulk email statistics
    const { data: bulkEmails, error: bulkStatsError } = await supabase
      .from('email_logs_bulk')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (bulkStatsError) {
      console.error('Error fetching bulk email stats:', bulkStatsError);
    }

    const bulkStats = {
      operations: bulkEmails?.length || 0,
      totalSent: bulkEmails?.reduce((sum, op) => sum + (op.successful_sends || 0), 0) || 0,
      totalFailed: bulkEmails?.reduce((sum, op) => sum + (op.failed_sends || 0), 0) || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        rateLimitStatus: {
          current: rateLimitStatus.callsInLastMinute,
          limit: rateLimitStatus.maxCallsPerMinute,
          resetInMs: rateLimitStatus.timeSinceLastCall,
          resetInSeconds: Math.ceil(rateLimitStatus.timeSinceLastCall / 1000),
          utilizationPercent: Math.round((rateLimitStatus.callsInLastMinute / rateLimitStatus.maxCallsPerMinute) * 100)
        },
        emailStats,
        bulkStats,
        systemStatus: {
          resendConfigured: !!process.env.RESEND_API_KEY,
          fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Not configured',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching email rate limit status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
