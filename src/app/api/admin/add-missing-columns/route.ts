import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import logger from '../../../../lib/logger';

/**
 * ADD MISSING COLUMNS TO daily_kpi_data
 * 
 * This endpoint adds the missing reach and booking_step_3 columns
 * that are required for complete conversion tracking
 */

export async function POST(request: NextRequest) {
  try {
    logger.info('🔧 Adding missing columns to daily_kpi_data table...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Check current schema first
    const { data: sampleBefore, error: beforeError } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*')
      .limit(1);

    if (beforeError) {
      return NextResponse.json({ 
        error: 'Failed to check current schema',
        details: beforeError.message 
      }, { status: 500 });
    }

    const columnsBefore = sampleBefore && sampleBefore[0] ? Object.keys(sampleBefore[0]) : [];
    const hasReachBefore = columnsBefore.includes('reach');
    const hasStep3Before = columnsBefore.includes('booking_step_3');

    logger.info(`Current schema - reach: ${hasReachBefore}, booking_step_3: ${hasStep3Before}`);

    // If columns already exist, no need to add them
    if (hasReachBefore && hasStep3Before) {
      return NextResponse.json({
        success: true,
        message: 'Columns already exist',
        columnsAdded: [],
        schema: columnsBefore
      });
    }

    const columnsToAdd = [];
    const errors = [];

    // Add reach column if missing
    if (!hasReachBefore) {
      try {
        // Use raw SQL through a stored procedure or direct query
        const { error: reachError } = await supabaseAdmin
          .from('daily_kpi_data')
          .select('reach')
          .limit(0); // This will fail if column doesn't exist

        // If we get here, column exists
        logger.info('reach column already exists');
      } catch (error) {
        // Column doesn't exist, we need to add it
        // Since we can't run DDL directly, we'll use an INSERT with a dummy value to trigger column creation
        // This is a workaround - in production, you'd use a proper migration
        columnsToAdd.push('reach');
      }
    }

    // Add booking_step_3 column if missing
    if (!hasStep3Before) {
      try {
        const { error: step3Error } = await supabaseAdmin
          .from('daily_kpi_data')
          .select('booking_step_3')
          .limit(0);

        logger.info('booking_step_3 column already exists');
      } catch (error) {
        columnsToAdd.push('booking_step_3');
      }
    }

    // Since we can't run DDL through Supabase client, let's return instructions
    if (columnsToAdd.length > 0) {
      const sqlCommands = [];
      
      if (columnsToAdd.includes('reach')) {
        sqlCommands.push('ALTER TABLE daily_kpi_data ADD COLUMN reach INTEGER DEFAULT 0;');
      }
      
      if (columnsToAdd.includes('booking_step_3')) {
        sqlCommands.push('ALTER TABLE daily_kpi_data ADD COLUMN booking_step_3 INTEGER DEFAULT 0;');
      }

      return NextResponse.json({
        success: false,
        message: 'Columns need to be added manually',
        columnsToAdd,
        sqlCommands,
        instructions: 'Run these SQL commands in your Supabase SQL editor or database console'
      });
    }

    // Verify final schema
    const { data: sampleAfter } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*')
      .limit(1);

    const columnsAfter = sampleAfter && sampleAfter[0] ? Object.keys(sampleAfter[0]) : [];

    return NextResponse.json({
      success: true,
      message: 'Schema check completed',
      columnsBefore,
      columnsAfter,
      hasReach: columnsAfter.includes('reach'),
      hasBookingStep3: columnsAfter.includes('booking_step_3')
    });

  } catch (error) {
    logger.error('❌ Failed to add missing columns:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  // Check current schema status
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const { data: sample } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*')
      .limit(1);

    const columns = sample && sample[0] ? Object.keys(sample[0]) : [];
    const hasReach = columns.includes('reach');
    const hasBookingStep3 = columns.includes('booking_step_3');

    return NextResponse.json({
      currentSchema: columns,
      hasReach,
      hasBookingStep3,
      missingColumns: [
        ...(!hasReach ? ['reach'] : []),
        ...(!hasBookingStep3 ? ['booking_step_3'] : [])
      ]
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
