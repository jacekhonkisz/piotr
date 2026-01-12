/**
 * Production API Values Enforcer
 * 
 * This module ensures that Meta Ads CTR/CPC always use API values in production.
 * It provides validation and fallback mechanisms to guarantee data accuracy.
 */

import logger from './logger';

export interface APIMetrics {
  averageCtr?: number;
  averageCpc?: number;
}

/**
 * Validates that API values are being used correctly
 */
export function validateAPIMetrics(metrics: APIMetrics, source: string): boolean {
  const hasCtr = metrics.averageCtr !== undefined && metrics.averageCtr !== null;
  const hasCpc = metrics.averageCpc !== undefined && metrics.averageCpc !== null;

  if (!hasCtr || !hasCpc) {
    logger.warn(`⚠️ API Metrics Validation: Missing values from ${source}`, {
      hasCtr,
      hasCpc,
      averageCtr: metrics.averageCtr,
      averageCpc: metrics.averageCpc
    });
    return false;
  }

  // Validate ranges (CTR should be 0-100%, CPC should be positive)
  if (metrics.averageCtr < 0 || metrics.averageCtr > 100) {
    logger.warn(`⚠️ API Metrics Validation: Invalid CTR value from ${source}`, {
      averageCtr: metrics.averageCtr
    });
    return false;
  }

  if (metrics.averageCpc < 0) {
    logger.warn(`⚠️ API Metrics Validation: Invalid CPC value from ${source}`, {
      averageCpc: metrics.averageCpc
    });
    return false;
  }

  logger.info(`✅ API Metrics Validation: Valid values from ${source}`, {
    averageCtr: metrics.averageCtr,
    averageCpc: metrics.averageCpc
  });

  return true;
}

/**
 * Ensures API values are used, with fallback to calculation only when necessary
 */
export function ensureAPIMetrics(
  apiMetrics: APIMetrics | undefined,
  calculatedMetrics: { ctr: number; cpc: number },
  source: string
): { ctr: number; cpc: number; source: 'api' | 'calculated' } {
  // ✅ PRODUCTION RULE: Always prefer API values if available (including 0)
  if (apiMetrics?.averageCtr !== undefined && 
      apiMetrics?.averageCtr !== null &&
      apiMetrics?.averageCpc !== undefined && 
      apiMetrics?.averageCpc !== null) {
    
    // Validate API values
    if (validateAPIMetrics(apiMetrics, source)) {
      logger.info(`✅ Using API values from ${source}`, {
        ctr: apiMetrics.averageCtr,
        cpc: apiMetrics.averageCpc
      });
      return {
        ctr: apiMetrics.averageCtr,
        cpc: apiMetrics.averageCpc,
        source: 'api'
      };
    }
  }

  // Fallback to calculation only when API values are truly missing
  logger.warn(`⚠️ API values not available from ${source}, using calculated values`, {
    calculatedCtr: calculatedMetrics.ctr,
    calculatedCpc: calculatedMetrics.cpc,
    apiMetrics
  });

  return {
    ctr: calculatedMetrics.ctr,
    cpc: calculatedMetrics.cpc,
    source: 'calculated'
  };
}

/**
 * Production check: Verifies API values are being used in production
 */
export function productionCheck(metrics: { ctr: number; cpc: number; source: 'api' | 'calculated' }): void {
  if (process.env.NODE_ENV === 'production' && metrics.source === 'calculated') {
    logger.warn('⚠️ PRODUCTION WARNING: Using calculated values instead of API values', {
      ctr: metrics.ctr,
      cpc: metrics.cpc,
      note: 'This should be investigated - API values should always be available in production'
    });
  }
}

