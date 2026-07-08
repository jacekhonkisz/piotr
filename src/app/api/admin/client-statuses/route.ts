import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';
import logger from '../../../../lib/logger';
import { requireAdminAuth } from '../../../../lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/client-statuses
 * 
 * Returns a list of all clients with their current health status.
 * This endpoint is used by the Client Status Dashboard (/admin/client-status).
 * 
 * Returns:
 * - List of clients with verification data
 * - Overall health status for each client
 * - Credentials validation status
 * - Data comparison metrics
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminAuth(request);
  if (!guard.authorized) return guard.response;

  try {
    // Scope to the admin's own clients when we have a user id (JWT); cron/service
    // callers (userId null) see all clients.
    let clientQuery = supabase.from('clients').select('*').order('name', { ascending: true });
    if (guard.userId) {
      clientQuery = clientQuery.eq('admin_id', guard.userId);
    }

    const { data: clients, error: clientsError } = await clientQuery;

    if (clientsError) {
      logger.error('Error fetching clients:', clientsError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    // Generate status for each client (lightweight version)
    const clientStatuses = await Promise.all(
      (clients || []).map(async (client) => {
        try {
          return await generateClientStatus(client);
        } catch (error) {
          logger.error(`Error generating status for client ${client.id}:`, error);
          return generateErrorStatus(client);
        }
      })
    );

    return NextResponse.json({
      success: true,
      clients: clientStatuses,
      total: clientStatuses.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in client-statuses GET API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generate lightweight status information for a client
 */
async function generateClientStatus(client: any) {
  const status = {
    id: client.id,
    name: client.name,
    email: client.email,
    credentials: {
      meta: {
        hasToken: !!client.meta_access_token,
        hasAdAccount: !!client.ad_account_id,
        tokenValid: client.api_status === 'valid',
        accountValid: client.api_status === 'valid',
        error: null as string | null
      },
      googleAds: {
        enabled: !!client.google_ads_enabled,
        hasCustomerId: !!client.google_ads_customer_id,
        systemCredentialsAvailable: !!(
          process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
          process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID
        )
      }
    },
    dataComparison: {
      cache: {
        exists: false,
        ageHours: null as number | null,
        totalSpend: 0,
        lastUpdated: null as string | null
      },
      live: {
        success: false,
        totalSpend: 0,
        campaignCount: 0,
        fetchTime: null as number | null,
        error: null as string | null
      },
      comparison: {
        spendDifference: null as number | null,
        percentageDifference: null as number | null,
        status: 'UNKNOWN' as string
      }
    },
    issues: [] as string[],
    recommendations: [] as string[],
    overallStatus: 'unknown' as 'healthy' | 'warning' | 'critical' | 'unknown'
  };

  // Check cache data
  try {
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (!cacheError && cacheData) {
      status.dataComparison.cache.exists = true;
      status.dataComparison.cache.totalSpend = cacheData.cache_data?.stats?.totalSpend || 0;
      status.dataComparison.cache.lastUpdated = cacheData.last_updated;
      
      const lastUpdated = new Date(cacheData.last_updated);
      status.dataComparison.cache.ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    }
  } catch (error) {
    logger.warn(`Failed to check cache for client ${client.id}:`, error);
  }

  // Generate issues based on current data
  if (!status.credentials.meta.hasToken) {
    status.issues.push('Meta access token is missing');
  }
  if (!status.credentials.meta.hasAdAccount) {
    status.issues.push('Meta ad account ID is missing');
  }
  if (client.token_health_status === 'expired') {
    status.issues.push('Meta token has expired');
  }
  if (client.token_health_status === 'expiring_soon') {
    status.issues.push('Meta token will expire soon');
  }
  if (status.dataComparison.cache.ageHours && status.dataComparison.cache.ageHours > 6) {
    status.issues.push(`Cache is stale (${Math.round(status.dataComparison.cache.ageHours)} hours old)`);
  }
  if (!status.dataComparison.cache.exists) {
    status.issues.push('No cached data available for current month');
  }

  // Calculate overall status
  if (
    client.api_status === 'invalid' || 
    client.api_status === 'expired' ||
    client.token_health_status === 'expired' ||
    client.token_health_status === 'invalid'
  ) {
    status.overallStatus = 'critical';
  } else if (
    status.issues.length > 0 ||
    client.token_health_status === 'expiring_soon' ||
    (status.dataComparison.cache.ageHours && status.dataComparison.cache.ageHours > 6)
  ) {
    status.overallStatus = 'warning';
  } else if (
    status.credentials.meta.tokenValid &&
    status.credentials.meta.hasToken &&
    status.credentials.meta.hasAdAccount
  ) {
    status.overallStatus = 'healthy';
  }

  // Generate recommendations
  if (status.overallStatus === 'critical') {
    status.recommendations.push('Immediate action required: Update credentials');
  }
  if (client.token_health_status === 'expiring_soon') {
    status.recommendations.push('Refresh Meta access token before expiration');
  }
  if (status.dataComparison.cache.ageHours && status.dataComparison.cache.ageHours > 6) {
    status.recommendations.push('Refresh cache to get latest data');
  }
  if (!status.dataComparison.cache.exists) {
    status.recommendations.push('Trigger initial data collection');
  }

  return status;
}

/**
 * Generate error status when client verification fails
 */
function generateErrorStatus(client: any) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    credentials: {
      meta: {
        hasToken: !!client.meta_access_token,
        hasAdAccount: !!client.ad_account_id,
        tokenValid: false,
        accountValid: false,
        error: 'Failed to verify credentials'
      },
      googleAds: {
        enabled: !!client.google_ads_enabled,
        hasCustomerId: !!client.google_ads_customer_id,
        systemCredentialsAvailable: false
      }
    },
    dataComparison: {
      cache: {
        exists: false,
        ageHours: null,
        totalSpend: 0,
        lastUpdated: null
      },
      live: {
        success: false,
        totalSpend: 0,
        campaignCount: 0,
        fetchTime: null,
        error: 'Verification failed'
      },
      comparison: {
        spendDifference: null,
        percentageDifference: null,
        status: 'ERROR'
      }
    },
    issues: ['Failed to verify client status'],
    recommendations: ['Check client credentials and try again'],
    overallStatus: 'critical' as const
  };
}







