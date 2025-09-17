import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🔍 Verifying send_day migration status...');

    // Check system settings
    const { data: systemSettings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['default_reporting_day', 'global_default_send_day', 'migration_022_applied'])
      .order('key');

    if (settingsError) {
      throw new Error(`Failed to fetch system settings: ${settingsError.message}`);
    }

    // Check for NULL send_day values in clients
    const { data: nullSendDayClients, error: nullError } = await supabase
      .from('clients')
      .select('id, name, email, reporting_frequency, send_day')
      .in('reporting_frequency', ['monthly', 'weekly'])
      .is('send_day', null);

    if (nullError) {
      throw new Error(`Failed to check NULL send_day values: ${nullError.message}`);
    }

    // Get send_day distribution
    const { data: sendDayDistribution, error: distError } = await supabase
      .from('clients')
      .select('reporting_frequency, send_day')
      .not('reporting_frequency', 'eq', 'on_demand');

    if (distError) {
      throw new Error(`Failed to get send_day distribution: ${distError.message}`);
    }

    // Calculate distribution stats
    const distribution: Record<string, Record<string, number>> = {};
    sendDayDistribution?.forEach(client => {
      const freq = client.reporting_frequency || 'unknown';
      const day = client.send_day?.toString() || 'null';
      
      if (!distribution[freq]) distribution[freq] = {};
      distribution[freq][day] = (distribution[freq][day] || 0) + 1;
    });

    // Check total clients
    const { count: totalClients, error: countError } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count clients: ${countError.message}`);
    }

    const migrationApplied = systemSettings?.find(s => s.key === 'migration_022_applied')?.value === true || 
                            systemSettings?.find(s => s.key === 'migration_022_applied')?.value === 'true';
    const defaultReportingDay = systemSettings?.find(s => s.key === 'default_reporting_day')?.value;
    const globalDefaultSendDay = systemSettings?.find(s => s.key === 'global_default_send_day')?.value;

    const result = {
      success: true,
      migrationStatus: {
        applied: migrationApplied,
        defaultReportingDay: defaultReportingDay ? parseInt(defaultReportingDay) : null,
        globalDefaultSendDay: globalDefaultSendDay ? parseInt(globalDefaultSendDay) : null
      },
      dataStatus: {
        totalClients: totalClients || 0,
        clientsWithNullSendDay: nullSendDayClients?.length || 0,
        nullSendDayClients: nullSendDayClients || [],
        sendDayDistribution: distribution
      },
      systemSettings: systemSettings || [],
      issues: [] as string[]
    };

    // Identify issues
    if (!migrationApplied) {
      result.issues.push('Migration 022 has not been applied');
    }

    if (parseInt(defaultReportingDay || '0') !== 5) {
      result.issues.push(`default_reporting_day is ${defaultReportingDay}, expected 5`);
    }

    if (parseInt(globalDefaultSendDay || '0') !== 5) {
      result.issues.push(`global_default_send_day is ${globalDefaultSendDay}, expected 5`);
    }

    if ((nullSendDayClients?.length || 0) > 0) {
      result.issues.push(`Found ${nullSendDayClients?.length} clients with NULL send_day values`);
    }

    console.log('✅ Migration verification complete:', {
      migrationApplied,
      totalClients: totalClients || 0,
      nullSendDayCount: nullSendDayClients?.length || 0,
      issuesFound: result.issues.length
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      migrationStatus: null,
      dataStatus: null
    }, { status: 500 });
  }
}
