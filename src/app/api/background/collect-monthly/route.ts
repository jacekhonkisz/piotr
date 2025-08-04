import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BackgroundDataCollector } from '../../../../lib/background-data-collector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('📅 Monthly data collection request started');
  
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a client with the JWT token
    const jwtClient = createClient(
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
    
    // Get user from the JWT token
    const { data: { user: jwtUser }, error: authError } = await jwtClient.auth.getUser();
    
    if (authError || !jwtUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', jwtUser.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied - admin only' }, { status: 403 });
    }

    console.log(`📅 Starting monthly data collection by admin ${jwtUser.email}`);

    // Start background collection (don't await to avoid timeout)
    const collector = BackgroundDataCollector.getInstance();
    collector.collectMonthlySummaries().catch(error => {
      console.error('❌ Background monthly collection failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Monthly data collection started in background',
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error starting monthly collection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start monthly collection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 