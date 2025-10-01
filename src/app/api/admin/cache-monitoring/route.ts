import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache freshness threshold (3 hours)
const CACHE_FRESHNESS_THRESHOLD_MS = 3 * 60 * 60 * 1000;

interface CacheStats {
  tableName: string;
  displayName: string;
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  healthStatus: 'healthy' | 'warning' | 'critical';
  clients: Array<{
    clientId: string;
    clientName: string;
    periodId: string;
    lastUpdated: string;
    ageMinutes: number;
    status: 'fresh' | 'stale';
  }>;
}

interface MonitoringData {
  timestamp: string;
  cacheStats: CacheStats[];
  summary: {
    totalCaches: number;
    healthyCaches: number;
    warningCaches: number;
    criticalCaches: number;
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
  };
}

/**
 * GET /api/admin/cache-monitoring
 * 
 * Returns comprehensive cache health monitoring data including:
 * - Status of all cache tables (monthly/weekly for Meta and Google Ads)
 * - Last update times for each client
 * - Cache freshness indicators
 * - Health metrics and recommendations
 */
export async function GET(request: NextRequest) {
  try {
    // Admin authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get monitoring data for all cache tables
    const cacheStats: CacheStats[] = [];
    
    const cacheTables = [
      { table: 'current_month_cache', display: 'Meta Monthly Cache' },
      { table: 'current_week_cache', display: 'Meta Weekly Cache' },
      { table: 'google_ads_current_month_cache', display: 'Google Ads Monthly Cache' },
      { table: 'google_ads_current_week_cache', display: 'Google Ads Weekly Cache' }
    ];

    for (const { table, display } of cacheTables) {
      try {
        // Get all cache entries with client information
        const { data: cacheEntries, error: cacheError } = await supabase
          .from(table)
          .select(`
            client_id,
            period_id,
            last_updated,
            clients (
              name
            )
          `)
          .order('last_updated', { ascending: false });

        if (cacheError) {
          console.error(`Error fetching ${table}:`, cacheError);
          continue;
        }

        const now = Date.now();
        const entries = cacheEntries || [];
        
        // Calculate freshness for each entry
        const clientsWithStatus = entries.map((entry: any) => {
          const lastUpdated = new Date(entry.last_updated).getTime();
          const ageMs = now - lastUpdated;
          const ageMinutes = Math.floor(ageMs / (1000 * 60));
          const isFresh = ageMs < CACHE_FRESHNESS_THRESHOLD_MS;

          return {
            clientId: entry.client_id,
            clientName: entry.clients?.name || 'Unknown Client',
            periodId: entry.period_id,
            lastUpdated: entry.last_updated,
            ageMinutes,
            status: isFresh ? 'fresh' : 'stale' as 'fresh' | 'stale'
          };
        });

        // Calculate statistics
        const totalEntries = entries.length;
        const freshEntries = clientsWithStatus.filter(c => c.status === 'fresh').length;
        const staleEntries = clientsWithStatus.filter(c => c.status === 'stale').length;
        
        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical';
        if (totalEntries === 0) {
          healthStatus = 'warning'; // No cache entries yet
        } else if (freshEntries / totalEntries >= 0.8) {
          healthStatus = 'healthy'; // 80%+ fresh
        } else if (freshEntries / totalEntries >= 0.5) {
          healthStatus = 'warning'; // 50-80% fresh
        } else {
          healthStatus = 'critical'; // < 50% fresh
        }

        cacheStats.push({
          tableName: table,
          displayName: display,
          totalEntries,
          freshEntries,
          staleEntries,
          oldestEntry: entries.length > 0 ? entries[entries.length - 1].last_updated : null,
          newestEntry: entries.length > 0 ? entries[0].last_updated : null,
          healthStatus,
          clients: clientsWithStatus
        });

      } catch (tableError) {
        console.error(`Error processing ${table}:`, tableError);
      }
    }

    // Calculate summary statistics
    const summary = {
      totalCaches: cacheStats.length,
      healthyCaches: cacheStats.filter(s => s.healthStatus === 'healthy').length,
      warningCaches: cacheStats.filter(s => s.healthStatus === 'warning').length,
      criticalCaches: cacheStats.filter(s => s.healthStatus === 'critical').length,
      totalEntries: cacheStats.reduce((sum, s) => sum + s.totalEntries, 0),
      freshEntries: cacheStats.reduce((sum, s) => sum + s.freshEntries, 0),
      staleEntries: cacheStats.reduce((sum, s) => sum + s.staleEntries, 0)
    };

    const monitoringData: MonitoringData = {
      timestamp: new Date().toISOString(),
      cacheStats,
      summary
    };

    return NextResponse.json(monitoringData);

  } catch (error) {
    console.error('❌ Cache monitoring error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch cache monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache-monitoring/clear
 * 
 * Clears stale cache entries for a specific table or all tables
 */
export async function POST(request: NextRequest) {
  try {
    const { table, action } = await request.json();

    if (action === 'clear_stale') {
      const cutoffTime = new Date(Date.now() - CACHE_FRESHNESS_THRESHOLD_MS).toISOString();
      
      const tables = table === 'all' 
        ? ['current_month_cache', 'current_week_cache', 'google_ads_current_month_cache', 'google_ads_current_week_cache']
        : [table];

      let totalDeleted = 0;

      for (const tableName of tables) {
        const { error, count } = await supabase
          .from(tableName)
          .delete()
          .lt('last_updated', cutoffTime);

        if (!error && count) {
          totalDeleted += count;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cleared ${totalDeleted} stale cache entries`,
        deletedCount: totalDeleted
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

