'use client';

import React, { useState } from 'react';
import { MetaAPIService } from '../../lib/meta-api';

export default function TestMetaValidation() {
  const [accessToken, setAccessToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testValidation = async () => {
    if (!accessToken || !adAccountId) {
      alert('Please enter both access token and ad account ID');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // Use server-side API for more detailed debugging
      const response = await fetch('/api/test-meta-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          adAccountId
        })
      });

      const results = await response.json();
      console.log('Full test results:', results);
      setResults(results);
    } catch (error) {
      console.error('Test error:', error);
      setResults({ error: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Meta API Validation Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Credentials</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Access Token
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your Meta access token"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ad Account ID
              </label>
              <input
                type="text"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="act_123456789 or 123456789"
              />
            </div>
            
            <button
              onClick={testValidation}
              disabled={loading || !accessToken || !adAccountId}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test Validation'}
            </button>
          </div>
        </div>

        {results && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            <div className="space-y-6">
              {/* Token Validation */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">1. Token Validation</h3>
                <div className={`p-3 rounded-md ${
                  results.tokenValidation?.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <strong>Status:</strong> {results.tokenValidation?.valid ? '✅ Valid' : '❌ Invalid'}<br/>
                  <strong>Error:</strong> {results.tokenValidation?.error || 'None'}<br/>
                  <strong>Permissions:</strong> {results.tokenValidation?.permissions?.join(', ') || 'None detected'}
                </div>
              </div>

              {/* Account Validation */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">2. Ad Account Validation</h3>
                <div className={`p-3 rounded-md ${
                  results.accountValidation?.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <strong>Status:</strong> {results.accountValidation?.valid ? '✅ Valid' : '❌ Invalid'}<br/>
                  <strong>Error:</strong> {results.accountValidation?.error || 'None'}<br/>
                  {results.accountValidation?.account && (
                    <>
                      <strong>Account Name:</strong> {results.accountValidation.account.name}<br/>
                      <strong>Account ID:</strong> {results.accountValidation.account.account_id}<br/>
                      <strong>Status:</strong> {results.accountValidation.account.account_status}<br/>
                      <strong>Currency:</strong> {results.accountValidation.account.currency}
                    </>
                  )}
                </div>
              </div>

              {/* Ad Accounts List */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">3. Available Ad Accounts</h3>
                {results.adAccountsError ? (
                  <div className="p-3 rounded-md bg-red-100 text-red-800">
                    <strong>Error:</strong> {results.adAccountsError.toString()}
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-blue-100 text-blue-800">
                    <strong>Found {results.adAccounts?.length || 0} ad accounts:</strong>
                    {results.adAccounts?.map((account: any, index: number) => (
                      <div key={index} className="mt-2 p-2 bg-white rounded border">
                        <strong>Name:</strong> {account.name}<br/>
                        <strong>ID:</strong> {account.id}<br/>
                        <strong>Account ID:</strong> {account.account_id}<br/>
                        <strong>Currency:</strong> {account.currency}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campaigns */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">4. Campaign Access</h3>
                {results.campaignsError ? (
                  <div className="p-3 rounded-md bg-red-100 text-red-800">
                    <strong>Error:</strong> {results.campaignsError.toString()}
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-green-100 text-green-800">
                    <strong>Found {results.campaigns?.length || 0} campaigns</strong>
                    {results.campaigns?.slice(0, 3).map((campaign: any, index: number) => (
                      <div key={index} className="mt-2 p-2 bg-white rounded border">
                        <strong>Name:</strong> {campaign.name}<br/>
                        <strong>ID:</strong> {campaign.id}<br/>
                        <strong>Status:</strong> {campaign.status}
                      </div>
                    ))}
                    {results.campaigns?.length > 3 && (
                      <div className="mt-2 text-sm text-gray-600">
                        ... and {results.campaigns.length - 3} more campaigns
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Raw API Call Results */}
              {results.rawApiCall && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">5. Raw API Call Debug</h3>
                  <div className="p-3 rounded-md bg-yellow-100 text-yellow-800">
                    <strong>Status:</strong> {results.rawApiCall.status} {results.rawApiCall.statusText}<br/>
                    <strong>Response Body:</strong><br/>
                    <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-x-auto">
                      {results.rawApiCall.body}
                    </pre>
                  </div>
                </div>
              )}

              {results.rawApiCallError && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">5. Raw API Call Error</h3>
                  <div className="p-3 rounded-md bg-red-100 text-red-800">
                    <strong>Error:</strong> {results.rawApiCallError}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-100 rounded-md">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Summary</h3>
                <div className="space-y-1">
                  <div>✅ Token Valid: {results.tokenValidation?.valid ? 'Yes' : 'No'}</div>
                  <div>✅ Account Access: {results.accountValidation?.valid ? 'Yes' : 'No'}</div>
                  <div>✅ Campaign Access: {results.campaignsError ? 'No' : 'Yes'}</div>
                  <div>📊 Available Accounts: {results.adAccounts?.length || 0}</div>
                  <div>📈 Available Campaigns: {results.campaigns?.length || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 