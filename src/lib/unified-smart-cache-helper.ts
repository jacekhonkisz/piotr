import { getSmartCacheData, getSmartWeekCacheData } from './smart-cache-helper';
import { getGoogleAdsSmartCacheData, getGoogleAdsSmartWeekCacheData } from './google-ads-smart-cache-helper';
import logger from './logger';

interface UnifiedCacheData {
  meta?: any;
  googleAds?: any;
  combined: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
  };
  conversionMetrics: any;
  fetchedAt: string;
  fromCache: boolean;
  cacheAge: number;
}

interface UnifiedCacheResult {
  success: boolean;
  data: UnifiedCacheData;
  source: string;
}

/**
 * Get unified smart cache data for both Meta and Google Ads
 * This function fetches data from both platforms and combines them
 */
export async function getUnifiedSmartCacheData(
  clientId: string, 
  forceRefresh: boolean = false
): Promise<UnifiedCacheResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 Fetching unified smart cache data (Meta + Google Ads)');
    
    // Fetch both Meta and Google Ads data in parallel
    const [metaResult, googleAdsResult] = await Promise.allSettled([
      getSmartCacheData(clientId, forceRefresh).catch(error => {
        logger.warn('⚠️ Meta cache fetch failed:', error);
        return null;
      }),
      getGoogleAdsSmartCacheData(clientId, forceRefresh).catch(error => {
        logger.warn('⚠️ Google Ads cache fetch failed:', error);
        return null;
      })
    ]);
    
    // Extract successful results
    const metaData = metaResult.status === 'fulfilled' && metaResult.value ? metaResult.value.data : null;
    const googleAdsData = googleAdsResult.status === 'fulfilled' && googleAdsResult.value ? googleAdsResult.value.data : null;
    
    // Determine cache status
    const metaFromCache = metaData?.fromCache || false;
    const googleAdsFromCache = googleAdsData?.fromCache || false;
    const fromCache = metaFromCache && googleAdsFromCache;
    
    // Calculate combined metrics
    const metaStats = metaData?.stats || {};
    const googleAdsStats = googleAdsData?.stats || {};
    
    const combined = {
      totalSpend: (metaStats.totalSpend || 0) + (googleAdsStats.totalSpend || 0),
      totalImpressions: (metaStats.totalImpressions || 0) + (googleAdsStats.totalImpressions || 0),
      totalClicks: (metaStats.totalClicks || 0) + (googleAdsStats.totalClicks || 0),
      totalConversions: (metaStats.totalConversions || 0) + (googleAdsStats.totalConversions || 0),
      averageCtr: 0,
      averageCpc: 0
    };
    
    // Calculate weighted averages
    if (combined.totalImpressions > 0) {
      combined.averageCtr = (combined.totalClicks / combined.totalImpressions) * 100;
    }
    if (combined.totalClicks > 0) {
      combined.averageCpc = combined.totalSpend / combined.totalClicks;
    }
    
    // Combine conversion metrics
    const metaConversions = metaData?.conversionMetrics || {};
    const googleAdsConversions = googleAdsData?.conversionMetrics || {};
    
    const conversionMetrics = {
      click_to_call: (metaConversions.click_to_call || 0) + (googleAdsConversions.click_to_call || 0),
      form_submissions: (metaConversions.form_submissions || 0) + (googleAdsConversions.form_submissions || 0),
      phone_calls: (metaConversions.phone_calls || 0) + (googleAdsConversions.phone_calls || 0),
      email_clicks: (metaConversions.email_clicks || 0) + (googleAdsConversions.email_clicks || 0),
      phone_clicks: (metaConversions.phone_clicks || 0) + (googleAdsConversions.phone_clicks || 0),
      booking_step_1: (metaConversions.booking_step_1 || 0) + (googleAdsConversions.booking_step_1 || 0),
      booking_step_2: (metaConversions.booking_step_2 || 0) + (googleAdsConversions.booking_step_2 || 0),
      booking_step_3: (metaConversions.booking_step_3 || 0) + (googleAdsConversions.booking_step_3 || 0),
      reservations: (metaConversions.reservations || 0) + (googleAdsConversions.reservations || 0),
      reservation_value: (metaConversions.reservation_value || 0) + (googleAdsConversions.reservation_value || 0)
    };
    
    // Calculate cache age (use oldest cache age)
    const metaCacheAge = metaData?.cacheAge || 0;
    const googleAdsCacheAge = googleAdsData?.cacheAge || 0;
    const cacheAge = Math.max(metaCacheAge, googleAdsCacheAge);
    
    const unifiedData: UnifiedCacheData = {
      meta: metaData,
      googleAds: googleAdsData,
      combined,
      conversionMetrics,
      fetchedAt: new Date().toISOString(),
      fromCache,
      cacheAge
    };
    
    // Determine source
    let source = 'unified-cache';
    if (metaData && googleAdsData) {
      source = fromCache ? 'unified-cache' : 'unified-live-api';
    } else if (metaData) {
      source = 'meta-only';
    } else if (googleAdsData) {
      source = 'google-ads-only';
    } else {
      source = 'no-data';
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Unified smart cache data fetched', {
      responseTime,
      source,
      hasMetaData: !!metaData,
      hasGoogleAdsData: !!googleAdsData,
      fromCache,
      cacheAge
    });
    
    return {
      success: true,
      data: unifiedData,
      source
    };
    
  } catch (error) {
    logger.error('❌ Unified smart cache request failed:', error);
    throw error;
  }
}

