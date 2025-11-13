import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { MetaAPIServiceOptimized } from '../../../../lib/meta-api-optimized';
import logger from '../../../../lib/logger';

/**
 * 🔍 Live Token Health Check API - META PLATFORM ONLY
 * 
 * ACTUALLY TESTS Meta API token validity (not just database check)
 * This fixes the monitoring gap where system shows "healthy" while tokens are broken
 * 
 * NOTE: This endpoint tests META TOKENS ONLY. For Google Ads testing, use different endpoint.
 */

interface TokenHealthResult {
  clientId: string;
  clientName: string;
  platform: 'meta' | 'google' | 'both' | 'unknown';
  metaToken: {
    status: 'valid' | 'invalid' | 'missing' | 'untested';
    tested: boolean;
    error?: string;
    lastTested?: string;
    tokenAge?: number; // days
  };
  overall: 'healthy' | 'warning' | 'critical';
}

interface LiveHealthSummary {
  timestamp: string;
  totalClients: number;
  healthyClients: number;
  warningClients: number;
  criticalClients: number;
  untestedClients: number;
  overallHealth: 'healthy' | 'warning' | 'critical';
  clients: TokenHealthResult[];
}

async function testMetaToken(accessToken: string, adAccountId: string, clientName: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    logger.info(`🔍 Testing Meta token for ${clientName}...`);
    
    const metaService = new MetaAPIServiceOptimized(accessToken);
    
    // Clean ad account ID
    const cleanAdAccountId = adAccountId.startsWith('act_') 
      ? adAccountId.substring(4)
      : adAccountId;
    
    // Make a simple API call to test token validity
    const accountInfo = await metaService.getAccountInfo(cleanAdAccountId);
    
    logger.info(`Meta API response for ${clientName}:`, { 
      hasResponse: !!accountInfo, 
      hasId: accountInfo?.id,
      hasAccountId: accountInfo?.account_id,
      keys: accountInfo ? Object.keys(accountInfo) : []
    });
    
    // Check if API returned an error (getAccountInfo returns null on error)
    if (accountInfo === null) {
      logger.error(`❌ Meta API returned null for ${clientName} - likely API error`);
      return { valid: false, error: 'Meta API error - check token permissions' };
    }
    
    // Meta API returns 'id' field (not 'account_id')
    if (accountInfo && (accountInfo.id || accountInfo.account_id)) {
      logger.info(`✅ Meta token valid for ${clientName}`, { accountId: accountInfo.id || accountInfo.account_id });
      return { valid: true };
    }
    
    logger.warn(`⚠️ Meta token test inconclusive for ${clientName}`, { accountInfo });
    return { valid: false, error: 'Unexpected API response structure' };
    
  } catch (error: any) {
    logger.error(`❌ Meta token test failed for ${clientName}:`, error);
    
    // Parse Meta API error
    if (error.message?.includes('OAuthException')) {
      return { valid: false, error: 'OAuth token invalid or expired' };
    } else if (error.message?.includes('190')) {
      return { valid: false, error: 'Access token expired' };
    } else if (error.message?.includes('ETIMEDOUT') || error.message?.includes('ECONNREFUSED')) {
      return { valid: false, error: 'Network error - cannot reach Meta API' };
    }
    
    return { 
      valid: false, 
      error: error.message || 'Unknown error during token test'
    };
  }
}

function calculateTokenAge(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const ageMs = now.getTime() - created.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24)); // days
}

