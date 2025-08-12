'use client';

import { useState, useEffect } from 'react';

interface LifecycleStatus {
  currentMonthCacheEntries: number;
  currentWeekCacheEntries: number;
  storedSummaries: number;
  oldestData: string;
  newestData: string;
  timestamp: string;
}

export default function DataLifecyclePage() {
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<{
    archiveMonths: boolean;
    archiveWeeks: boolean;
    cleanup: boolean;
  }>({
    archiveMonths: false,
    archiveWeeks: false,
    cleanup: false
  });

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/data-lifecycle-status');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.error('Failed to fetch lifecycle status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const runOperation = async (operation: 'months' | 'weeks' | 'cleanup') => {
    const endpoints = {
      months: '/api/automated/archive-completed-months',
      weeks: '/api/automated/archive-completed-weeks',
      cleanup: '/api/automated/cleanup-old-data'
    };

    const operationNames = {
      months: 'archiveMonths',
      weeks: 'archiveWeeks',
      cleanup: 'cleanup'
    };

    try {
      setOperations(prev => ({ ...prev, [operationNames[operation]]: true }));
      
      const response = await fetch(endpoints[operation], {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh status after successful operation
        await fetchStatus();
      } else {
        throw new Error(data.details || `${operation} operation failed`);
      }
    } catch (err) {
      console.error(`${operation} operation failed:`, err);
      setError(err instanceof Error ? err.message : `${operation} operation failed`);
    } finally {
      setOperations(prev => ({ ...prev, [operationNames[operation]]: false }));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const cronSchedule = [
    { name: 'Archive Completed Months', schedule: '0 1 1 * *', description: 'Monthly on 1st at 01:00' },
    { name: 'Archive Completed Weeks', schedule: '0 2 * * 1', description: 'Every Monday at 02:00' },
    { name: 'Cleanup Old Data', schedule: '0 4 1 * *', description: 'Monthly on 1st at 04:00' }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Data Lifecycle Management</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage automated data archival and cleanup processes
          </p>
        </div>
        <button 
          onClick={fetchStatus} 
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 rounded mb-6">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Current Month Cache</h3>
          <div className="text-2xl font-bold">
            {loading ? '...' : status?.currentMonthCacheEntries || 0}
          </div>
          <p className="text-xs text-gray-500">Active cache entries</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Current Week Cache</h3>
          <div className="text-2xl font-bold">
            {loading ? '...' : status?.currentWeekCacheEntries || 0}
          </div>
          <p className="text-xs text-gray-500">Active cache entries</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Stored Summaries</h3>
          <div className="text-2xl font-bold">
            {loading ? '...' : status?.storedSummaries || 0}
          </div>
          <p className="text-xs text-gray-500">Permanent storage</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Data Range</h3>
          <div className="text-sm font-bold">
            {loading ? '...' : (
              status?.oldestData !== 'None' && status?.newestData !== 'None' 
                ? `${status?.oldestData} to ${status?.newestData}`
                : 'No data'
            )}
          </div>
          <p className="text-xs text-gray-500">Available date range</p>
        </div>
      </div>

      {/* Manual Operations */}
      <div className="bg-white p-6 rounded-lg shadow border mb-8">
        <h2 className="text-xl font-bold mb-2">Manual Operations</h2>
        <p className="text-gray-600 mb-6">
          Manually trigger data lifecycle operations (normally run automatically via cron)
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium">Archive Completed Months</h4>
            <p className="text-sm text-gray-600">
              Move previous month cache data to permanent storage
            </p>
            <button 
              onClick={() => runOperation('months')}
              disabled={operations.archiveMonths}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {operations.archiveMonths ? 'Archiving...' : 'Archive Months'}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Archive Completed Weeks</h4>
            <p className="text-sm text-gray-600">
              Move previous week cache data to permanent storage
            </p>
            <button 
              onClick={() => runOperation('weeks')}
              disabled={operations.archiveWeeks}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {operations.archiveWeeks ? 'Archiving...' : 'Archive Weeks'}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Cleanup Old Data</h4>
            <p className="text-sm text-gray-600">
              Remove data older than 12 months from storage
            </p>
            <button 
              onClick={() => runOperation('cleanup')}
              disabled={operations.cleanup}
              className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {operations.cleanup ? 'Cleaning...' : 'Cleanup Old Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Automated Schedule */}
      <div className="bg-white p-6 rounded-lg shadow border mb-8">
        <h2 className="text-xl font-bold mb-2">Automated Schedule</h2>
        <p className="text-gray-600 mb-6">
          These operations run automatically according to the configured cron schedules
        </p>
        
        <div className="space-y-4">
          {cronSchedule.map((job, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">{job.name}</h4>
                <p className="text-sm text-gray-600">{job.description}</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                  {job.schedule}
                </span>
                <div className="flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  <span className="text-xs text-gray-500">Active</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow Explanation */}
      <div className="bg-white p-6 rounded-lg shadow border mb-8">
        <h2 className="text-xl font-bold mb-2">Data Lifecycle Flow</h2>
        <p className="text-gray-600 mb-6">How data moves through the system lifecycle</p>
        
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-blue-700">1. Active Period (Current Month/Week)</h4>
            <p className="text-sm text-gray-600">
              Data is cached with 3-hour refresh for fast access
            </p>
          </div>
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-green-700">2. Period Completion</h4>
            <p className="text-sm text-gray-600">
              When period ends, cache data is archived to permanent storage
            </p>
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <h4 className="font-medium text-orange-700">3. Historical Access (Last 12 Months)</h4>
            <p className="text-sm text-gray-600">
              Data served instantly from database for reports and comparisons
            </p>
          </div>
          <div className="border-l-4 border-red-500 pl-4">
            <h4 className="font-medium text-red-700">4. Old Data Cleanup (+12 Months)</h4>
            <p className="text-sm text-gray-600">
              Data older than 12 months is automatically removed to maintain performance
            </p>
          </div>
        </div>
      </div>

      {status && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h3 className="font-medium mb-2">System Status</h3>
          <div className="text-sm text-gray-600">
            Last updated: {new Date(status.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
} 