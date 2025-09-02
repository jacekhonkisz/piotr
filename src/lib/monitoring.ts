/**
 * Production Monitoring and Alerting System
 * Comprehensive monitoring for Meta Ads Reporting SaaS
 */

import logger from './logger';

// Monitoring configuration
const MONITORING_CONFIG = {
  // Health check intervals
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  API_TIMEOUT: 10000, // 10 seconds
  
  // Alert thresholds
  ERROR_RATE_THRESHOLD: 0.05, // 5% error rate
  RESPONSE_TIME_THRESHOLD: 2000, // 2 seconds
  MEMORY_USAGE_THRESHOLD: 0.85, // 85% memory usage
  CPU_USAGE_THRESHOLD: 0.80, // 80% CPU usage
  
  // Cache performance thresholds
  CACHE_HIT_RATE_THRESHOLD: 0.70, // 70% cache hit rate
  CACHE_MISS_ALERT_COUNT: 100, // Alert after 100 cache misses
  
  // Database thresholds
  DB_CONNECTION_THRESHOLD: 80, // Max 80% of connection pool
  SLOW_QUERY_THRESHOLD: 1000, // 1 second for slow queries
  
  // Meta API thresholds
  META_API_ERROR_THRESHOLD: 0.10, // 10% error rate for Meta API
  META_API_RATE_LIMIT_THRESHOLD: 0.90, // 90% of rate limit
};

// Metrics storage
interface Metrics {
  requests: {
    total: number;
    errors: number;
    responseTimes: number[];
  };
  cache: {
    hits: number;
    misses: number;
    errors: number;
  };
  database: {
    queries: number;
    slowQueries: number;
    connections: number;
    errors: number;
  };
  metaApi: {
    requests: number;
    errors: number;
    rateLimitHits: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

class ProductionMonitor {
  private metrics: Metrics;
  private alerts: Array<{ type: string; message: string; timestamp: Date; severity: 'low' | 'medium' | 'high' | 'critical' }>;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.alerts = [];
    this.startHealthChecks();
  }

  private initializeMetrics(): Metrics {
    return {
      requests: { total: 0, errors: 0, responseTimes: [] },
      cache: { hits: 0, misses: 0, errors: 0 },
      database: { queries: 0, slowQueries: 0, connections: 0, errors: 0 },
      metaApi: { requests: 0, errors: 0, rateLimitHits: 0 },
      system: { memoryUsage: 0, cpuUsage: 0, uptime: Date.now() }
    };
  }

  // API Request Monitoring
  recordAPIRequest(endpoint: string, responseTime: number, success: boolean) {
    this.metrics.requests.total++;
    this.metrics.requests.responseTimes.push(responseTime);
    
    if (!success) {
      this.metrics.requests.errors++;
    }

    // Keep only last 1000 response times for memory efficiency
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes = this.metrics.requests.responseTimes.slice(-1000);
    }

    // Check thresholds
    this.checkAPIThresholds(endpoint, responseTime, success);

    logger.info('📊 API Request recorded', {
      endpoint,
      responseTime,
      success,
      totalRequests: this.metrics.requests.total,
      errorRate: this.getErrorRate()
    });
  }

  // Cache Performance Monitoring
  recordCacheOperation(operation: 'hit' | 'miss' | 'error', key?: string) {
    switch (operation) {
      case 'hit':
        this.metrics.cache.hits++;
        break;
      case 'miss':
        this.metrics.cache.misses++;
        break;
      case 'error':
        this.metrics.cache.errors++;
        break;
    }

    this.checkCacheThresholds();

    logger.info('💾 Cache operation recorded', {
      operation,
      key,
      hitRate: this.getCacheHitRate(),
      totalOperations: this.metrics.cache.hits + this.metrics.cache.misses
    });
  }

  // Database Monitoring
  recordDatabaseQuery(queryTime: number, success: boolean, query?: string) {
    this.metrics.database.queries++;
    
    if (!success) {
      this.metrics.database.errors++;
    }

    if (queryTime > MONITORING_CONFIG.SLOW_QUERY_THRESHOLD) {
      this.metrics.database.slowQueries++;
      this.createAlert('database', `Slow query detected: ${queryTime}ms`, 'medium');
    }

    this.checkDatabaseThresholds();

    logger.info('🗄️ Database query recorded', {
      queryTime,
      success,
      totalQueries: this.metrics.database.queries,
      slowQueries: this.metrics.database.slowQueries
    });
  }

