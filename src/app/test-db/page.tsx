'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function TestDBPage() {
  const [status, setStatus] = useState<string>('Testing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        setStatus('Testing Supabase connection...');
        
        // Test basic connection
        const { data, error: connError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        if (connError) {
          throw new Error(`Connection error: ${connError.message}`);
        }
        
        setStatus('Connection successful! Testing auth...');
        
        // Test auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          throw new Error(`Auth error: ${authError.message}`);
        }
        
        if (!user) {
          setStatus('No user logged in');
          return;
        }
        
        setStatus(`User found: ${user.email}`);
        
        // Test profile fetch
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          throw new Error(`Profile error: ${profileError.message}`);
        }
        
        setStatus(`Profile loaded: ${JSON.stringify(profile, null, 2)}`);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('Error occurred');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Status:</h2>
          <p className="text-gray-700 mb-4">{status}</p>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h3 className="text-red-800 font-semibold">Error:</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 