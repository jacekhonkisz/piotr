'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface MultiTokenClientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editClient?: any;
}

export default function MultiTokenClientForm({ onSuccess, onCancel, editClient }: MultiTokenClientFormProps) {
  const [formData, setFormData] = useState({
    name: editClient?.name || '',
    email: editClient?.email || '',
    meta_access_token: editClient?.meta_access_token || '',
    ad_account_id: editClient?.ad_account_id || '',
    meta_account_name: editClient?.meta_account_name || '',
    role: editClient?.role || 'client'
  });
  
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [validatingToken, setValidatingToken] = useState(false);
  const [availableAdAccounts, setAvailableAdAccounts] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      if (editClient) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editClient.id);

        if (error) throw error;
      } else {
        // Create new client
        const { error } = await supabase
          .from('clients')
          .insert([{
            ...formData,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Error saving client');
    } finally {
      setLoading(false);
    }
  };

  const validateToken = async () => {
    if (!formData.meta_access_token) {
      alert('Please enter a Meta API token first');
      return;
    }

    setValidatingToken(true);
    try {
      const response = await fetch('/api/test-meta-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.meta_access_token })
      });

      const result = await response.json();
      setTokenValid(result.valid);
      
      if (result.valid) {
        alert('✅ Token is valid and can access Meta API!');
        // Fetch available ad accounts
        await fetchAvailableAdAccounts();
      } else {
        alert('❌ Token validation failed: ' + result.error);
      }
    } catch (error) {
      setTokenValid(false);
      alert('❌ Error validating token');
    } finally {
      setValidatingToken(false);
    }
  };

  const fetchAvailableAdAccounts = async () => {
    try {
      const response = await fetch('/api/get-ad-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.meta_access_token })
      });

      const result = await response.json();
      if (result.success) {
        setAvailableAdAccounts(result.adAccounts);
      }
    } catch (error) {
      console.error('Error fetching ad accounts:', error);
    }
  };

  const testConnection = async () => {
    if (!formData.meta_access_token || !formData.ad_account_id) {
      alert('Please enter both token and ad account ID');
      return;
    }

    setValidatingToken(true);
    try {
      const response = await fetch('/api/test-meta-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: formData.meta_access_token,
          adAccountId: formData.ad_account_id
        })
      });

      const result = await response.json();
      
      if (result.valid) {
        alert(`✅ Connection successful!\nFound ${result.campaigns?.length || 0} campaigns`);
      } else {
        alert('❌ Connection failed: ' + result.error);
      }
    } catch (error) {
      alert('❌ Error testing connection');
    } finally {
      setValidatingToken(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">
        {editClient ? 'Edytuj klienta' : 'Dodaj nowego klienta'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter client name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="client@example.com"
            />
          </div>
        </div>

        {/* Meta Account Information */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meta Account Name
          </label>
          <input
            type="text"
            value={formData.meta_account_name}
            onChange={(e) => setFormData({...formData, meta_account_name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Client's Business Manager Name"
          />
          <p className="text-sm text-gray-500 mt-1">
            Optional: Helps identify which Meta account this client belongs to
          </p>
        </div>

        {/* Meta API Configuration */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Meta API Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta API Token *
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  required
                  value={formData.meta_access_token}
                  onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EAA..."
                />
                <button
                  type="button"
                  onClick={validateToken}
                  disabled={validatingToken}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {validatingToken ? 'Validating...' : 'Validate'}
                </button>
              </div>
              {tokenValid !== null && (
                <div className={`mt-1 text-sm ${tokenValid ? 'text-green-600' : 'text-red-600'}`}>
                  {tokenValid ? '✅ Token is valid' : '❌ Token is invalid'}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Each client needs their own Meta API token from their Meta account
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ad Account ID *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.ad_account_id}
                  onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 703853679965014"
                />
                <button
                  type="button"
                  onClick={fetchAvailableAdAccounts}
                  disabled={!formData.meta_access_token}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  Find Accounts
                </button>
              </div>
              
              {/* Available Ad Accounts */}
              {availableAdAccounts.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">Available Ad Accounts:</p>
                  <div className="space-y-1">
                    {availableAdAccounts.map((account, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setFormData({...formData, ad_account_id: account.id})}
                        className="block w-full text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
                      >
                        <strong>{account.name}</strong> (ID: {account.id})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={testConnection}
                disabled={validatingToken || !formData.meta_access_token || !formData.ad_account_id}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {validatingToken ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (editClient ? 'Update Client' : 'Add Client')}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
} 