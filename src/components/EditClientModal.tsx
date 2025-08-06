'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, RefreshCw, Key, Shield } from 'lucide-react';
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
    system_user_token: '',
    reporting_frequency: 'monthly' as Database['public']['Enums']['reporting_frequency'],
    send_day: 5,
    notes: '',
    contact_emails: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [submitError, setSubmitError] = useState<string>('');
  const [showTokenFields, setShowTokenFields] = useState(false);
  const [adAccountIdError, setAdAccountIdError] = useState<string>('');

  // Initialize form data when client changes
  useEffect(() => {
    if (client) {
      // Get all contact emails except the main email (which is shown separately)
      const contactEmails = client.contact_emails || [];
      const additionalEmails = contactEmails.filter(email => email !== client.email);
      
      console.log('Initializing client form:', {
        mainEmail: client.email,
        allContactEmails: contactEmails,
        additionalEmails: additionalEmails
      });
      
      setFormData({
        name: client.name || '',
        email: client.email || '', // This should always be the original login email
        company: client.company || '',
        ad_account_id: client.ad_account_id || '',
        meta_access_token: '', // Don't pre-fill tokens for security
        system_user_token: '', // Don't pre-fill tokens for security
        reporting_frequency: client.reporting_frequency || 'monthly',
        send_day: client.send_day || 5,
        notes: client.notes || '',
        contact_emails: additionalEmails
      });
      setValidationStatus({ status: 'idle', message: '' });
      setSubmitError('');
      setShowTokenFields(false);
      setAdAccountIdError('');
    }
  }, [client]);

  // Validate Ad Account ID format in real-time
  const validateAdAccountIdFormat = (accountId: string) => {
    if (!accountId) {
      setAdAccountIdError('');
      return true;
    }
    
    // Accept both formats: "act_123456789" or just "123456789"
    const actPattern = /^(act_)?\d+$/;
    if (!actPattern.test(accountId)) {
      setAdAccountIdError('ID konta reklamowego powinien zawierać tylko cyfry lub zaczynać się od "act_" po którym następują cyfry (np. 123456789 lub act_123456789)');
      return false;
    }
    
    // Check if it's at least 9 digits (for numeric-only format) or 12 characters (for act_ format)
    const numericPart = accountId.replace('act_', '');
    if (numericPart.length < 9) {
      setAdAccountIdError('ID konta reklamowego wydaje się za krótki. Sprawdź format.');
      return false;
    }
    
    setAdAccountIdError('');
    return true;
  };

  const handleAdAccountIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFormData({...formData, ad_account_id: newValue});
    validateAdAccountIdFormat(newValue);
  };

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  // Add a new email to the contact_emails array
  const addEmail = () => {
    setFormData({
      ...formData,
      contact_emails: [...formData.contact_emails, '']
    });
  };

  // Remove an email from the contact_emails array
  const removeEmail = (index: number) => {
    if (index === 0) return; // Don't allow removing the main email
    const newEmails = formData.contact_emails.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      contact_emails: newEmails
    });
  };

  // Update an email in the contact_emails array
  const updateEmail = (index: number, value: string) => {
    const newEmails = [...formData.contact_emails];
    newEmails[index] = value;
    setFormData({
      ...formData,
      contact_emails: newEmails
    });
  };

  // Validate all emails before submission
  const validateEmails = (): boolean => {
    // Check if main email is valid
    if (!validateEmail(formData.email)) {
      return false;
    }
    
    // Check if all contact emails are valid
    for (let i = 0; i < formData.contact_emails.length; i++) {
      const email = formData.contact_emails[i];
      if (email && !validateEmail(email)) {
        return false;
      }
    }
    
    // Check for duplicates
    const allEmails = [formData.email, ...formData.contact_emails.filter(email => email && email.trim() !== '')];
    const uniqueEmails = new Set(allEmails);
    if (allEmails.length !== uniqueEmails.size) {
      return false;
    }
    
    return true;
  };

  const validateMetaCredentials = async () => {
    // Check if Ad Account ID is provided (required)
    if (!formData.ad_account_id) {
      setValidationStatus({ status: 'invalid', message: 'Meta Ad Account ID is required' });
      return;
    }
    
    // Validate Ad Account ID format
    if (!validateAdAccountIdFormat(formData.ad_account_id)) {
      setValidationStatus({ status: 'invalid', message: 'Please fix the Ad Account ID format before validating' });
      return;
    }
    
    // Check if at least one token is provided
    if (!formData.meta_access_token && !formData.system_user_token) {
      setValidationStatus({ status: 'invalid', message: 'Please provide either a Meta Access Token (60 days) or System User Token (permanent)' });
      return;
    }
    
    // Use System User token if provided (permanent), otherwise use regular access token (60 days)
    const tokenToUse = formData.system_user_token || formData.meta_access_token;
    const tokenType = formData.system_user_token ? 'System User Token (Permanent)' : 'Meta Access Token (60 days)';

    setValidating(true);
    setValidationStatus({ status: 'validating', message: `Validating ${tokenType}...` });

    try {
      const metaService = new MetaAPIService(tokenToUse);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        let errorMessage = `Token validation failed: ${tokenValidation.error}`;
        
        // Provide helpful guidance based on error type
        if (tokenValidation.error?.includes('expired')) {
          errorMessage += '\n💡 Tip: Use a System User token for permanent access that never expires.';
        } else if (tokenValidation.error?.includes('permissions')) {
          errorMessage += '\n💡 Tip: Make sure your token has ads_read and ads_management permissions.';
        } else if (tokenValidation.error?.includes('invalid')) {
          errorMessage += '\n💡 Tip: Check that your token starts with "EAA" and is copied correctly.';
        }
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        let errorMessage = `Ad Account validation failed: ${accountValidation.error}`;
        
        // Provide helpful guidance
        if (accountValidation.error?.includes('not found')) {
          errorMessage += '\n💡 Tip: Check your Ad Account ID format (should be like "act_123456789").';
        } else if (accountValidation.error?.includes('access denied')) {
          errorMessage += '\n💡 Tip: Make sure your token has access to this ad account.';
        }
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Found ${campaigns.length} campaigns.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
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
    
    // Validate emails
    if (!validateEmails()) {
      setSubmitError('Please fix email validation errors before saving');
      return;
    }
    
    // Validate Ad Account ID format
    if (!validateAdAccountIdFormat(formData.ad_account_id)) {
      setSubmitError('Please fix the Ad Account ID format before saving');
      return;
    }
    
    // If token fields are shown and filled, validate them
    if (showTokenFields && (formData.meta_access_token || formData.system_user_token) && validationStatus.status !== 'valid') {
      setValidationStatus({ status: 'invalid', message: 'Proszę najpierw zweryfikować swoje poświadczenia Meta Ads' });
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
      if (formData.send_day !== client.send_day) updates.send_day = formData.send_day;
      if (formData.notes !== client.notes) updates.notes = formData.notes;
      
      // Update contact_emails - ensure main email is always first and no duplicates
      const additionalEmails = formData.contact_emails.filter(email => email && email.trim() !== '' && email !== formData.email);
      const updatedContactEmails = [formData.email, ...additionalEmails];
      
      console.log('Saving contact emails:', {
        currentClientEmails: client.contact_emails,
        newContactEmails: updatedContactEmails,
        willUpdate: JSON.stringify(updatedContactEmails) !== JSON.stringify(client.contact_emails || [client.email])
      });
      
      if (JSON.stringify(updatedContactEmails) !== JSON.stringify(client.contact_emails || [client.email])) {
        updates.contact_emails = updatedContactEmails;
      }
      
      // Only include tokens if they were changed
      if (showTokenFields) {
        if (formData.system_user_token) {
          updates.system_user_token = formData.system_user_token;
          // Clear meta_access_token if system user token is provided
          updates.meta_access_token = null;
        } else if (formData.meta_access_token) {
          updates.meta_access_token = formData.meta_access_token;
          // Clear system_user_token if meta access token is provided
          updates.system_user_token = null;
        }
      }

      await onUpdate(client.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nie udało się zaktualizować klienta. Spróbuj ponownie.';
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
          <h2 className="text-lg font-semibold">Edytuj klienta: {client.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa firmy *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Wprowadź nazwę firmy"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adres e-mail kontaktowy * (Główne logowanie)
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
              placeholder="contact@company.com"
              title="To jest główny adres e-mail logowania i nie może być zmieniony"
            />
            <p className="text-xs text-gray-500 mt-1">To jest główny adres e-mail logowania i zawsze będzie otrzymywał raporty.</p>
          </div>
          
          {/* Additional Contact Emails Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dodatkowe adresy e-mail kontaktowe
            </label>
            <div className="space-y-2">
              {formData.contact_emails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      email && !validateEmail(email) 
                        ? 'border-red-300 focus:ring-red-500' 
                        : email && validateEmail(email)
                        ? 'border-green-300 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-primary-500'
                    }`}
                    placeholder="dodatkowy@firma.com"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(index)}
                      className="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {email && validateEmail(email) && (
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEmail}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                <span className="mr-1">+</span>
                Dodaj inny e-mail
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dodatkowe adresy e-mail będą otrzymywać wszystkie raporty i powiadomienia dla tego klienta.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID konta reklamowego Meta *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.ad_account_id}
                onChange={handleAdAccountIdChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  adAccountIdError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : formData.ad_account_id && !adAccountIdError
                    ? 'border-green-300 focus:ring-green-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="act_123456789"
              />
              {formData.ad_account_id && !adAccountIdError && (
                <div className="absolute right-2 top-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              )}
            </div>
            {adAccountIdError && (
              <p className="text-xs text-red-600 mt-1">{adAccountIdError}</p>
            )}
          </div>
          
          {/* Token Management Section */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Tokeny API Meta</span>
              <button
                type="button"
                onClick={() => setShowTokenFields(!showTokenFields)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showTokenFields ? 'Ukryj' : 'Aktualizuj tokeny'}
              </button>
            </div>
            
            {showTokenFields ? (
              <div className="space-y-4">
                {/* Token Choice Section */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Key className="h-4 w-4 mr-2" />
                    Wybierz typ tokenu (Wybierz jeden)
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {/* Option 1: System User Token */}
                    <div className={`border-2 rounded-lg p-4 transition-colors ${
                      formData.system_user_token ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}>
                      <div className="flex items-center mb-2">
                        <Shield className="h-4 w-4 mr-2 text-blue-600" />
                        <label className="text-sm font-medium text-gray-700">
                          Token Systemowego Użytkownika (Zalecane)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          value={formData.system_user_token}
                          onChange={(e) => setFormData({...formData, system_user_token: e.target.value, meta_access_token: ''})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Wklej token Systemowego Użytkownika dla trwałego dostępu"
                        />
                        {formData.system_user_token && formData.system_user_token.startsWith('EAA') && (
                          <div className="absolute right-2 top-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        ✅ Dostęp trwały, nigdy nie wygasa
                      </p>
                    </div>

                    {/* Option 2: Meta Access Token */}
                    <div className={`border-2 rounded-lg p-4 transition-colors ${
                      formData.meta_access_token && !formData.system_user_token ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                    }`}>
                      <div className="flex items-center mb-2">
                        <Clock className="h-4 w-4 mr-2 text-orange-600" />
                        <label className="text-sm font-medium text-gray-700">
                          Token Meta Access (60 dni)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          value={formData.meta_access_token}
                          onChange={(e) => setFormData({...formData, meta_access_token: e.target.value, system_user_token: ''})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="EAA... (zaczyna się od EAA)"
                        />
                        {formData.meta_access_token && formData.meta_access_token.startsWith('EAA') && (
                          <div className="absolute right-2 top-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        ⏰ Wygasa za 60 dni, wymaga odnowienia
                      </p>
                    </div>
                  </div>
                </div>

                {/* Token Choice Status */}
                {(formData.meta_access_token || formData.system_user_token) && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Status wybranego tokenu:</h4>
                    <div className="space-y-2">
                      {formData.system_user_token && (
                        <div className={`flex items-center text-sm p-2 rounded ${
                          formData.system_user_token.startsWith('EAA') 
                            ? 'text-green-700 bg-green-50 border border-green-200' 
                            : 'text-yellow-700 bg-yellow-50 border border-yellow-200'
                        }`}>
                          {formData.system_user_token.startsWith('EAA') ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <AlertCircle className="h-4 w-4 mr-2" />
                          )}
                          <span>
                            {formData.system_user_token.startsWith('EAA') 
                              ? '✅ Token Systemowego Użytkownika wybrany (Dostęp trwały)' 
                              : '⚠️ Token Systemowego Użytkownika powinien zaczynać się od "EAA" dla API Meta'
                            }
                          </span>
                        </div>
                      )}
                      
                      {formData.meta_access_token && !formData.system_user_token && (
                        <div className={`flex items-center text-sm p-2 rounded ${
                          formData.meta_access_token.startsWith('EAA') 
                            ? 'text-green-700 bg-green-50' 
                            : 'text-yellow-700 bg-yellow-50'
                        }`}>
                          {formData.meta_access_token.startsWith('EAA') ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <AlertCircle className="h-4 w-4 mr-2" />
                          )}
                          <span>
                            {formData.meta_access_token.startsWith('EAA') 
                              ? '✅ Token Meta Access wybrany (dostęp 60-dniowy)' 
                              : '⚠️ Token Meta Access powinien zaczynać się od "EAA" dla API Meta'
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validation Section */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test połączenia i walidacja tokenu
                    </span>
                    <button
                      type="button"
                      onClick={validateMetaCredentials}
                      disabled={validating || !formData.ad_account_id || (!formData.meta_access_token && !formData.system_user_token)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {validating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Testowanie...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Test połączenia
                        </>
                      )}
                    </button>
                  </div>
                  
                  {validationStatus.status !== 'idle' && (
                    <div className={`text-sm p-3 rounded-md border ${
                      validationStatus.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                      validationStatus.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                      'bg-yellow-50 text-yellow-800 border-yellow-200'
                    }`}>
                      <div className="flex items-start">
                        {validationStatus.status === 'valid' ? (
                          <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                        ) : validationStatus.status === 'invalid' ? (
                          <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                        )}
                        <div>
                          {validationStatus.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Bieżący token: ••••••••••••••••</span>
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
                    Wygasa: {new Date(client.token_expires_at).toLocaleDateString()}
                  </div>
                )}
                {client.last_token_validation && (
                  <div className="text-xs text-gray-500">
                    Ostatnia walidacja: {new Date(client.last_token_validation).toLocaleDateString()}
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
          
          {(formData.reporting_frequency === 'monthly' || formData.reporting_frequency === 'weekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send Day
                {formData.reporting_frequency === 'monthly' ? ' (Day of month)' : ' (Day of week)'}
              </label>
              <select
                value={formData.send_day}
                onChange={(e) => setFormData({...formData, send_day: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {formData.reporting_frequency === 'monthly' ? (
                  // Days 1-31 for monthly
                  Array.from({length: 31}, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))
                ) : (
                  // Days 1-7 for weekly (Monday=1, Sunday=7)
                  [
                    {value: 1, label: 'Monday'},
                    {value: 2, label: 'Tuesday'},
                    {value: 3, label: 'Wednesday'},
                    {value: 4, label: 'Thursday'},
                    {value: 5, label: 'Friday'},
                    {value: 6, label: 'Saturday'},
                    {value: 7, label: 'Sunday'}
                  ].map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))
                )}
              </select>
            </div>
          )}
          
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
              disabled={loading || (showTokenFields && (formData.meta_access_token || formData.system_user_token) && validationStatus.status !== 'valid') || false}
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