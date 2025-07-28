import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Test auth endpoint called');
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid auth header');
      return NextResponse.json({ error: 'No auth header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');

    // Verify the current user
    console.log('Verifying user token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Auth error:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    console.log('User verified:', user.email);
    console.log('User ID:', user.id);

    // Get user profile using admin client to bypass RLS
    console.log('Getting profile with admin client...');
    if (!supabaseAdmin) {
      console.log('Admin client not available');
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 });
    }
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('Profile result:', { profile, error: profileError });

    if (profileError) {
      console.log('Profile error:', profileError.message);
      return NextResponse.json({ error: 'Profile error' }, { status: 500 });
    }

    if (!profile) {
      console.log('No profile found');
      return NextResponse.json({ error: 'No profile' }, { status: 404 });
    }

    console.log('Profile found:', profile.role);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 