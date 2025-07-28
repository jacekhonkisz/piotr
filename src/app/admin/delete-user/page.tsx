'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';

export default function DeleteUserPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('jac.honkisz@gmail.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const deleteUser = async () => {
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    if (!confirm(`Are you sure you want to delete user: ${email}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Call server-side API to delete user
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setResult({
        success: true,
        message: data.message,
        details: data.details
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Redirect if not admin
  if (!authLoading && (!user || profile?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Delete User from Supabase</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">⚠️ Warning</h2>
          <p className="text-red-600 mb-4">
            This will permanently delete a user from Supabase auth. This action cannot be undone.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address to Delete
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
            </div>
            
            <button
              onClick={deleteUser}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting User...' : 'Delete User'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`bg-white rounded-lg shadow p-6 ${
            result.success ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
          }`}>
            <h3 className={`text-lg font-medium mb-2 ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✅ Success' : '❌ Error'}
            </h3>
            
            <div className="space-y-2">
              {result.success ? (
                <p className="text-green-700">{result.message}</p>
              ) : (
                <p className="text-red-700">{result.error}</p>
              )}
              
              {result.details && (
                <div className="mt-4 p-3 bg-gray-100 rounded">
                  <pre className="text-sm text-gray-800">{JSON.stringify(result.details, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 