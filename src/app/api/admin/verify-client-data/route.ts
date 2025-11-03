import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Admin endpoint to verify client data integrity
 * Compares cached data with live API data for accuracy verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientName, forceLive = false } = body;

    logger.info('🔍 Admin data verification requested', { clientId, clientName, forceLive });

    // Find client
    let client;
    if (clientId) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ 
          success: false, 
          error: 'Client not found' 
        }, { status: 404 });
      }
      client = data;
    } else if (clientName) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${clientName}%,email.ilike.%${clientName}%`)
        .limit(1);
      
      if (error || !data || data.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Client not found' 
        }, { status: 404 });
      }
      client = data[0];
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'clientId or clientName required' 
      }, { status: 400 });
    }

    logger.info('✅ Client found', { 
      id: client.id, 
      name: client.name, 
      email: client.email 
    });

    // Verify client data
    const verification = await verifyClientDataIntegrity(client, forceLive);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        email: client.email
      },
      verification,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Admin data verification failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function verifyClientDataIntegrity(client: any, forceLive: boolean = false) {
  const verification = {
    credentials: {
      meta: {
        hasToken: false,
        hasAdAccount: false,
        tokenValid: false,
        accountValid: false,
        error: null
      },
      googleAds: {
        enabled: false,
        hasCustomerId: false,
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
        error: null
      },
      comparison: {
        spendDifference: null,
        percentageDifference: null,
        status: 'UNKNOWN'
      }
    },
    issues: [] as string[],
    recommendations: [] as string[]
  };

  try {
    // 1. Verify Meta credentials
    await verifyMetaCredentials(client, verification);

    // 2. Verify Google Ads setup
    await verifyGoogleAdsSetup(client, verification);

    // 3. Compare data sources
    await compareDataSources(client, verification, forceLive);

    // 4. Generate recommendations
    generateRecommendations(verification);

  } catch (error) {
    verification.issues.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return verification;
}

async function verifyMetaCredentials(client: any, verification: any) {
  verification.credentials.meta.hasToken = !!client.meta_access_token;
  verification.credentials.meta.hasAdAccount = !!client.ad_account_id;

  if (!verification.credentials.meta.hasToken) {
    verification.issues.push('Meta access token is missing');
    return;
  }

  if (!verification.credentials.meta.hasAdAccount) {
    verification.issues.push('Meta ad account ID is missing');
    return;
  }

  try {
    const metaService = new MetaAPIService(client.meta_access_token);

    // Validate token
    const tokenValidation = await metaService.validateToken();
    verification.credentials.meta.tokenValid = tokenValidation.valid;

    if (!tokenValidation.valid) {
      verification.credentials.meta.error = tokenValidation.error;
      verification.issues.push(`Meta token validation failed: ${tokenValidation.error}`);
      return;
    }

    // Validate ad account
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const accountValidation = await metaService.validateAdAccount(adAccountId);
    verification.credentials.meta.accountValid = accountValidation.valid;

    if (!accountValidation.valid) {
      verification.credentials.meta.error = accountValidation.error;
      verification.issues.push(`Meta ad account validation failed: ${accountValidation.error}`);
    }

  } catch (error) {
    verification.credentials.meta.error = error instanceof Error ? error.message : 'Unknown error';
    verification.issues.push(`Meta API error: ${verification.credentials.meta.error}`);
  }
}

async function verifyGoogleAdsSetup(client: any, verification: any) {
  verification.credentials.googleAds.enabled = !!client.google_ads_enabled;
  verification.credentials.googleAds.hasCustomerId = !!client.google_ads_customer_id;

  if (!verification.credentials.googleAds.enabled) {
    return; // Google Ads not enabled - this is OK
  }

  if (!verification.credentials.googleAds.hasCustomerId) {
    verification.issues.push('Google Ads enabled but customer ID is missing');
    return;
  }

  try {
    // Check if system credentials are available
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    if (error || !settings || settings.length < 4) {
      verification.issues.push('Google Ads system credentials not configured');
      return;
    }

    verification.credentials.googleAds.systemCredentialsAvailable = true;

  } catch (error) {
    verification.issues.push(`Google Ads setup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function compareDataSources(client: any, verification: any, forceLive: boolean) {
  try {
    // 1. Check cached data
    const now = new Date();
    const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (!cacheError && cacheData) {
      verification.dataComparison.cache.exists = true;
      verification.dataComparison.cache.totalSpend = cacheData.cache_data?.stats?.totalSpend || 0;
      verification.dataComparison.cache.lastUpdated = cacheData.last_updated;
      
      const lastUpdated = new Date(cacheData.last_updated);
      verification.dataComparison.cache.ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
    }

    // 2. Get live data if requested or if cache is stale/missing
    const shouldFetchLive = forceLive || 
                           !verification.dataComparison.cache.exists || 
                           verification.dataComparison.cache.ageHours > 6;

    if (shouldFetchLive && verification.credentials.meta.tokenValid && verification.credentials.meta.accountValid) {
      const startTime = Date.now();
      
      try {
        const metaService = new MetaAPIService(client.meta_access_token);
        
        const adAccountId = client.ad_account_id.startsWith('act_') 
          ? client.ad_account_id.substring(4)
          : client.ad_account_id;

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const campaigns = await metaService.getCampaignInsights(
          adAccountId,
          startOfMonth.toISOString().split('T')[0] || '',
          now.toISOString().split('T')[0] || '',
          0
        );

        verification.dataComparison.live.success = true;
        verification.dataComparison.live.totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
        verification.dataComparison.live.campaignCount = campaigns.length;
        verification.dataComparison.live.fetchTime = Date.now() - startTime;

      } catch (error) {
        verification.dataComparison.live.error = error instanceof Error ? error.message : 'Unknown error';
        verification.issues.push(`Live data fetch failed: ${verification.dataComparison.live.error}`);
      }
    }

    // 3. Compare data if both sources available
    if (verification.dataComparison.cache.exists && verification.dataComparison.live.success) {
      const cacheSpend = verification.dataComparison.cache.totalSpend;
      const liveSpend = verification.dataComparison.live.totalSpend;
      const spendDifference = Math.abs(cacheSpend - liveSpend);
      const percentageDifference = cacheSpend > 0 ? (spendDifference / cacheSpend) * 100 : 0;

      verification.dataComparison.comparison.spendDifference = spendDifference;
      verification.dataComparison.comparison.percentageDifference = percentageDifference;

      if (percentageDifference < 2) {
        verification.dataComparison.comparison.status = 'ACCURATE';
      } else if (percentageDifference < 10) {
        verification.dataComparison.comparison.status = 'MINOR_DIFFERENCE';
      } else {
        verification.dataComparison.comparison.status = 'SIGNIFICANT_DIFFERENCE';
        verification.issues.push(`Significant difference between cache (${cacheSpend.toFixed(2)}) and live data (${liveSpend.toFixed(2)})`);
      }
    }

    // 4. Check cache freshness
    if (verification.dataComparison.cache.exists && verification.dataComparison.cache.ageHours > 6) {
      verification.issues.push(`Cache is stale (${verification.dataComparison.cache.ageHours.toFixed(1)} hours old)`);
    }

  } catch (error) {
    verification.issues.push(`Data comparison error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateRecommendations(verification: any) {
  const { credentials, dataComparison, issues } = verification;

  // Credential recommendations
  if (!credentials.meta.tokenValid) {
    verification.recommendations.push('Refresh or update Meta API access token');
  }

  if (!credentials.meta.accountValid) {
    verification.recommendations.push('Verify Meta ad account permissions and access');
  }

  if (credentials.googleAds.enabled && !credentials.googleAds.systemCredentialsAvailable) {
    verification.recommendations.push('Configure Google Ads system credentials');
  }

  // Data freshness recommendations
  if (dataComparison.cache.exists && dataComparison.cache.ageHours > 3) {
    verification.recommendations.push('Consider refreshing cache for more current data');
  }

  if (!dataComparison.cache.exists) {
    verification.recommendations.push('Initialize cache system for this client');
  }

  // Data accuracy recommendations
  if (dataComparison.comparison.status === 'SIGNIFICANT_DIFFERENCE') {
    verification.recommendations.push('Investigate cache invalidation and data synchronization');
  }

  if (dataComparison.live.error) {
    verification.recommendations.push('Check Meta API connectivity and rate limits');
  }

  // General recommendations
  if (issues.length === 0) {
    verification.recommendations.push('Client setup is healthy - no immediate action required');
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get('client') || 'belmonte';
  
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ clientName, forceLive: true })
  }));
}