  // Meta API Monitoring
  recordMetaAPICall(success: boolean, rateLimitHit: boolean = false) {
    this.metrics.metaApi.requests++;
    
    if (!success) {
      this.metrics.metaApi.errors++;
    }

    if (rateLimitHit) {
      this.metrics.metaApi.rateLimitHits++;
      this.createAlert('meta-api', 'Meta API rate limit hit', 'high');
    }

    this.checkMetaAPIThresholds();

    logger.info('🔗 Meta API call recorded', {
      success,
      rateLimitHit,
      totalCalls: this.metrics.metaApi.requests,
      errorRate: this.getMetaAPIErrorRate()
    });
  }

  // System Monitoring
  recordSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.system.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
    this.metrics.system.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.metrics.system.uptime = Date.now() - this.metrics.system.uptime;

    this.checkSystemThresholds();

    logger.info('⚡ System metrics recorded', {
      memoryUsage: `${(this.metrics.system.memoryUsage * 100).toFixed(2)}%`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      uptime: `${Math.round(this.metrics.system.uptime / 1000 / 60)}min`
    });
  }

  // Threshold Checking Methods
  private checkAPIThresholds(endpoint: string, responseTime: number, success: boolean) {
    const errorRate = this.getErrorRate();
    
    if (errorRate > MONITORING_CONFIG.ERROR_RATE_THRESHOLD) {
      this.createAlert('api', `High error rate: ${(errorRate * 100).toFixed(2)}%`, 'high');
    }

    if (responseTime > MONITORING_CONFIG.RESPONSE_TIME_THRESHOLD) {
      this.createAlert('api', `Slow response time on ${endpoint}: ${responseTime}ms`, 'medium');
    }
  }

  private checkCacheThresholds() {
    const hitRate = this.getCacheHitRate();
    
    if (hitRate < MONITORING_CONFIG.CACHE_HIT_RATE_THRESHOLD) {
      this.createAlert('cache', `Low cache hit rate: ${(hitRate * 100).toFixed(2)}%`, 'medium');
    }

    if (this.metrics.cache.misses > MONITORING_CONFIG.CACHE_MISS_ALERT_COUNT) {
      this.createAlert('cache', `High cache miss count: ${this.metrics.cache.misses}`, 'low');
    }
  }

  private checkDatabaseThresholds() {
    const errorRate = this.metrics.database.errors / this.metrics.database.queries;
    
    if (errorRate > 0.05) { // 5% database error rate
      this.createAlert('database', `High database error rate: ${(errorRate * 100).toFixed(2)}%`, 'high');
    }
  }

  private checkMetaAPIThresholds() {
    const errorRate = this.getMetaAPIErrorRate();
    
    if (errorRate > MONITORING_CONFIG.META_API_ERROR_THRESHOLD) {
      this.createAlert('meta-api', `High Meta API error rate: ${(errorRate * 100).toFixed(2)}%`, 'high');
    }
  }

  private checkSystemThresholds() {
    if (this.metrics.system.memoryUsage > MONITORING_CONFIG.MEMORY_USAGE_THRESHOLD) {
      this.createAlert('system', `High memory usage: ${(this.metrics.system.memoryUsage * 100).toFixed(2)}%`, 'critical');
    }

    if (this.metrics.system.cpuUsage > MONITORING_CONFIG.CPU_USAGE_THRESHOLD) {
      this.createAlert('system', `High CPU usage: ${(this.metrics.system.cpuUsage * 100).toFixed(2)}%`, 'critical');
    }
  }

  // Alert Management
  private createAlert(type: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    const alert = {
      type,
      message,
      timestamp: new Date(),
      severity
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log alert
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    logger[logLevel](`🚨 ALERT [${severity.toUpperCase()}] ${type}: ${message}`, alert);

    // In production, you would send this to your alerting system
    // e.g., Slack, PagerDuty, email, etc.
    this.sendAlert(alert);
  }

  private async sendAlert(alert: any) {
    // Implementation for sending alerts to external systems
    // This is where you'd integrate with Slack, email, PagerDuty, etc.
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to webhook
      try {
        if (process.env.ALERT_WEBHOOK_URL) {
          await fetch(process.env.ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.message}`,
              alert
            })
          });
        }
      } catch (error) {
        logger.error('Failed to send alert to webhook', { error, alert });
      }
    }
  }

  // Health Checks
  private startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, MONITORING_CONFIG.HEALTH_CHECK_INTERVAL);

    logger.info('🏥 Health checks started', {
      interval: MONITORING_CONFIG.HEALTH_CHECK_INTERVAL
    });
  }

  private async performHealthCheck() {
    try {
      // Record system metrics
      this.recordSystemMetrics();

      // Check database connectivity
      await this.checkDatabaseHealth();

      // Check external API health
      await this.checkExternalAPIHealth();

      // Check cache health
      this.checkCacheHealth();

      logger.info('✅ Health check completed successfully');
    } catch (error) {
      this.createAlert('health-check', `Health check failed: ${error}`, 'critical');
      logger.error('❌ Health check failed', { error });
    }
  }

  private async checkDatabaseHealth() {
    // Implementation would check database connectivity
    // For now, we'll simulate this
    const start = Date.now();
    
    try {
      // Simulate database ping
      await new Promise(resolve => setTimeout(resolve, 10));
      const responseTime = Date.now() - start;
      
      if (responseTime > 1000) {
        this.createAlert('database', `Slow database response: ${responseTime}ms`, 'medium');
      }
    } catch (error) {
      this.createAlert('database', `Database connectivity failed: ${error}`, 'critical');
    }
  }

  private async checkExternalAPIHealth() {
    // Check Meta API health
    try {
      const start = Date.now();
      // This would be a lightweight API call to check Meta API status
      // For now, we'll simulate this
      await new Promise(resolve => setTimeout(resolve, 50));
      const responseTime = Date.now() - start;
      
      if (responseTime > 5000) {
        this.createAlert('meta-api', `Slow Meta API response: ${responseTime}ms`, 'medium');
      }
    } catch (error) {
      this.createAlert('meta-api', `Meta API health check failed: ${error}`, 'high');
    }
  }

  private checkCacheHealth() {
    // Check cache performance
    const hitRate = this.getCacheHitRate();
    if (hitRate < 0.5 && this.metrics.cache.hits + this.metrics.cache.misses > 100) {
      this.createAlert('cache', `Poor cache performance: ${(hitRate * 100).toFixed(2)}% hit rate`, 'low');
    }
  }

  // Utility Methods
  private getErrorRate(): number {
    return this.metrics.requests.total > 0 ? this.metrics.requests.errors / this.metrics.requests.total : 0;
  }

  private getCacheHitRate(): number {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    return total > 0 ? this.metrics.cache.hits / total : 0;
  }

  private getMetaAPIErrorRate(): number {
    return this.metrics.metaApi.requests > 0 ? this.metrics.metaApi.errors / this.metrics.metaApi.requests : 0;
  }

  private getAverageResponseTime(): number {
    const times = this.metrics.requests.responseTimes;
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  // Public API for getting metrics
  getMetrics() {
    return {
      ...this.metrics,
      calculated: {
        errorRate: this.getErrorRate(),
        cacheHitRate: this.getCacheHitRate(),
        metaApiErrorRate: this.getMetaAPIErrorRate(),
        averageResponseTime: this.getAverageResponseTime()
      }
    };
  }

  getAlerts(severity?: string) {
    return severity 
      ? this.alerts.filter(alert => alert.severity === severity)
      : this.alerts;
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const recentAlerts = this.alerts.filter(alert => 
      Date.now() - alert.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical');
    const highAlerts = recentAlerts.filter(alert => alert.severity === 'high');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (highAlerts.length > 0) {
      status = 'degraded';
    } else if (recentAlerts.length > 5) {
      status = 'warning';
    }

    return {
      status,
      uptime: Date.now() - this.metrics.system.uptime,
      metrics: metrics.calculated,
      recentAlerts: recentAlerts.length,
      criticalAlerts: criticalAlerts.length,
      lastHealthCheck: new Date()
    };
  }

  // Cleanup
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('🏥 Monitoring system stopped');
  }
}

// Singleton instance
export const productionMonitor = new ProductionMonitor();

// Middleware for automatic API monitoring
export function monitoringMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const success = res.statusCode < 400;
    
    productionMonitor.recordAPIRequest(
      req.path || req.url,
      responseTime,
      success
    );
  });
  
  next();
}

export default productionMonitor;

