import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';

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

    // Create a new Supabase client with the user's access token
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get the user from the token
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { clientId, dateRange, summary } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ 
        error: 'Missing required parameters: clientId, dateRange' 
      }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check if user has access to this client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Admin can access any client, client can only access their own
    if (profile.role === 'client' && client.email !== user.email) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // If summary is provided, save/update it
    if (summary) {
      if (!summary.content || typeof summary.content !== 'string') {
        return NextResponse.json({ 
          error: 'Invalid summary content' 
        }, { status: 400 });
      }

      // Use cache service to save summary
      const cacheService = ExecutiveSummaryCacheService.getInstance();
      const result = await cacheService.saveSummary(
        clientId,
        dateRange,
        summary.content,
        summary.is_ai_generated
      );

      if (!result) {
        return NextResponse.json({ 
          error: 'Failed to save executive summary'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        summary: result
      });
    } else {
      // Load existing summary using cache service
      const cacheService = ExecutiveSummaryCacheService.getInstance();
      const existingSummary = await cacheService.getCachedSummary(clientId, dateRange);

      return NextResponse.json({
        success: true,
        summary: existingSummary
      });
    }

  } catch (error) {
    console.error('Error in executive summaries API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 