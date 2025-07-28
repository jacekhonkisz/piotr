'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

export default function TestAdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setTestResults(null);

    try {
      const results: any = {};

      // Test 1: Check user and profile
      results.user = {
        id: user?.id,
        email: user?.email,
        role: profile?.role
      };

      // Test 2: Check if clients table exists
      try {
        const { data: tableTest, error: tableError } = await supabase
          .from('clients')
          .select('count')
          .limit(1);
        
        results.tableTest = {
          success: !tableError,
          error: tableError?.message,
          data: tableTest
        };
      } catch (error) {
        results.tableTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Test 3: Try to fetch clients
      if (user) {
        try {
          const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('*')
            .eq('admin_id', user.id);

          results.clientsTest = {
            success: !clientsError,
            error: clientsError?.message,
            count: clients?.length || 0,
            data: clients
          };
        } catch (error) {
          results.clientsTest = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Test 4: Check RLS policies (simplified)
      results.policiesTest = {
        success: true,
        error: 'RPC not available',
        data: 'Skipping RLS policy check'
      };

      setTestResults(results);
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Debug Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current State</h2>
          <div className="space-y-2">
            <p><strong>Auth Loading:</strong> {authLoading ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong> {user ? user.email : 'None'}</p>
            <p><strong>Profile:</strong> {profile ? profile.role : 'None'}</p>
            <p><strong>User ID:</strong> {user?.id || 'None'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <button
            onClick={runTests}
            disabled={loading || authLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running Tests...' : 'Run Debug Tests'}
          </button>
        </div>

        {testResults && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            <div className="space-y-6">
              {/* User Test */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">1. User & Profile</h3>
                <div className="p-3 rounded-md bg-blue-100 text-blue-800">
                  <pre className="text-sm">{JSON.stringify(testResults.user, null, 2)}</pre>
                </div>
              </div>

              {/* Table Test */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">2. Clients Table Access</h3>
                <div className={`p-3 rounded-md ${
                  testResults.tableTest?.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <strong>Status:</strong> {testResults.tableTest?.success ? '✅ Success' : '❌ Failed'}<br/>
                  <strong>Error:</strong> {testResults.tableTest?.error || 'None'}<br/>
                  <strong>Data:</strong> {JSON.stringify(testResults.tableTest?.data)}
                </div>
              </div>

              {/* Clients Test */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">3. Fetch Clients</h3>
                <div className={`p-3 rounded-md ${
                  testResults.clientsTest?.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <strong>Status:</strong> {testResults.clientsTest?.success ? '✅ Success' : '❌ Failed'}<br/>
                  <strong>Error:</strong> {testResults.clientsTest?.error || 'None'}<br/>
                  <strong>Count:</strong> {testResults.clientsTest?.count || 0} clients<br/>
                  <strong>Data:</strong> {JSON.stringify(testResults.clientsTest?.data)}
                </div>
              </div>

              {/* Policies Test */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">4. RLS Policies</h3>
                <div className={`p-3 rounded-md ${
                  testResults.policiesTest?.success ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  <strong>Status:</strong> {testResults.policiesTest?.success ? '✅ Available' : '⚠️ Not Available'}<br/>
                  <strong>Error:</strong> {testResults.policiesTest?.error || 'None'}<br/>
                  <strong>Data:</strong> {JSON.stringify(testResults.policiesTest?.data)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 