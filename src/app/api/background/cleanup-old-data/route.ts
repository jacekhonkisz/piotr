import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SmartDataLoader } from '../../../../lib/smart-data-loader';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // For Vercel cron jobs - bypass authentication
  logger.info('🧹 Old data cleanup triggered by cron job');
  
  try {
    console.log(`🧹 Starting old data cleanup via cron job`);

    // Start background cleanup (don't await to avoid timeout)
    const smartLoader = SmartDataLoader.getInstance();
    smartLoader.cleanupOldData().catch((error: any) => {
      console.error('❌ Background old data cleanup failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Old data cleanup started in background via cron job',
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error starting old data cleanup via cron:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start old data cleanup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  logger.info('🧹 Cleanup old data request started');
  
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

    console.log(`🧹 Starting cleanup by admin ${jwtUser.email}`);

    // Start cleanup (don't await to avoid timeout)
    const smartLoader = SmartDataLoader.getInstance();
    smartLoader.cleanupOldData().catch(error => {
      console.error('❌ Background cleanup failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Cleanup started in background',
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error starting cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start cleanup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 