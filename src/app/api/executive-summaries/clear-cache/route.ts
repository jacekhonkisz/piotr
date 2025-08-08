import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../../lib/executive-summary-cache';

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

    console.log(`🧹 Clearing executive summary cache by admin ${jwtUser.email}`);

    // Get cache statistics before clearing
    const cacheService = ExecutiveSummaryCacheService.getInstance();
    const statsBefore = await cacheService.getCacheStats();

    // Clear all summaries
    const success = await cacheService.clearAllSummaries();

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to clear executive summary cache'
      }, { status: 500 });
    }

    // Get cache statistics after clearing
    const statsAfter = await cacheService.getCacheStats();

    return NextResponse.json({
      success: true,
      message: 'Executive summary cache cleared successfully',
      clearedAt: new Date().toISOString(),
      stats: {
        before: statsBefore,
        after: statsAfter,
        cleared: statsBefore.totalSummaries - statsAfter.totalSummaries
      }
    });

  } catch (error) {
    console.error('❌ Error clearing executive summary cache:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear executive summary cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 