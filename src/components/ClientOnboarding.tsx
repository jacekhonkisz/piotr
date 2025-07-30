'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ClientOnboardingProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ClientOnboarding({ onSuccess, onCancel }: ClientOnboardingProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessManagerId: '',
    adAccountId: '',
    metaAccountName: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [systemUserToken, setSystemUserToken] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Starting client onboarding...');

    try {
      // Step 1: Create client record
      setStatus('Creating client record...');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([{
          name: formData.name,
          email: formData.email,
          business_manager_id: formData.businessManagerId,
          ad_account_id: formData.adAccountId,
          meta_account_name: formData.metaAccountName,
          status: 'pending_setup',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      // Step 2: Create System User via API
      setStatus('Creating System User...');
      const systemUserResponse = await fetch('/api/create-system-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          businessManagerId: formData.businessManagerId,
          adAccountId: formData.adAccountId,
          clientName: formData.name
        })
      });

      const systemUserResult = await systemUserResponse.json();
      
      if (!systemUserResult.success) {
        throw new Error(systemUserResult.error);
      }

      setSystemUserToken(systemUserResult.token);
      setStatus('System User created successfully!');
      setStep(2);

      // Step 3: Update client with token
      setStatus('Updating client with permanent token...');
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          meta_access_token: systemUserResult.token,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      setStatus('Client onboarding completed successfully!');
      onSuccess?.();

    } catch (error) {
      console.error('Onboarding error:', error);
      setStatus(`Error: ${(error as any).message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateInstructions = () => {
    return `
# Client Onboarding Instructions

## For: ${formData.name} (${formData.email})

### Step 1: Business Manager Access
1. Go to: https://business.facebook.com/
2. Click "Business Settings" (gear icon)
3. Go to "Users" → "People"
4. Click "Add" → "Add People"
5. Enter: [YOUR_EMAIL]
6. Role: "Admin"
7. Click "Add"

### Step 2: Provide Information
Please provide us with:
- Business Manager ID: [Ask client to find this in Business Settings]
- Ad Account ID: [Ask client to find this in Ads Manager]

### Step 3: We'll Handle the Rest
Once you have access, we'll:
1. Create a System User for this client
2. Generate a permanent API token
3. Connect their ad accounts
4. Set up their dashboard

### Estimated Time: 10-15 minutes
    `;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Client Onboarding</h2>
      
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Account Name
            </label>
            <input
              type="text"
              value={formData.metaAccountName}
              onChange={(e) => setFormData({...formData, metaAccountName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Client's Business Manager Name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Manager ID
              </label>
              <input
                type="text"
                value={formData.businessManagerId}
                onChange={(e) => setFormData({...formData, businessManagerId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 123456789"
              />
              <p className="text-sm text-gray-500 mt-1">
                Client can find this in Business Settings
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ad Account ID
              </label>
              <input
                type="text"
                value={formData.adAccountId}
                onChange={(e) => setFormData({...formData, adAccountId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 703853679965014"
              />
              <p className="text-sm text-gray-500 mt-1">
                Client can find this in Ads Manager
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Setting Up...' : 'Start Onboarding'}
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

          {status && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">{status}</p>
            </div>
          )}
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Onboarding Complete!</h3>
            <p className="text-green-700">
              Client <strong>{formData.name}</strong> has been successfully onboarded with a permanent System User token.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Generated System User Token:</h4>
            <div className="p-3 bg-gray-50 border rounded-md">
              <code className="text-sm break-all">{systemUserToken}</code>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              This token never expires and provides permanent access to the client&apos;s Meta ads data.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Next Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Client can now log in to their dashboard</li>
              <li>They will see only their own campaigns and data</li>
              <li>No token renewal needed - access is permanent</li>
              <li>Monitor their data in the admin panel</li>
            </ol>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep(1);
                setFormData({
                  name: '',
                  email: '',
                  businessManagerId: '',
                  adAccountId: '',
                  metaAccountName: ''
                });
                setSystemUserToken('');
                setStatus('');
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Another Client
            </button>
            
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h4 className="font-semibold mb-2">📋 Client Instructions Template:</h4>
        <pre className="text-sm bg-white p-3 rounded border overflow-auto">
          {generateInstructions()}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(generateInstructions())}
          className="mt-2 px-4 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          Copy Instructions
        </button>
      </div>
    </div>
  );
} 