export async function GET(request: NextRequest) {
  try {
    logger.info('🏥 Starting LIVE META token health check (with actual API validation)...');
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Get all active clients with their platform configuration
    // ✅ FIX: Select BOTH meta_access_token AND system_user_token
    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id, created_at, api_status, google_ads_enabled, google_ads_customer_id')
      .eq('api_status', 'valid');

    if (clientError) {
      logger.error('Error fetching clients:', clientError);
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    const totalClients = clients?.length || 0;
    
    // ✅ FIX: Filter for Meta-enabled clients (check BOTH token fields!)
    const metaClients = clients?.filter(c => 
      ((c as any).system_user_token || c.meta_access_token) && c.ad_account_id
    ) || [];
    logger.info(`🔍 Found ${totalClients} total clients, ${metaClients.length} have Meta configured. Testing Meta tokens...`);

    const results: TokenHealthResult[] = [];
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let skippedCount = 0;

    // Test each client's token
    for (const client of clients || []) {
      // ✅ FIX: Check for EITHER meta_access_token OR system_user_token
      const metaToken = (client as any).system_user_token || client.meta_access_token;
      const hasMetaToken = !!(metaToken && client.ad_account_id);
      const tokenType = (client as any).system_user_token ? 'system_user' : 'access_token';
      
      // Determine platform configuration
      const hasMeta = hasMetaToken;
      const hasGoogle = !!(client.google_ads_enabled && client.google_ads_customer_id);
      
      let platform: 'meta' | 'google' | 'both' | 'unknown';
      if (hasMeta && hasGoogle) platform = 'both';
      else if (hasMeta) platform = 'meta';
      else if (hasGoogle) platform = 'google';
      else platform = 'unknown';
      
      const tokenAge = calculateTokenAge(client.created_at);
      
      let metaStatus: TokenHealthResult['metaToken'] = {
        status: 'untested',
        tested: false,
        tokenAge
      };

      let overallStatus: 'healthy' | 'warning' | 'critical' = 'warning';

      // Only test if we have Meta credentials (skip Google-only clients)
      if (hasMeta) {
        logger.info(`Testing ${client.name} with ${tokenType}`, {
          hasSystemToken: !!(client as any).system_user_token,
          hasAccessToken: !!client.meta_access_token
        });
        
        const testResult = await testMetaToken(
          metaToken, // Use the token we selected above (system_user_token OR meta_access_token)
          client.ad_account_id,
          client.name
        );

        metaStatus = {
          status: testResult.valid ? 'valid' : 'invalid',
          tested: true,
          error: testResult.error,
          lastTested: new Date().toISOString(),
          tokenAge
        };

        // Determine overall health
        if (testResult.valid) {
          if (tokenAge > 45) { // Token older than 45 days
            overallStatus = 'warning';
            warningCount++;
          } else {
            overallStatus = 'healthy';
            healthyCount++;
          }
        } else {
          overallStatus = 'critical';
          criticalCount++;
        }
      } else {
        // Client doesn't have Meta configured (might have Google Ads only)
        if (hasGoogle) {
          metaStatus = {
            status: 'missing',
            tested: false,
            error: 'Google Ads only - no Meta configured',
            tokenAge
          };
          overallStatus = 'warning'; // Not critical, just different platform
          skippedCount++;
        } else {
          metaStatus = {
            status: 'missing',
            tested: false,
            error: 'No Meta credentials configured',
            tokenAge
          };
          overallStatus = 'critical';
          criticalCount++;
        }
      }

      results.push({
        clientId: client.id,
        clientName: client.name,
        platform: platform,
        metaToken: metaStatus,
        overall: overallStatus
      });
    }

    // Calculate overall system health
    let overallHealth: 'healthy' | 'warning' | 'critical';
    if (criticalCount > 0) {
      overallHealth = 'critical';
    } else if (warningCount > totalClients / 2) {
      overallHealth = 'warning';
    } else {
      overallHealth = 'healthy';
    }

    const summary: LiveHealthSummary = {
      timestamp: new Date().toISOString(),
      totalClients,
      healthyClients: healthyCount,
      warningClients: warningCount,
      criticalClients: criticalCount,
      untestedClients: totalClients - (healthyCount + warningCount + criticalCount + skippedCount),
      overallHealth,
      clients: results
    };

    logger.info('✅ Live META token health check completed', {
      total: totalClients,
      metaConfigured: metaClients.length,
      healthy: healthyCount,
      warning: warningCount,
      critical: criticalCount,
      skipped: skippedCount,
      overallHealth
    });

    return NextResponse.json({
      success: true,
      summary,
      platform: 'meta',
      message: `META Platform: Tested ${metaClients.length} clients with Meta configured. ${healthyCount} healthy, ${warningCount} warnings, ${criticalCount} critical, ${skippedCount} Google-only`
    });

  } catch (error) {
    logger.error('❌ Live token health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/live-token-health
 * Test a specific client's token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    logger.info(`🔍 Testing token for client ${clientId}...`);

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id, created_at')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client.meta_access_token || !client.ad_account_id) {
      return NextResponse.json({
        success: false,
        clientId: client.id,
        clientName: client.name,
        result: {
          valid: false,
          error: 'Missing Meta credentials (token or ad account ID)'
        }
      });
    }

    const testResult = await testMetaToken(
      client.meta_access_token,
      client.ad_account_id,
      client.name
    );

    const tokenAge = calculateTokenAge(client.created_at);

    return NextResponse.json({
      success: true,
      clientId: client.id,
      clientName: client.name,
      result: {
        valid: testResult.valid,
        error: testResult.error,
        tokenAge,
        testedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Token test failed:', error);
    return NextResponse.json(
      { 
        error: 'Token test failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

