'use client';

import React from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

export default function DebugAuthPage() {
  const { user, profile, loading } = useAuth();
  const [session, setSession] = React.useState<any>(null);

  React.useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();
  }, []);

  const clearSession = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Auth State</h2>
            <div className="space-y-2">
              <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
              <p><strong>User:</strong> {user ? user.email : 'None'}</p>
              <p><strong>Profile:</strong> {profile ? profile.id : 'None'}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Session</h2>
            <div className="space-y-2">
              <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
              {session && (
                <div className="text-sm">
                  <p><strong>User ID:</strong> {session.user.id}</p>
                  <p><strong>Email:</strong> {session.user.email}</p>
                  <p><strong>Created:</strong> {new Date(session.user.created_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={clearSession}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Clear Session
            </button>
            <a
              href="/auth/login"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block"
            >
              Go to Login
            </a>
            <a
                              href={profile?.role === 'admin' ? '/admin' : '/dashboard'}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block"
            >
                              {profile?.role === 'admin' ? 'Go to Admin' : 'Go to Dashboard'}
            </a>
          </div>
        </div>

        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Raw Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify({ user, profile, session }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
} 