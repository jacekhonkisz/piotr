'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { MetaAPIService } from '../lib/meta-api';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (clientId: string, updates: Partial<Client>) => Promise<void>;
  client: Client | null;
}

export default function EditClientModal({ isOpen, onClose, onUpdate, client }: EditClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    ad_account_id: '',
    meta_access_token: '',
    reporting_frequency: 'monthly' as Database['public']['Enums']['reporting_frequency'],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [submitError, setSubmitError] = useState<string>('');
  const [showTokenField, setShowTokenField] = useState(false);

  // Initialize form data when client changes
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        company: client.company || '',
        ad_account_id: client.ad_account_id || '',
        meta_access_token: '', // Don't pre-fill token for security
        reporting_frequency: client.reporting_frequency || 'monthly',
        notes: client.notes || ''
      });
      setValidationStatus({ status: 'idle', message: '' });
      setSubmitError('');
      setShowTokenField(false);
    }
  }, [client]);

  const validateMetaCredentials = async () => {
    if (!formData.ad_account_id || !formData.meta_access_token) {
      setValidationStatus({ status: 'invalid', message: 'Please fill in both Ad Account ID and Access Token' });
      return;
    }

    setValidating(true);
    setValidationStatus({ status: 'validating', message: 'Validating and converting Meta Ads credentials...' });

    try {
      const metaService = new MetaAPIService(formData.meta_access_token);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        setValidationStatus({ 
          status: 'invalid', 
          message: `Token validation failed: ${tokenValidation.error}` 
        });
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        setValidationStatus({ 
          status: 'invalid', 
          message: `Ad Account validation failed: ${accountValidation.error}` 
        });
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}. Found ${campaigns.length} campaigns.`;
        
        // Enhanced token status information
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += ` ⚠️ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          } else {
            statusMessage += ` ⏰ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.`;
        
        // Enhanced token status information
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += ` ⚠️ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          } else {
            statusMessage += ` ⏰ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      }

    } catch (error) {
      setValidationStatus({ 
        status: 'invalid', 
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) return;
    
    // Clear previous errors
    setSubmitError('');
    
    // If token field is shown and filled, validate it
    if (showTokenField && formData.meta_access_token && validationStatus.status !== 'valid') {
      setValidationStatus({ status: 'invalid', message: 'Please validate your Meta Ads credentials first' });
      return;
    }

    setLoading(true);
    try {
      // Prepare updates - only include fields that have changed
      const updates: Partial<Client> = {};
      
      if (formData.name !== client.name) updates.name = formData.name;
      if (formData.email !== client.email) updates.email = formData.email;
      if (formData.company !== client.company) updates.company = formData.company;
      if (formData.ad_account_id !== client.ad_account_id) updates.ad_account_id = formData.ad_account_id;
      if (formData.reporting_frequency !== client.reporting_frequency) updates.reporting_frequency = formData.reporting_frequency;
      if (formData.notes !== client.notes) updates.notes = formData.notes;
      
      // Only include token if it was changed
      if (showTokenField && formData.meta_access_token) {
        updates.meta_access_token = formData.meta_access_token;
      }

      await onUpdate(client.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update client. Please try again.';
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Edit Client: {client.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter company name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="contact@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Ad Account ID *
            </label>
            <input
              type="text"
              required
              value={formData.ad_account_id}
              onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="act_123456789"
            />
          </div>
          
          {/* Token Management Section */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Meta Access Token</span>
              <button
                type="button"
                onClick={() => setShowTokenField(!showTokenField)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showTokenField ? 'Hide' : 'Update Token'}
              </button>
            </div>
            
            {showTokenField ? (
              <div className="space-y-3">
                <input
                  type="password"
                  value={formData.meta_access_token}
                  onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter new Meta access token"
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Current token health: {client.token_health_status || 'unknown'}</span>
                  <button
                    type="button"
                    onClick={validateMetaCredentials}
                    disabled={validating || !formData.ad_account_id || !formData.meta_access_token}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {validating ? 'Validating...' : 'Validate'}
                  </button>
                </div>
                
                {validationStatus.status !== 'idle' && (
                  <div className={`text-sm p-2 rounded ${
                    validationStatus.status === 'valid' ? 'bg-green-100 text-green-800' :
                    validationStatus.status === 'invalid' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {validationStatus.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Token: ••••••••••••••••</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    client.token_health_status === 'valid' ? 'bg-green-100 text-green-800' :
                    client.token_health_status === 'expiring_soon' ? 'bg-orange-100 text-orange-800' :
                    client.token_health_status === 'expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {client.token_health_status || 'unknown'}
                  </span>
                </div>
                {client.token_expires_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Expires: {new Date(client.token_expires_at).toLocaleDateString()}
                  </div>
                )}
                {client.last_token_validation && (
                  <div className="text-xs text-gray-500">
                    Last validated: {new Date(client.last_token_validation).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Submit Error Display */}
          {submitError && (
            <div className="bg-red-100 text-red-800 text-sm p-3 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {submitError}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reporting Frequency
            </label>
            <select
              value={formData.reporting_frequency}
              onChange={(e) => setFormData({...formData, reporting_frequency: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="on_demand">On Demand</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Optional notes about this client"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (showTokenField && formData.meta_access_token && validationStatus.status !== 'valid') || false}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 