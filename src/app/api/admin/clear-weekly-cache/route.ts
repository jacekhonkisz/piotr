import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.info('🗑️ Clearing corrupted weekly cache data...');
    
    // Get request body
    const body = await request.json();
    const { periodId, clientId } = body;
    
    if (periodId && clientId) {
      // Clear specific period for specific client
      const { error } = await supabase
        .from('current_week_cache')
        .delete()
        .eq('client_id', clientId)
        .eq('period_id', periodId);
        
      if (error) {
        throw error;
      }
      
      logger.info(`✅ Cleared weekly cache for client ${clientId}, period ${periodId}`);
      
      return NextResponse.json({
        success: true,
        message: `Cleared weekly cache for ${periodId}`,
        cleared: { clientId, periodId }
      });
    } else if (periodId) {
      // Clear specific period for all clients
      const { error } = await supabase
        .from('current_week_cache')
        .delete()
        .eq('period_id', periodId);
        
      if (error) {
        throw error;
      }
      
      logger.info(`✅ Cleared weekly cache for all clients, period ${periodId}`);
      
      return NextResponse.json({
        success: true,
        message: `Cleared weekly cache for ${periodId} (all clients)`,
        cleared: { periodId }
      });
    } else {
      // Clear all weekly cache
      const { error } = await supabase
        .from('current_week_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
        
      if (error) {
        throw error;
      }
      
      logger.info('✅ Cleared all weekly cache data');
      
      return NextResponse.json({
        success: true,
        message: 'Cleared all weekly cache data',
        cleared: 'all'
      });
    }
    
  } catch (error: any) {
    logger.error('❌ Failed to clear weekly cache:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to clear weekly cache'
    }, { status: 500 });
  }
}
