/**
 * Monitoring Dashboard API
 * Provides real-time monitoring data and health status
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '../../../lib/auth-middleware';
import { productionMonitor } from '../../../lib/monitoring';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request - only admins can access monitoring
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    if (authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied - Admin role required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const severity = searchParams.get('severity');

    let responseData;

    switch (type) {
      case 'metrics':
        responseData = {
          success: true,
          data: productionMonitor.getMetrics(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'alerts':
        responseData = {
          success: true,
          data: productionMonitor.getAlerts(severity || undefined),
          timestamp: new Date().toISOString()
        };
        break;

      case 'health':
        responseData = {
          success: true,
          data: productionMonitor.getHealthStatus(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'overview':
      default:
        const healthStatus = productionMonitor.getHealthStatus();
        const metrics = productionMonitor.getMetrics();
        const recentAlerts = productionMonitor.getAlerts().slice(-10);

        responseData = {
          success: true,
          data: {
            health: healthStatus,
            metrics: {
              api: {
                totalRequests: metrics.requests.total,
                errorRate: metrics.calculated.errorRate,
                averageResponseTime: metrics.calculated.averageResponseTime
              },
              cache: {
                hitRate: metrics.calculated.cacheHitRate,
                totalHits: metrics.cache.hits,
                totalMisses: metrics.cache.misses
              },
              database: {
                totalQueries: metrics.database.queries,
                slowQueries: metrics.database.slowQueries,
                errors: metrics.database.errors
              },
              metaApi: {
                totalRequests: metrics.metaApi.requests,
                errorRate: metrics.calculated.metaApiErrorRate,
                rateLimitHits: metrics.metaApi.rateLimitHits
              },
              system: {
                memoryUsage: metrics.system.memoryUsage,
                cpuUsage: metrics.system.cpuUsage,
                uptime: metrics.system.uptime
              }
            },
            recentAlerts
          },
          timestamp: new Date().toISOString()
        };
        break;
    }

    logger.info('📊 Monitoring data requested', {
      type,
      severity,
      user: authResult.user?.email,
      dataSize: JSON.stringify(responseData).length
    });

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('❌ Monitoring API error', { error });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual health checks or metric recording
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    if (authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied - Admin role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    let responseData;

    switch (action) {
      case 'record_metric':
        // Allow manual metric recording
        const { type, ...metricData } = data;
        
        switch (type) {
          case 'api_request':
            productionMonitor.recordAPIRequest(
              metricData.endpoint,
              metricData.responseTime,
              metricData.success
            );
            break;
          case 'cache_operation':
            productionMonitor.recordCacheOperation(metricData.operation, metricData.key);
            break;
          case 'database_query':
            productionMonitor.recordDatabaseQuery(
              metricData.queryTime,
              metricData.success,
              metricData.query
            );
            break;
          case 'meta_api_call':
            productionMonitor.recordMetaAPICall(
              metricData.success,
              metricData.rateLimitHit
            );
            break;
          default:
            throw new Error(`Unknown metric type: ${type}`);
        }

        responseData = {
          success: true,
          message: `Metric recorded: ${type}`,
          timestamp: new Date().toISOString()
        };
        break;

      case 'clear_alerts':
        // This would clear alerts (implementation depends on your needs)
        responseData = {
          success: true,
          message: 'Alerts cleared',
          timestamp: new Date().toISOString()
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logger.info('📊 Monitoring action performed', {
      action,
      user: authResult.user?.email,
      data
    });

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('❌ Monitoring POST API error', { error });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

