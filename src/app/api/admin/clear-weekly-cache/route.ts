import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';
import logger from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * ADMIN ENDPOINT: Clear Weekly Cache
 * 
 * Clears corrupted or stale weekly cache entries
 * Can clear specific week or all weeks
 * 
 * Usage:
 * GET  /api/admin/clear-weekly-cache?week=2025-W47    (clear specific week)
 * GET  /api/admin/clear-weekly-cache?all=true         (clear all weeks)
 * POST /api/admin/clear-weekly-cache                  (clear current week)
 */

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week');
  const clearAll = searchParams.get('all') === 'true';
  const clientId = searchParams.get('clientId');
    
  try {
    logger.info('🗑️ Clear weekly cache request:', { week, clearAll, clientId });

    if (clearAll) {
      // Clear all weekly cache entries
      const { data, error } = await supabaseAdmin
        .from('current_week_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all
        
      if (error) {
        throw error;
      }
      
      logger.info('✅ Cleared all weekly cache entries');
      
      return NextResponse.json({
        success: true,
        message: 'Cleared all weekly cache entries',
        timestamp: new Date().toISOString()
      });

    } else if (week) {
      // Clear specific week
      let query = supabaseAdmin
        .from('current_week_cache')
        .delete()
        .eq('period_id', week);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
        
      if (error) {
        throw error;
      }
      
      logger.info(`✅ Cleared cache for week ${week}`, { clientId });
      
      return NextResponse.json({
        success: true,
        message: `Cleared cache for week ${week}`,
        week,
        clientId,
        timestamp: new Date().toISOString()
      });

    } else {
      // Clear current week
      const currentWeek = getCurrentWeekPeriodId();
      
      let query = supabaseAdmin
        .from('current_week_cache')
        .delete()
        .eq('period_id', currentWeek);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
        
      if (error) {
        throw error;
      }
      
      logger.info(`✅ Cleared cache for current week ${currentWeek}`, { clientId });

      return NextResponse.json({
        success: true,
        message: `Cleared cache for current week`,
        week: currentWeek,
        clientId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('❌ Failed to clear weekly cache:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to clear weekly cache',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { week, clientId, all } = body;

    logger.info('🗑️ Clear weekly cache POST request:', { week, clientId, all });

    if (all) {
      // Clear all
      const { error } = await supabaseAdmin
        .from('current_week_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Cleared all weekly cache entries'
      });

    } else if (week) {
      // Clear specific week
      let query = supabaseAdmin
        .from('current_week_cache')
        .delete()
        .eq('period_id', week);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { error } = await query;
      if (error) throw error;
      
      return NextResponse.json({
        success: true,
        message: `Cleared cache for week ${week}`,
        week,
        clientId
      });

    } else {
      // Clear current week
      const currentWeek = getCurrentWeekPeriodId();
      
      let query = supabaseAdmin
        .from('current_week_cache')
        .delete()
        .eq('period_id', currentWeek);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { error } = await query;
      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Cleared cache for current week`,
        week: currentWeek,
        clientId
      });
    }
    
  } catch (error) {
    logger.error('❌ Failed to clear weekly cache:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to clear weekly cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to get current week period ID
function getCurrentWeekPeriodId(): string {
  const now = new Date();
  const year = now.getFullYear();
  
  // Calculate ISO week number
  const jan4 = new Date(year, 0, 4);
  const startOfYear = new Date(jan4);
  startOfYear.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  
  const weeksDiff = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = weeksDiff + 1;
  
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}
