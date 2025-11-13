import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = authResult.user;

    // Get Meta system user token from settings table
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'meta_system_user_token')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Meta settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    const tokenValue = settings?.value || '';
    console.log('📤 API returning Meta token:', {
      hasToken: !!tokenValue,
      tokenLength: tokenValue?.length,
      tokenPreview: tokenValue ? tokenValue.substring(0, 20) + '...' : 'empty'
    });

    return NextResponse.json(
      {
        meta_system_user_token: tokenValue,
        lastUpdate: settings?.updated_at || null
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Error in meta-settings GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = authResult.user;

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { meta_system_user_token } = body;

    if (!meta_system_user_token) {
      return NextResponse.json({ error: 'Meta system user token is required' }, { status: 400 });
    }

    // Validate token format
    if (!meta_system_user_token.startsWith('EAA')) {
      return NextResponse.json({ error: 'Invalid Meta token format' }, { status: 400 });
    }

    // Upsert Meta system user token in settings table
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key: 'meta_system_user_token',
        value: meta_system_user_token,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving Meta token:', error);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Meta system user token saved successfully',
      data
    });
  } catch (error) {
    console.error('Error in meta-settings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

