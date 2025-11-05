import { useState, useEffect, useRef } from 'react';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// ✅ GLOBAL deduplication cache - shared across ALL component instances
const globalFetchCache = new Map<string, {
  inProgress: boolean;
  timestamp: number;
  promise?: Promise<any>;
}>();

// Manual cleanup function (called inline, not with setInterval in SSR)
function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, value] of globalFetchCache.entries()) {
    if (now - value.timestamp > 30000) {
      globalFetchCache.delete(key);
    }
  }
}

interface YearOverYearData {
  current: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
  };
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
  };
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
  };
  blocked?: boolean;
  reason?: string;
}

interface UseYearOverYearComparisonProps {
  clientId: string;
  dateRange: {
    start: string;
    end: string;
  };
  enabled?: boolean;
  platform?: 'meta' | 'google';
}

// CACHE BUST: 2025-01-11 v2 - Force browser refresh - API FIXED
export function useYearOverYearComparison({
  clientId,
  dateRange,
  enabled = true,
  platform = 'meta'
}: UseYearOverYearComparisonProps) {
  const [data, setData] = useState<YearOverYearData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 Hook useEffect triggered:', {
      enabled,
      clientId: clientId?.substring(0,8),
      dateRange,
      platform,
      hasRequiredData: !!(enabled && clientId && dateRange.start && dateRange.end),
      clientIdLength: clientId?.length,
      dateRangeStart: dateRange?.start,
      dateRangeEnd: dateRange?.end
    });
    
    if (!enabled) {
      console.log('🔍 Hook skipping fetch - disabled');
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    
    if (!clientId) {
      console.log('🔍 Hook skipping fetch - missing clientId');
      setData(null);
      setError('Missing client ID');
      setLoading(false);
      return;
    }
    
    if (!dateRange?.start || !dateRange?.end) {
      console.log('🔍 Hook skipping fetch - missing date range:', { dateRange });
      setData(null);
      setError('Missing date range');
      setLoading(false);
      return;
    }
    
    // ✅ GLOBAL FIX: Prevent duplicate calls across ALL component instances
    const fetchKey = `yoy-${clientId}-${dateRange.start}-${dateRange.end}-${platform}`;
    const now = Date.now();
    
    // Clean up old entries before checking
    cleanupOldEntries();
    
    const cached = globalFetchCache.get(fetchKey);
    
    if (cached && cached.inProgress) {
      console.log('🚫 YoY Hook: GLOBAL duplicate call prevented', { 
        fetchKey, 
        timeSinceStart: now - cached.timestamp 
      });
      
      // Wait for the existing promise to complete
      if (cached.promise) {
        setLoading(true);
        cached.promise.then(result => {
          setData(result);
          setLoading(false);
        }).catch(err => {
          setError(err.message);
          setLoading(false);
        });
      }
      return;
    }

    const fetchYearOverYearData = async () => {
      // Mark as in progress GLOBALLY
      const fetchPromise = (async () => {
        setLoading(true);
        setError(null);

        try {
          console.log(`🔄 Fetching production comparison data (NO TIMEOUT) for ${platform}...`);
        console.log(`🔄 API Request details:`, {
          clientId: clientId?.substring(0,8),
          dateRange,
          platform,
          url: '/api/year-over-year-comparison'
        });
        
        // Get the current session token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('❌ No authentication token available');
          throw new Error('No authentication token available');
        }
        
        // Clear previous data immediately when platform changes
        setData(null);
        
        // No timeout - let real data fetching take as long as needed
        const apiUrl = '/api/year-over-year-comparison';
        console.log(`🔄 Making API call to: ${apiUrl}`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ clientId, dateRange, platform })
        });
        
        console.log(`🔄 API Response received:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          if (response.status === 408) {
            console.log('⏰ API timed out - skipping comparisons');
            setData(null);
            setError('Comparison API timed out - comparisons disabled');
            return;
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch comparison data');
        }

        const result = await response.json();
        console.log(`🔄 API Response data:`, {
          hasResult: !!result,
          resultKeys: result ? Object.keys(result) : [],
          hasCurrent: !!result?.current,
          hasPrevious: !!result?.previous,
          hasChanges: !!result?.changes,
          currentSpend: result?.current?.spend,
          previousSpend: result?.previous?.spend,
          fullResult: result
        });
        
        // 🔍 DETAILED DEBUG: Check the actual data structure
        console.log('🔍 DETAILED DEBUG - Current data:', result?.current);
        console.log('🔍 DETAILED DEBUG - Previous data:', result?.previous);
        console.log('🔍 DETAILED DEBUG - Changes data:', result?.changes);
        
        // Handle timeout response
        if (result.timeout) {
          console.log('⏰ API returned timeout - skipping comparisons');
          setData(null);
          setError('Comparison API timed out - comparisons disabled');
          return;
        }
        
        // Handle API errors
        if (result.error) {
          console.error('❌ API returned error:', result.error);
          setData(null);
          setError(`API Error: ${result.error}`);
          return;
        }
        
        // ✅ PRODUCTION SYSTEM: Only set data if we have meaningful comparisons
        const hasComparison = result.current.spend > 0 || result.previous.spend > 0;
        
        console.log('🔍 Hook comparison data check:', {
          currentSpend: result.current.spend,
          previousSpend: result.previous.spend,
          hasComparison,
          willSetData: hasComparison,
          clientId,
          dateRange,
          fullResult: result
        });
        
        // 🔍 DEBUG: Check if the data is being set correctly
        console.log('🔍 DEBUG - About to set data:', {
          hasComparison,
          willSetData: hasComparison,
          dataToSet: result
        });
        
        if (hasComparison) {
          setData(result);
          console.log('✅ Production comparison data fetched successfully');
        } else {
          setData(null);
          console.log('ℹ️ No comparison data available for this period (expected behavior)');
        }

          return result;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('❌ Error fetching comparison data:', errorMessage);
          setError(errorMessage);
          setData(null); // Clear any existing data
          throw err;
        } finally {
          setLoading(false);
          // Clean up global cache
          globalFetchCache.delete(fetchKey);
        }
      })();
      
      // Store the promise in global cache
      globalFetchCache.set(fetchKey, {
        inProgress: true,
        timestamp: now,
        promise: fetchPromise
      });
      
      return fetchPromise;
    };

    fetchYearOverYearData().catch(err => {
      console.error('YoY fetch error:', err);
    });
  }, [clientId, dateRange.start, dateRange.end, enabled, platform]);

  return {
    data,
    loading,
    error,
  };
}
