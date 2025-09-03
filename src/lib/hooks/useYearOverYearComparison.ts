import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface YearOverYearData {
  current: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
  };
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
  };
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
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
}

export function useYearOverYearComparison({
  clientId,
  dateRange,
  enabled = true
}: UseYearOverYearComparisonProps) {
  const [data, setData] = useState<YearOverYearData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !clientId || !dateRange.start || !dateRange.end) {
      return;
    }

    const fetchYearOverYearData = async () => {
      setLoading(true);
      setError(null);

      try {
        logger.info('🔄 Fetching year-over-year comparison data...');
        
        // Get the current session token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch('/api/year-over-year-comparison', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch year-over-year data');
        }

        const result = await response.json();
        setData(result);
        logger.info('✅ Year-over-year comparison data fetched successfully');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('❌ Error fetching year-over-year data:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchYearOverYearData();
  }, [clientId, dateRange.start, dateRange.end, enabled]);

  return {
    data,
    loading,
    error,
  };
}
