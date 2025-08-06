import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExecutiveSummary {
  id?: string;
  content: string;
  generated_at: string;
  is_ai_generated: boolean;
}

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

      // Check if summary already exists for this client and date range
      const { data: existingSummary } = await supabase
        .from('executive_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('date_range_start', dateRange.start)
        .eq('date_range_end', dateRange.end)
        .single();

      let result;
      if (existingSummary) {
        // Update existing summary
        const { data: updatedSummary, error: updateError } = await supabase
          .from('executive_summaries')
          .update({
            content: summary.content,
            is_ai_generated: summary.is_ai_generated,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSummary.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating executive summary:', updateError);
          return NextResponse.json({ 
            error: 'Failed to update executive summary',
            details: updateError.message
          }, { status: 500 });
        }

        result = updatedSummary;
      } else {
        // Create new summary
        const { data: newSummary, error: insertError } = await supabase
          .from('executive_summaries')
          .insert({
            client_id: clientId,
            date_range_start: dateRange.start,
            date_range_end: dateRange.end,
            content: summary.content,
            is_ai_generated: summary.is_ai_generated,
            generated_at: summary.generated_at || new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating executive summary:', insertError);
          return NextResponse.json({ 
            error: 'Failed to create executive summary',
            details: insertError.message
          }, { status: 500 });
        }

        result = newSummary;
      }

      return NextResponse.json({
        success: true,
        summary: result
      });
    } else {
      // Load existing summary
      const { data: existingSummary, error: loadError } = await supabase
        .from('executive_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('date_range_start', dateRange.start)
        .eq('date_range_end', dateRange.end)
        .single();

      if (loadError && loadError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading executive summary:', loadError);
        return NextResponse.json({ 
          error: 'Failed to load executive summary',
          details: loadError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        summary: existingSummary || null
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