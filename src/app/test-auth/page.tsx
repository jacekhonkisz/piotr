'use client';

import React from 'react';
import { useAuth } from '../../components/AuthProvider';

export default function TestAuthPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">User Status</h2>
            <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
            {user && (
              <>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>User ID:</strong> {user.id}</p>
              </>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Profile Status</h2>
            <p><strong>Profile Loaded:</strong> {profile ? 'Yes' : 'No'}</p>
            {profile && (
              <>
                <p><strong>Role:</strong> {profile.role}</p>
                <p><strong>Full Name:</strong> {profile.full_name}</p>
              </>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Actions</h2>
            <div className="space-x-4">
              <a 
                href="/dashboard" 
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
              <a 
                href="/auth/login" 
                className="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Go to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 