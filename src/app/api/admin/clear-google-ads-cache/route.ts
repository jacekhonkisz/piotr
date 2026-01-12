import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../../lib/auth-middleware';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await request.json().catch(() => ({}));
    
    const now = new Date();
    const currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    logger.info('🗑️ Clearing Google Ads cache', { clientId, periodId: currentPeriodId });
    
    // Build delete query
    let deleteQuery = supabase
      .from('google_ads_current_month_cache')
      .delete()
      .eq('period_id', currentPeriodId);
    
    // If clientId provided, only clear for that client
    if (clientId) {
      deleteQuery = deleteQuery.eq('client_id', clientId);
    }
    
    const { data, error, count } = await deleteQuery.select();
    
    if (error) {
      logger.error('❌ Failed to clear cache:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    const deletedCount = data?.length || 0;
    
    logger.info(`✅ Cleared ${deletedCount} cache records`, { 
      clientId, 
      periodId: currentPeriodId 
    });
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} cache records`,
      periodId: currentPeriodId,
      clientId: clientId || 'all'
    });
    
  } catch (error: any) {
    logger.error('❌ Error clearing cache:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}

