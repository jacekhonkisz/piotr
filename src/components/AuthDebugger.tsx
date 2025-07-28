'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface AuthDebuggerProps {
  enabled?: boolean;
}

export default function AuthDebugger({ enabled = process.env.NODE_ENV === 'development' }: AuthDebuggerProps) {
  const { user, profile, authLoading } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebugger, setShowDebugger] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] Auth: loading=${authLoading}, user=${user?.email || 'null'}, profile=${profile?.role || 'null'}`;
    
    setLogs(prev => [...prev.slice(-4), logEntry]); // Keep last 5 logs
  }, [user, profile, authLoading, enabled]);

  if (!enabled || !showDebugger) {
    return enabled ? (
      <button
        onClick={() => setShowDebugger(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-1 rounded text-xs z-50"
      >
        Debug Auth
      </button>
    ) : null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm">Auth Debug</h3>
        <button
          onClick={() => setShowDebugger(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      
      <div className="text-xs space-y-1">
        <div className={`font-medium ${authLoading ? 'text-orange-600' : 'text-green-600'}`}>
          Status: {authLoading ? 'Loading' : 'Ready'}
        </div>
        <div>User: {user?.email || 'None'}</div>
        <div>Profile: {profile?.role || 'None'}</div>
        <div>Path: {typeof window !== 'undefined' ? window.location.pathname : 'SSR'}</div>
      </div>
      
      <div className="mt-3 border-t pt-2">
        <div className="text-xs font-medium mb-1">Recent Logs:</div>
        <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="text-gray-600 font-mono">
              {log}
            </div>
          ))}
        </div>
      </div>
      
      <button
        onClick={() => setLogs([])}
        className="mt-2 text-xs bg-gray-100 px-2 py-1 rounded"
      >
        Clear Logs
      </button>
    </div>
  );
} 