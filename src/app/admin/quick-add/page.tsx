'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Settings, ArrowLeft } from 'lucide-react';
import QuickAddClient from '../../../components/QuickAddClient';
import { useAuth } from '../../../components/AuthProvider';

export default function QuickAddPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();

  // Check if user is admin
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
          <button
                          onClick={() => router.push('/admin')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
                            Go to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Powrót do Admina
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Quick Add Client</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Welcome, {user?.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showAddForm ? (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center space-x-3 mb-4">
                <Plus className="w-8 h-8 text-blue-500" />
                <h2 className="text-xl font-semibold">Quick Client Setup</h2>
              </div>
              
              <p className="text-gray-600 mb-6">
                Add new clients quickly and easily. Each client gets their own permanent token and isolated data access.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-900">Individual Access</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    Each client gets their own permanent token and can only see their own data.
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Settings className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-green-900">Permanent Tokens</h3>
                  </div>
                  <p className="text-sm text-green-700">
                    System User tokens never expire, providing permanent access to Meta ads data.
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Plus className="w-5 h-5 text-purple-500" />
                    <h3 className="font-semibold text-purple-900">Quick Setup</h3>
                  </div>
                  <p className="text-sm text-purple-700">
                    Add clients in minutes with our streamlined onboarding process.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddForm(true)}
                className="w-full md:w-auto px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Client</span>
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">How It Works</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Dodaj szczegóły klienta</h4>
                    <p className="text-sm text-gray-600">
                      Enter client name, email, and optional Meta account information.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Generate Permanent Token</h4>
                    <p className="text-sm text-gray-600">
                      System creates a permanent System User token that never expires.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Send Instructions</h4>
                    <p className="text-sm text-gray-600">
                      Copy and send instructions to client for Business Manager access.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Client Can Log In</h4>
                    <p className="text-sm text-gray-600">
                      Client logs in and sees only their own campaigns and data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Benefits</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Complete data isolation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Permanent tokens (no expiration)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Professional setup</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Quick onboarding process</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Scalable to 20+ clients</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Admin panel management</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <QuickAddClient
            onSuccess={() => {
              setShowAddForm(false);
              // Optionally refresh the page or show success message
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  );
} 