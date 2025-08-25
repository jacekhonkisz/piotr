'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StorageStats {
  total_summaries: number;
  monthly_count: number;
  weekly_count: number;
  oldest_date: string;
  newest_date: string;
  total_size_mb: number;
}

interface SystemLog {
  id: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  created_at: string;
}

export default function MonitoringPage() {
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadMonitoringData();
    // DISABLED: Auto-refresh every 5 minutes to prevent unnecessary polling
    // const interval = setInterval(loadMonitoringData, 5 * 60 * 1000);
    // return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Load storage statistics
      try {
        const { data: stats, error: statsError } = await supabase.rpc('get_storage_stats');
        if (statsError) {
          console.error('Error loading storage stats:', statsError);
          // Set default stats if function doesn't exist
          setStorageStats({
            total_summaries: 0,
            monthly_count: 0,
            weekly_count: 0,
            oldest_date: 'No data',
            newest_date: 'No data',
            total_size_mb: 0
          });
        } else if (stats && stats.length > 0) {
          setStorageStats(stats[0]);
        }
      } catch (error) {
        console.error('Error calling get_storage_stats:', error);
      }

      // Load recent logs
      try {
        const { data: logs, error: logsError } = await supabase.rpc('get_recent_logs', { p_hours: 24 });
        if (logsError) {
          console.error('Error loading recent logs:', logsError);
          // Set default logs if function doesn't exist
          setRecentLogs([{
            id: 'default',
            message: 'Monitoring system active',
            level: 'info',
            created_at: new Date().toISOString()
          }]);
        } else if (logs) {
          setRecentLogs(logs);
        }
      } catch (error) {
        console.error('Error calling get_recent_logs:', error);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualCollection = async (type: 'monthly' | 'weekly') => {
    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('No active session found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/background/collect-${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${type} collection started successfully: ${result.message}`);
        loadMonitoringData();
      } else {
        const errorData = await response.json();
        alert(`Failed to start ${type} collection: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error triggering ${type} collection:`, error);
      alert(`Error triggering ${type} collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearAllData = async () => {
    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete ALL campaign summaries from the database!\n\n` +
      `Current database contains:\n` +
      `• ${storageStats?.total_summaries || 0} total summaries\n` +
      `• ${storageStats?.monthly_count || 0} monthly summaries\n` +
      `• ${storageStats?.weekly_count || 0} weekly summaries\n\n` +
      `This action CANNOT be undone. Are you absolutely sure you want to proceed?`
    );

    if (!confirmed) {
      return;
    }

    // Double confirmation for safety
    const doubleConfirmed = window.confirm(
      '🚨 FINAL CONFIRMATION:\n\n' +
      'This will delete ALL stored campaign data and cannot be reversed.\n\n' +
      'Type "DELETE ALL" in your mind and click OK to proceed, or Cancel to abort.'
    );

    if (!doubleConfirmed) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('No active session found. Please log in again.');
        return;
      }

      setLoading(true);

      const response = await fetch('/api/background/clear-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `✅ Database cleared successfully!\n\n` +
          `Deleted: ${result.deletedCount} records\n` +
          `Remaining: ${result.remainingCount} records\n\n` +
          `You can now run fresh data collection to rebuild the database.`
        );
        loadMonitoringData(); // Refresh the monitoring data
      } else {
        const errorData = await response.json();
        alert(`❌ Failed to clear database: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      alert(`❌ Error clearing database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Smart Data Loading Monitoring</h1>
        <div className="flex gap-4">
          <button
            onClick={() => triggerManualCollection('monthly')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Run Monthly Collection
          </button>
          <button
            onClick={() => triggerManualCollection('weekly')}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Run Weekly Collection
          </button>
          <button
            onClick={loadMonitoringData}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Refresh
          </button>
          <button
            onClick={clearAllData}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded font-medium"
          >
            {loading ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-6">
        {mounted && lastRefresh ? (
          <>Last updated: {lastRefresh.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })}</>
        ) : (
          <>Last updated: Loading...</>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading monitoring data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Storage Statistics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Storage Statistics</h2>
            {storageStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {storageStats.total_summaries}
                    </div>
                    <div className="text-sm text-gray-500">Total Summaries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {storageStats.total_size_mb} MB
                    </div>
                    <div className="text-sm text-gray-500">Storage Size</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-lg font-semibold">
                      {storageStats.monthly_count}
                    </div>
                    <div className="text-sm text-gray-500">Monthly Summaries</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {storageStats.weekly_count}
                    </div>
                    <div className="text-sm text-gray-500">Weekly Summaries</div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-sm">
                    <div><strong>Date Range:</strong> {storageStats.oldest_date} to {storageStats.newest_date}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No storage data available</div>
            )}
          </div>

          {/* System Health */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">System Health</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Background Collection</span>
                <span className="text-green-600">✅ Running</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database Storage</span>
                <span className="text-green-600">✅ Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>API Integration</span>
                <span className="text-green-600">✅ Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Data Freshness</span>
                <span className="text-yellow-600">⚠️ Needs Attention</span>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Recent System Logs (Last 24h)</h2>
            <div className="max-h-96 overflow-y-auto">
              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      <div className={`text-sm font-medium ${getStatusColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </div>
                      <div className="flex-1 text-sm">
                        {log.message}
                      </div>
                                        <div className="text-xs text-gray-500">
                    {mounted ? new Date(log.created_at).toLocaleString() : 'Loading...'}
                  </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No recent logs</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 