import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../../../lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = authResult;
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get client credentials
    const { data: client, error } = await supabase
      .from('clients')
      .select('email, generated_username, generated_password')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching client credentials:', error);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Return credentials (password will be empty if not generated yet)
    return NextResponse.json({
      username: client.generated_username || client.email,
      password: client.generated_password || ''
    });

  } catch (error) {
    console.error('Error in credentials endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 