/**
 * Get unified smart cache data for weekly periods (both Meta and Google Ads)
 */
export async function getUnifiedSmartWeekCacheData(
  clientId: string, 
  forceRefresh: boolean = false,
  requestedPeriodId?: string
): Promise<UnifiedCacheResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🔄 Fetching unified weekly smart cache data (Meta + Google Ads)');
    
    // Fetch both Meta and Google Ads weekly data in parallel
    const [metaResult, googleAdsResult] = await Promise.allSettled([
      getSmartWeekCacheData(clientId, forceRefresh, requestedPeriodId).catch(error => {
        logger.warn('⚠️ Meta weekly cache fetch failed:', error);
        return null;
      }),
      getGoogleAdsSmartWeekCacheData(clientId, forceRefresh, requestedPeriodId).catch(error => {
        logger.warn('⚠️ Google Ads weekly cache fetch failed:', error);
        return null;
      })
    ]);
    
    // Extract successful results
    const metaData = metaResult.status === 'fulfilled' && metaResult.value ? metaResult.value.data : null;
    const googleAdsData = googleAdsResult.status === 'fulfilled' && googleAdsResult.value ? googleAdsResult.value.data : null;
    
    // Determine cache status
    const metaFromCache = metaData?.fromCache || false;
    const googleAdsFromCache = googleAdsData?.fromCache || false;
    const fromCache = metaFromCache && googleAdsFromCache;
    
    // Calculate combined metrics
    const metaStats = metaData?.stats || {};
    const googleAdsStats = googleAdsData?.stats || {};
    
    const combined = {
      totalSpend: (metaStats.totalSpend || 0) + (googleAdsStats.totalSpend || 0),
      totalImpressions: (metaStats.totalImpressions || 0) + (googleAdsStats.totalImpressions || 0),
      totalClicks: (metaStats.totalClicks || 0) + (googleAdsStats.totalClicks || 0),
      totalConversions: (metaStats.totalConversions || 0) + (googleAdsStats.totalConversions || 0),
      averageCtr: 0,
      averageCpc: 0
    };
    
    // Calculate weighted averages
    if (combined.totalImpressions > 0) {
      combined.averageCtr = (combined.totalClicks / combined.totalImpressions) * 100;
    }
    if (combined.totalClicks > 0) {
      combined.averageCpc = combined.totalSpend / combined.totalClicks;
    }
    
    // Combine conversion metrics
    const metaConversions = metaData?.conversionMetrics || {};
    const googleAdsConversions = googleAdsData?.conversionMetrics || {};
    
    const conversionMetrics = {
      click_to_call: (metaConversions.click_to_call || 0) + (googleAdsConversions.click_to_call || 0),
      form_submissions: (metaConversions.form_submissions || 0) + (googleAdsConversions.form_submissions || 0),
      phone_calls: (metaConversions.phone_calls || 0) + (googleAdsConversions.phone_calls || 0),
      email_clicks: (metaConversions.email_clicks || 0) + (googleAdsConversions.email_clicks || 0),
      phone_clicks: (metaConversions.phone_clicks || 0) + (googleAdsConversions.phone_clicks || 0),
      booking_step_1: (metaConversions.booking_step_1 || 0) + (googleAdsConversions.booking_step_1 || 0),
      booking_step_2: (metaConversions.booking_step_2 || 0) + (googleAdsConversions.booking_step_2 || 0),
      booking_step_3: (metaConversions.booking_step_3 || 0) + (googleAdsConversions.booking_step_3 || 0),
      reservations: (metaConversions.reservations || 0) + (googleAdsConversions.reservations || 0),
      reservation_value: (metaConversions.reservation_value || 0) + (googleAdsConversions.reservation_value || 0)
    };
    
    // Calculate cache age (use oldest cache age)
    const metaCacheAge = metaData?.cacheAge || 0;
    const googleAdsCacheAge = googleAdsData?.cacheAge || 0;
    const cacheAge = Math.max(metaCacheAge, googleAdsCacheAge);
    
    const unifiedData: UnifiedCacheData = {
      meta: metaData,
      googleAds: googleAdsData,
      combined,
      conversionMetrics,
      fetchedAt: new Date().toISOString(),
      fromCache,
      cacheAge
    };
    
    // Determine source
    let source = 'unified-weekly-cache';
    if (metaData && googleAdsData) {
      source = fromCache ? 'unified-weekly-cache' : 'unified-weekly-live-api';
    } else if (metaData) {
      source = 'meta-weekly-only';
    } else if (googleAdsData) {
      source = 'google-ads-weekly-only';
    } else {
      source = 'no-weekly-data';
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Unified weekly smart cache data fetched', {
      responseTime,
      source,
      hasMetaData: !!metaData,
      hasGoogleAdsData: !!googleAdsData,
      fromCache,
      cacheAge
    });
    
    return {
      success: true,
      data: unifiedData,
      source
    };
    
  } catch (error) {
    logger.error('❌ Unified weekly smart cache request failed:', error);
    throw error;
  }
}
