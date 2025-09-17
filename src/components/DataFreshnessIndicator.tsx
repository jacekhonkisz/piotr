'use client';

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DataFreshnessIndicatorProps {
  lastUpdated?: string | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  showRefreshButton?: boolean;
  className?: string;
}

interface FreshnessStatus {
  status: 'fresh' | 'acceptable' | 'stale' | 'critical' | 'unknown';
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  message: string;
  ageHours: number | null;
}

export default function DataFreshnessIndicator({
  lastUpdated,
  isLoading = false,
  onRefresh,
  showRefreshButton = true,
  className = ''
}: DataFreshnessIndicatorProps) {
  const [freshnessStatus, setFreshnessStatus] = useState<FreshnessStatus>({
    status: 'unknown',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: <Clock className="w-4 h-4" />,
    message: 'Unknown',
    ageHours: null
  });

  useEffect(() => {
    if (!lastUpdated) {
      setFreshnessStatus({
        status: 'unknown',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        icon: <XCircle className="w-4 h-4" />,
        message: 'No data available',
        ageHours: null
      });
      return;
    }

    const updateTime = new Date(lastUpdated);
    const now = new Date();
    const ageMs = now.getTime() - updateTime.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageMinutes = ageMs / (1000 * 60);

    let status: FreshnessStatus;

    if (ageHours < 1) {
      // Less than 1 hour - Fresh
      status = {
        status: 'fresh',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: <CheckCircle className="w-4 h-4" />,
        message: ageMinutes < 1 ? 'Just updated' : `${Math.floor(ageMinutes)}m ago`,
        ageHours
      };
    } else if (ageHours < 3) {
      // 1-3 hours - Acceptable
      status = {
        status: 'acceptable',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        icon: <Clock className="w-4 h-4" />,
        message: `${Math.floor(ageHours)}h ${Math.floor((ageHours % 1) * 60)}m ago`,
        ageHours
      };
    } else if (ageHours < 6) {
      // 3-6 hours - Stale
      status = {
        status: 'stale',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        icon: <AlertTriangle className="w-4 h-4" />,
        message: `${Math.floor(ageHours)}h ago (stale)`,
        ageHours
      };
    } else {
      // Over 6 hours - Critical
      const ageDays = Math.floor(ageHours / 24);
      const remainingHours = Math.floor(ageHours % 24);
      
      status = {
        status: 'critical',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        icon: <XCircle className="w-4 h-4" />,
        message: ageDays > 0 
          ? `${ageDays}d ${remainingHours}h ago (critical)`
          : `${Math.floor(ageHours)}h ago (critical)`,
        ageHours
      };
    }

    setFreshnessStatus(status);
  }, [lastUpdated]);

  const handleRefresh = () => {
    if (onRefresh && !isLoading) {
      onRefresh();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Indicator */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${freshnessStatus.color} ${freshnessStatus.bgColor}`}>
        {isLoading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          freshnessStatus.icon
        )}
        <span>
          {isLoading ? 'Refreshing...' : freshnessStatus.message}
        </span>
      </div>

      {/* Refresh Button */}
      {showRefreshButton && onRefresh && (
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={`p-1 rounded-full transition-colors ${
            isLoading
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Detailed Tooltip on Hover */}
      {freshnessStatus.ageHours !== null && (
        <div className="relative group">
          <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
            <div className="text-center">
              <div className="font-medium">Data Age Details</div>
              <div className="mt-1">
                Last Updated: {new Date(lastUpdated!).toLocaleString()}
              </div>
              <div>
                Age: {freshnessStatus.ageHours.toFixed(1)} hours
              </div>
              <div className="mt-1 text-gray-300">
                {freshnessStatus.status === 'fresh' && 'Data is current and reliable'}
                {freshnessStatus.status === 'acceptable' && 'Data is reasonably current'}
                {freshnessStatus.status === 'stale' && 'Data may be outdated'}
                {freshnessStatus.status === 'critical' && 'Data is significantly outdated'}
              </div>
            </div>
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function to get freshness status for programmatic use
export function getDataFreshnessStatus(lastUpdated: string | null): {
  status: 'fresh' | 'acceptable' | 'stale' | 'critical' | 'unknown';
  ageHours: number | null;
  message: string;
} {
  if (!lastUpdated) {
    return {
      status: 'unknown',
      ageHours: null,
      message: 'No data available'
    };
  }

  const updateTime = new Date(lastUpdated);
  const now = new Date();
  const ageMs = now.getTime() - updateTime.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) {
    return {
      status: 'fresh',
      ageHours,
      message: 'Fresh data'
    };
  } else if (ageHours < 3) {
    return {
      status: 'acceptable',
      ageHours,
      message: 'Acceptable data age'
    };
  } else if (ageHours < 6) {
    return {
      status: 'stale',
      ageHours,
      message: 'Stale data'
    };
  } else {
    return {
      status: 'critical',
      ageHours,
      message: 'Critical data age'
    };
  }
}
