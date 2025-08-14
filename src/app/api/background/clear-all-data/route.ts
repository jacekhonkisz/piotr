import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  logger.info('🧹 Clear all data request started');
  
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

    console.log(`🧹 Starting database clear by admin ${jwtUser.email}`);

    // Get count of existing records before deletion
    const { count: beforeCount, error: countError } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting count:', countError);
    }

    console.log(`📊 Found ${beforeCount || 0} campaign summaries to delete`);

    // Clear all campaign summaries
    const { error: deleteError } = await supabase
      .from('campaign_summaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records (using dummy condition)

    if (deleteError) {
      console.error('Error clearing campaign summaries:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to clear campaign summaries',
        details: deleteError.message 
      }, { status: 500 });
    }

    // Verify deletion
    const { count: afterCount, error: verifyError } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      console.error('Error verifying deletion:', verifyError);
    }

    console.log(`✅ Database cleared successfully. Deleted ${(beforeCount || 0) - (afterCount || 0)} records`);

    return NextResponse.json({
      success: true,
      message: 'All campaign summaries cleared successfully',
      deletedCount: (beforeCount || 0) - (afterCount || 0),
      remainingCount: afterCount || 0,
      clearedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 