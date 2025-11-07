/**
 * Data Source Indicator Component - Extracted from reports page
 * 
 * This is the EXACT same component used in /reports page (lines 50-160)
 * to show which data source is being used with consistent color coding.
 */

import React from 'react';
import { RefreshCw, Clock } from 'lucide-react';

interface DataSourceIndicatorProps {
  validation?: any;
  debug?: any;
  // Enhanced props for Week 3 (optional - non-breaking)
  showCacheAge?: boolean;
  cacheAge?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  completeness?: number;
}

// 🔧 DATA SOURCE INDICATOR: Component to show which data source is being used
export const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({ 
  validation, 
  debug, 
  showCacheAge = false, 
  cacheAge, 
  onRefresh, 
  isRefreshing = false, 
  completeness 
}) => {
  if (!validation && !debug) return null;

  // Helper function to format cache age
  const formatCacheAge = (ageMs?: number): string => {
    if (!ageMs) return '';
    
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMinutes / 60);
    
    if (ageHours > 0) {
      return `${ageHours}h ${ageMinutes % 60}m`;
    } else {
      return `${ageMinutes}m`;
    }
  };

  const getSourceColor = (source: string) => {
    // Handle fresh cache sources (monthly and weekly)
    if (source.includes('cache') && !source.includes('stale') && !source.includes('miss')) {
      return 'bg-green-100 text-green-800'; // Fresh cache
    }
    
    // Handle stale cache sources (monthly and weekly)  
    if (source.includes('stale') || source.includes('cache-miss')) {
      return 'bg-yellow-100 text-yellow-800'; // Stale cache
    }
    
    // Handle database sources
    if (source.includes('database') || source.includes('historical')) {
      return 'bg-blue-100 text-blue-800'; // Database
    }
    
    // Handle live API sources (but not if it contains 'cache' which indicates cached live data)
    if ((source.includes('live') || source.includes('api') || source.includes('refresh')) && !source.includes('cache')) {
      return 'bg-red-100 text-red-800'; // Live API
    }
    
    // Specific cases
    switch (source) {
      case 'smart-cache-fresh': case 'weekly-cache': case 'monthly-cache': 
        return 'bg-green-100 text-green-800';
      case 'smart-cache-stale': case 'stale-weekly-cache': case 'stale-monthly-cache':
        return 'bg-yellow-100 text-yellow-800';
      case 'database': case 'database-historical': 
        return 'bg-blue-100 text-blue-800';
      case 'live-api': case 'force-weekly-refresh': case 'force-monthly-refresh':
        return 'bg-red-100 text-red-800';
      default: 
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (source: string) => {
    // Handle fresh cache sources (monthly and weekly)
    if (source.includes('cache') && !source.includes('stale') && !source.includes('miss')) {
      return '🟢'; // Fresh cache
    }
    
    // Handle stale cache sources (monthly and weekly)
    if (source.includes('stale') || source.includes('cache-miss')) {
      return '🟡'; // Stale cache
    }
    
    // Handle database sources
    if (source.includes('database') || source.includes('historical')) {
      return '🔵'; // Database
    }
    
    // Handle live API sources
    if ((source.includes('live') || source.includes('api') || source.includes('refresh')) && !source.includes('cache')) {
      return '🔴'; // Live API
    }
    
    // Specific cases
    switch (source) {
      case 'smart-cache-fresh': case 'weekly-cache': case 'monthly-cache':
        return '🟢';
      case 'smart-cache-stale': case 'stale-weekly-cache': case 'stale-monthly-cache':
        return '🟡';
      case 'database': case 'database-historical':
        return '🔵';
      case 'live-api': case 'force-weekly-refresh': case 'force-monthly-refresh':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getSourceLabel = (source: string) => {
    // 🔧 SIMPLIFIED: Handle new simplified source names first (exact matches)
    switch (source) {
      case 'meta-cache':
        return 'Meta Cache';
      case 'google-cache':
        return 'Google Cache';
      case 'cache':
        return 'Cache';
      case 'database':
        return 'Database';
      case 'meta-live':
        return 'Meta Live API';
      case 'google-live':
        return 'Google Live API';
      case 'live-api':
        return 'Live API';
    }
    
    // Legacy handling for old source names (fallback)
    // Handle stale cache sources
    if (source.includes('stale') || source.includes('cache-miss')) {
      return 'Stale Cache';
    }
    
    // Handle fresh cache sources (legacy)
    if (source.includes('cache') && !source.includes('stale') && !source.includes('miss')) {
      return 'Cache';  // Simplified from "Fresh Cache"
    }
    
    // Handle database sources
    if (source.includes('database') || source.includes('historical')) {
      return 'Database';
    }
    
    // Handle live API sources
    if ((source.includes('live') || source.includes('api') || source.includes('refresh')) && !source.includes('cache')) {
      return 'Live API';
    }
    
    // Default: return as-is
    return source || 'Unknown';
  };

  const source = debug?.source || validation?.actualSource || 'unknown';
  const sourceColor = getSourceColor(source);
  const sourceIcon = getSourceIcon(source);
  const sourceLabel = getSourceLabel(source);

  return (
    <div className="flex items-center space-x-2">
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceColor}`}>
        <span className="mr-1">{sourceIcon}</span>
        {sourceLabel}
      </div>
      
      {/* Enhanced: Show cache age if enabled */}
      {showCacheAge && cacheAge && (
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatCacheAge(cacheAge)}</span>
        </div>
      )}
      
      {/* Enhanced: Show completeness percentage */}
      {completeness !== undefined && completeness < 1 && (
        <div className="text-xs text-amber-600">
          {Math.round(completeness * 100)}% complete
        </div>
      )}
      
      {/* Enhanced: Manual refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Refresh cache"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
      
      {/* Existing features (unchanged) */}
      {debug?.responseTime && (
        <div className="text-xs text-gray-500">
          {Math.round(debug.responseTime)}ms
        </div>
      )}
      
      {validation?.potentialCacheBypassed && (
        <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 text-red-700 border border-red-200">
          ⚠️ Cache Bypassed
        </div>
      )}
    </div>
  );
};