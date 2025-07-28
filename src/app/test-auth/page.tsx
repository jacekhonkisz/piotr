'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

export default function TestAuthPage() {
  const { user, profile, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const fetchDebugInfo = async () => {
      if (user) {
        try {
          // Test database connection
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id);

          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('*');

          setDebugInfo({
            user: {
              id: user.id,
              email: user.email,
              created_at: user.created_at,
            },
            profile,
            profilesFromDB: profiles,
            profileError: profileError?.message,
            clientsFromDB: clients,
            clientsError: clientsError?.message,
            loading,
          });
        } catch (error) {
          setDebugInfo({
            error: error instanceof Error ? error.message : 'Unknown error',
            user: {
              id: user.id,
              email: user.email,
            },
            profile,
            loading,
          });
        }
      } else {
        setDebugInfo({
          user: null,
          profile: null,
          loading,
        });
      }
    };

    fetchDebugInfo();
  }, [user, profile, loading]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication Debug</h1>
        
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Current State</h2>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900">Loading State:</h3>
                  <p className="text-gray-600">{loading ? 'Loading...' : 'Loaded'}</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900">User:</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(debugInfo.user, null, 2)}
                  </pre>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900">Profile:</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(debugInfo.profile, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Database Test</h2>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900">Profiles from DB:</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(debugInfo.profilesFromDB, null, 2)}
                  </pre>
                  {debugInfo.profileError && (
                    <p className="text-red-600 mt-2">Error: {debugInfo.profileError}</p>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900">Clients from DB:</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(debugInfo.clientsFromDB, null, 2)}
                  </pre>
                  {debugInfo.clientsError && (
                    <p className="text-red-600 mt-2">Error: {debugInfo.clientsError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {debugInfo.error && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-red-600">Error</h2>
              </div>
              <div className="card-body">
                <p className="text-red-600">{debugInfo.error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 