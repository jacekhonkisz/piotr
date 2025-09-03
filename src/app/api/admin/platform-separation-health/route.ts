import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlatformSeparationHealth {
  overall: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    lastChecked: string;
  };
  meta: {
    status: 'healthy' | 'warning' | 'error' | 'disabled';
    clientsCount: number;
    tokensValid: number;
    lastSuccessfulFetch: string;
    issues: string[];
  };
  google: {
    status: 'healthy' | 'warning' | 'error' | 'disabled';
    clientsCount: number;
    tokenValid: boolean;
    lastSuccessfulFetch: string;
    issues: string[];
  };
  separation: {
    dataIsolated: boolean;
    crossContamination: boolean;
    issues: string[];
  };
}

async function checkMetaPlatformHealth() {
  try {
    // Get Meta clients
    const { data: metaClients, error: metaError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token')
      .or('meta_access_token.neq.,system_user_token.neq.');

    if (metaError) {
      return {
        status: 'error' as const,
        clientsCount: 0,
        tokensValid: 0,
        lastSuccessfulFetch: '',
        issues: [`Database error: ${metaError.message}`]
      };
    }

    const clientsCount = metaClients?.length || 0;
    let tokensValid = 0;
    let lastSuccessfulFetch = '';
    const issues: string[] = [];

    // Check recent successful fetches
    const { data: recentFetches } = await supabase
      .from('meta_campaigns')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (recentFetches && recentFetches.length > 0) {
      lastSuccessfulFetch = recentFetches[0].updated_at;
      const lastFetchTime = new Date(lastSuccessfulFetch).getTime();
      const hoursSinceLastFetch = (Date.now() - lastFetchTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastFetch > 24) {
        issues.push(`Last successful Meta fetch was ${Math.round(hoursSinceLastFetch)} hours ago`);
      }
    } else {
      issues.push('No recent Meta data fetches found');
    }

    // Estimate token validity (simplified check)
    tokensValid = clientsCount; // Assume valid for now, real validation would require API calls

    let status: 'healthy' | 'warning' | 'error' | 'disabled';
    if (clientsCount === 0) {
      status = 'disabled';
    } else if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'warning';
    } else {
      status = 'error';
    }

    return {
      status,
      clientsCount,
      tokensValid,
      lastSuccessfulFetch,
      issues
    };
  } catch (error) {
    return {
      status: 'error' as const,
      clientsCount: 0,
      tokensValid: 0,
      lastSuccessfulFetch: '',
      issues: [`Meta health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function checkGooglePlatformHealth() {
  try {
    // Get Google Ads clients
    const { data: googleClients, error: googleError } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id')
      .not('google_ads_customer_id', 'is', null);

    if (googleError) {
      return {
        status: 'error' as const,
        clientsCount: 0,
        tokenValid: false,
        lastSuccessfulFetch: '',
        issues: [`Database error: ${googleError.message}`]
      };
    }

    const clientsCount = googleClients?.length || 0;
    const issues: string[] = [];
    let lastSuccessfulFetch = '';

    // Check Google Ads token health
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_manager_refresh_token', 'google_ads_client_id', 'google_ads_client_secret']);

    const settings: Record<string, string> = {};
    settingsData?.forEach(setting => {
      settings[setting.key] = setting.value || '';
    });

    let tokenValid = false;
    if (settings.google_ads_manager_refresh_token && settings.google_ads_client_id && settings.google_ads_client_secret) {
      // Quick token validation (simplified)
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: settings.google_ads_client_id,
            client_secret: settings.google_ads_client_secret,
            refresh_token: settings.google_ads_manager_refresh_token,
            grant_type: 'refresh_token'
          })
        });

        tokenValid = response.ok;
        if (!tokenValid) {
          const errorText = await response.text();
          if (errorText.includes('invalid_grant')) {
            issues.push('Google Ads refresh token expired or revoked');
          } else {
            issues.push(`Google Ads token validation failed: ${errorText}`);
          }
        }
      } catch (error) {
        issues.push(`Google Ads token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      issues.push('Google Ads credentials not configured');
    }

    // Check recent successful fetches
    const { data: recentFetches } = await supabase
      .from('google_ads_campaigns')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (recentFetches && recentFetches.length > 0) {
      lastSuccessfulFetch = recentFetches[0].updated_at;
      const lastFetchTime = new Date(lastSuccessfulFetch).getTime();
      const hoursSinceLastFetch = (Date.now() - lastFetchTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastFetch > 24) {
        issues.push(`Last successful Google Ads fetch was ${Math.round(hoursSinceLastFetch)} hours ago`);
      }
    } else {
      issues.push('No recent Google Ads data fetches found');
    }

    let status: 'healthy' | 'warning' | 'error' | 'disabled';
    if (clientsCount === 0) {
      status = 'disabled';
    } else if (tokenValid && issues.length === 0) {
      status = 'healthy';
    } else if (tokenValid && issues.length <= 2) {
      status = 'warning';
    } else {
      status = 'error';
    }

    return {
      status,
      clientsCount,
      tokenValid,
      lastSuccessfulFetch,
      issues
    };
  } catch (error) {
    return {
      status: 'error' as const,
      clientsCount: 0,
      tokenValid: false,
      lastSuccessfulFetch: '',
      issues: [`Google health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function checkDataSeparation() {
  try {
    const issues: string[] = [];
    let dataIsolated = true;
    let crossContamination = false;

    // Check for data mixing in campaigns tables
    const { data: metaCampaigns } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, campaign_name')
      .limit(5);

    const { data: googleCampaigns } = await supabase
      .from('google_ads_campaigns')
      .select('campaign_id, campaign_name')
      .limit(5);

    // Check for potential cross-contamination (simplified check)
    if (metaCampaigns && googleCampaigns) {
      const metaIds = metaCampaigns.map(c => c.campaign_id);
      const googleIds = googleCampaigns.map(c => c.campaign_id);
      
      const overlap = metaIds.filter(id => googleIds.includes(id));
      if (overlap.length > 0) {
        crossContamination = true;
        issues.push(`Found ${overlap.length} overlapping campaign IDs between platforms`);
      }
    }

    // Check client configuration
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, google_ads_customer_id')
      .or('meta_access_token.neq.,system_user_token.neq.,google_ads_customer_id.neq.');

    if (clients) {
      const metaOnlyClients = clients.filter(c => 
        (c.meta_access_token || c.system_user_token) && !c.google_ads_customer_id
      ).length;
      
      const googleOnlyClients = clients.filter(c => 
        c.google_ads_customer_id && !c.meta_access_token && !c.system_user_token
      ).length;
      
      const bothPlatformClients = clients.filter(c => 
        (c.meta_access_token || c.system_user_token) && c.google_ads_customer_id
      ).length;

      if (bothPlatformClients > 0) {
        issues.push(`${bothPlatformClients} clients configured for both platforms (this is OK)`);
      }
    }

    return {
      dataIsolated,
      crossContamination,
      issues
    };
  } catch (error) {
    return {
      dataIsolated: false,
      crossContamination: true,
      issues: [`Data separation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }

    logger.info('Platform separation health check initiated by:', authResult.user.email);

    // Run all health checks in parallel
    const [metaHealth, googleHealth, separationHealth] = await Promise.all([
      checkMetaPlatformHealth(),
      checkGooglePlatformHealth(),
      checkDataSeparation()
    ]);

    // Determine overall health
    let overallStatus: 'healthy' | 'warning' | 'error';
    let overallMessage: string;

    const activeIssues = [
      ...metaHealth.issues,
      ...googleHealth.issues,
      ...separationHealth.issues
    ];

    if (activeIssues.length === 0) {
      overallStatus = 'healthy';
      overallMessage = '✅ All platforms are healthy and properly separated';
    } else if (activeIssues.length <= 3) {
      overallStatus = 'warning';
      overallMessage = `⚠️ ${activeIssues.length} minor issues detected`;
    } else {
      overallStatus = 'error';
      overallMessage = `❌ ${activeIssues.length} issues require attention`;
    }

    const healthData: PlatformSeparationHealth = {
      overall: {
        status: overallStatus,
        message: overallMessage,
        lastChecked: new Date().toISOString()
      },
      meta: metaHealth,
      google: googleHealth,
      separation: separationHealth
    };

    logger.info('Platform separation health check completed', {
      overallStatus,
      metaStatus: metaHealth.status,
      googleStatus: googleHealth.status,
      issuesCount: activeIssues.length
    });

    return NextResponse.json({
      success: true,
      health: healthData
    });

  } catch (error) {
    logger.error('Error in platform separation health check:', error);
    return createErrorResponse('Health check failed', 500);
  }
}
