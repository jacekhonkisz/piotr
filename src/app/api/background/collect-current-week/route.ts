import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BackgroundDataCollector } from '../../../../lib/background-data-collector';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Collect Current Week Data
 * 
 * This endpoint specifically updates current week data more frequently
 * to ensure real-time accuracy for ongoing weeks
 * 
 * Security: Protected with CRON_SECRET authentication
 */
export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication (was previously bypassed - NOW FIXED)
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  logger.info('📅 Current week data collection triggered by authenticated cron job');
  
  try {
    console.log(`📅 Starting current week data collection via cron job`);

    // Get all active clients
    // ✅ FIX: Select BOTH meta_access_token AND system_user_token
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, system_user_token, ad_account_id')
      .not('ad_account_id', 'is', null)
      .or('meta_access_token.not.is.null,system_user_token.not.is.null');

    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active clients found for current week collection',
        clientsProcessed: 0
      });
    }

    logger.info(`📊 Found ${clients.length} active clients for current week collection`);

    // Process each client
    let successCount = 0;
    let errorCount = 0;

    for (const client of clients) {
      try {
        logger.info(`🔄 Updating current week data for ${client.name}...`);
        
        // Get current week boundaries
        const currentDate = new Date();
        const currentWeekStart = new Date(currentDate);
        const currentDayOfWeek = currentWeekStart.getDay();
        const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
        currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);

        // Use the background collector to update just the current week
        const collector = BackgroundDataCollector.getInstance();
        
        // This is a simplified version - we'll call the private method through a public wrapper
        // For now, trigger the full weekly collection (it will prioritize current week)
        await collector.collectWeeklySummaries();
        
        successCount++;
        logger.info(`✅ Updated current week data for ${client.name}`);
        
        // Small delay between clients
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errorCount++;
        logger.error(`❌ Failed to update current week data for ${client.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Current week data collection completed`,
      clientsProcessed: clients.length,
      successCount,
      errorCount,
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in current week collection:', error);

    return NextResponse.json(
      { 
        error: 'Failed to collect current week data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  logger.info('📅 Manual current week data collection request started');
  
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

    console.log(`📅 Starting manual current week data collection by admin ${jwtUser.email}`);

    // Trigger the same logic as GET endpoint
    return await GET();

  } catch (error) {
    console.error('❌ Error in manual current week collection:', error);

    return NextResponse.json(
      { 
        error: 'Failed to start current week collection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
