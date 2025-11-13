'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  FileText,
  Mail,
  Building,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Key,
  UserPlus,
  LogOut,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Calendar,
  Target,
  Facebook
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { MetaAPIService } from '../../lib/meta-api-optimized';
import type { Database } from '../../lib/database.types';
import { AdminLoading } from '../../components/LoadingSpinner';
import CredentialsModal from '../../components/CredentialsModal';
import EditClientModal from '../../components/EditClientModal';
import SearchFilters from '../../components/SearchFilters';
import BulkActions from '../../components/BulkActions';
import GenerateReportModal from '../../components/GenerateReportModal';
import GoogleAdsTokenModal from '../../components/GoogleAdsTokenModal';



type Client = Database['public']['Tables']['clients']['Row'];

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (client: Partial<Client>) => Promise<void>;
}

function AddClientModal({ isOpen, onClose, onAdd }: AddClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    ad_account_id: '',
    meta_access_token: '',
    system_user_token: '',
    // Google Ads fields
    google_ads_customer_id: '',
    google_ads_refresh_token: '',
    google_ads_system_user_token: '',
    google_ads_enabled: false,
    reporting_frequency: 'monthly' as const,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    meta: { status: 'idle' | 'validating' | 'valid' | 'invalid'; message: string; };
    google: { status: 'idle' | 'validating' | 'valid' | 'invalid'; message: string; };
  }>({ 
    meta: { status: 'idle', message: '' },
    google: { status: 'idle', message: '' }
  });
  const [submitError, setSubmitError] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<('meta' | 'google')[]>(['meta']);

  const validateMetaCredentials = async () => {
    // Check if Meta is selected
    if (!selectedPlatforms.includes('meta')) {
      setValidationStatus(prev => ({ 
        ...prev, 
        meta: { status: 'idle', message: 'Meta Ads nie jest wybrane' }
      }));
      return;
    }

    // Check if Ad Account ID is provided (required)
    if (!formData.ad_account_id) {
      setValidationStatus(prev => ({ 
        ...prev, 
        meta: { status: 'invalid', message: 'Meta Ad Account ID jest wymagane' }
      }));
      return;
    }
    
    // Check if at least one token is provided
    if (!formData.meta_access_token && !formData.system_user_token) {
      setValidationStatus(prev => ({ 
        ...prev, 
        meta: { status: 'invalid', message: 'Podaj token Meta Access (60 dni) lub System User Token (permanentny)' }
      }));
      return;
    }
    
    // Use System User token if provided (permanent), otherwise use regular access token (60 days)
    const tokenToUse = formData.system_user_token || formData.meta_access_token;
    const tokenType = formData.system_user_token ? 'System User Token (Permanentny)' : 'Meta Access Token (60 dni)';

    setValidating(true);
    setValidationStatus(prev => ({ 
      ...prev, 
      meta: { status: 'validating', message: `Walidacja ${tokenType}...` }
    }));

    try {
      const metaService = new MetaAPIService(tokenToUse);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        let errorMessage = `Walidacja tokenu nie powiodła się: ${tokenValidation.error}`;
        
        // Provide helpful guidance based on error type
        if (tokenValidation.error?.includes('expired')) {
          errorMessage += '\n💡 Wskazówka: Użyj tokenu System User dla permanentnego dostępu, który nigdy nie wygasa.';
        } else if (tokenValidation.error?.includes('permissions')) {
          errorMessage += '\n💡 Wskazówka: Upewnij się, że twój token ma dostęp do tego konta reklamowego.';
        } else if (tokenValidation.error?.includes('invalid')) {
          errorMessage += '\n💡 Wskazówka: Sprawdź, czy twój token zaczyna się od "EAA" i jest skopiowany poprawnie.';
        }
        
        setValidationStatus(prev => ({ 
          ...prev, 
          meta: { status: 'invalid', message: errorMessage }
        }));
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        let errorMessage = `Walidacja konta reklamowego nie powiodła się: ${accountValidation.error}`;
        
        // Provide helpful guidance
        if (accountValidation.error?.includes('not found')) {
          errorMessage += '\n💡 Wskazówka: Sprawdź format ID konta reklamowego (powinien być podobny do "act_123456789").';
        } else if (accountValidation.error?.includes('access denied')) {
          errorMessage += '\n💡 Wskazówka: Upewnij się, że twój token ma dostęp do tego konta reklamowego.';
        }
        
        setValidationStatus(prev => ({ 
          ...prev, 
          meta: { status: 'invalid', message: errorMessage }
        }));
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Meta Ads: Połączenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}. Znaleziono ${campaigns.length} kampanie.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Twój token zostanie automatycznie przekonwertowany na permanentny dostęp (bez wygaśnięcia).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfekcyjnie! Twój token jest już permanentny (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token wygasa za ${daysUntilExpiry} dni - zostanie przekonwertowany na permanentny dostęp.`;
          } else {
            statusMessage += `\n⏰ Token wygasa za ${daysUntilExpiry} dni - zostanie przekonwertowany na permanentny dostęp.`;
          }
        }
        
        setValidationStatus(prev => ({ 
          ...prev, 
          meta: { status: 'valid', message: statusMessage }
        }));
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Meta Ads: Połączenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}. Dostęp do kampanii może być ograniczony.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Twój token zostanie automatycznie przekonwertowany na permanentny dostęp (bez wygaśnięcia).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfekcyjnie! Twój token jest już permanentny (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token wygasa za ${daysUntilExpiry} dni - zostanie przekonwertowany na permanentny dostęp.`;
          } else {
            statusMessage += `\n⏰ Token wygasa za ${daysUntilExpiry} dni - zostanie przekonwertowany na permanentny dostęp.`;
          }
        }
        
        setValidationStatus(prev => ({ 
          ...prev, 
          meta: { status: 'valid', message: statusMessage }
        }));
      }

    } catch (error) {
      setValidationStatus(prev => ({ 
        ...prev, 
        meta: { 
          status: 'invalid', 
          message: `Błąd walidacji Meta: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
        }
      }));
    } finally {
      setValidating(false);
    }
  };

  const validateGoogleAdsCredentials = async () => {
    // Check if Google Ads is selected
    if (!selectedPlatforms.includes('google')) {
      setValidationStatus(prev => ({ 
        ...prev, 
        google: { status: 'idle', message: 'Google Ads nie jest wybrane' }
      }));
      return;
    }

    // Check if required fields are provided
    if (!formData.google_ads_customer_id || (!formData.google_ads_refresh_token && !formData.google_ads_system_user_token)) {
      setValidationStatus(prev => ({ 
        ...prev, 
        google: { status: 'invalid', message: 'Google Ads Customer ID i token (Refresh lub System User) są wymagane' }
      }));
      return;
    }

    setValidating(true);
    setValidationStatus(prev => ({ 
      ...prev, 
      google: { status: 'validating', message: 'Walidacja Google Ads...' }
    }));

    try {
      // Validate format
      const customerIdFormat = /^\d{3}-\d{3}-\d{4}$/.test(formData.google_ads_customer_id);
      
      if (!customerIdFormat) {
        setValidationStatus(prev => ({ 
          ...prev, 
          google: { 
            status: 'invalid', 
            message: 'Google Ads Customer ID powinien mieć format XXX-XXX-XXXX' 
          }
        }));
        return;
      }

      // Validate token format based on type
      if (formData.google_ads_system_user_token) {
        // System user token validation
        const systemTokenFormat = formData.google_ads_system_user_token.match(/^[A-Za-z0-9_-]{50,}$/);
        if (!systemTokenFormat) {
          setValidationStatus(prev => ({ 
            ...prev, 
            google: { 
              status: 'invalid', 
              message: 'System User Token powinien być długim ciągiem alfanumerycznym (50+ znaków)' 
            }
          }));
          return;
        }
      } else if (formData.google_ads_refresh_token) {
        // Refresh token validation
        const refreshTokenFormat = formData.google_ads_refresh_token.startsWith('1//');
        if (!refreshTokenFormat) {
          setValidationStatus(prev => ({ 
            ...prev, 
            google: { 
              status: 'invalid', 
              message: 'Google Ads Refresh Token powinien zaczynać się od "1//"' 
            }
          }));
          return;
        }
      }

      setValidationStatus(prev => ({ 
        ...prev, 
        google: { 
          status: 'valid', 
          message: '✅ Google Ads: Format poprawny! Połączenie zostanie zweryfikowane podczas pierwszego użycia.' 
        }
      }));

    } catch (error) {
      setValidationStatus(prev => ({ 
        ...prev, 
        google: { 
          status: 'invalid', 
          message: `Błąd walidacji Google Ads: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
        }
      }));
    } finally {
      setValidating(false);
    }
  };

  const handleGoogleAdsTokenSuccess = (tokenData?: { type: 'refresh_token' | 'system_user'; token: string }) => {
    if (tokenData) {
      if (tokenData.type === 'system_user') {
        setFormData(prev => ({
          ...prev,
          google_ads_system_user_token: tokenData.token
        }));
        setValidationStatus(prev => ({
          ...prev,
          google: { status: 'valid', message: '✅ System User Token został ustawiony' }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          google_ads_refresh_token: tokenData.token
        }));
        setValidationStatus(prev => ({
          ...prev,
          google: { status: 'valid', message: '✅ Refresh Token został ustawiony' }
        }));
      }
    }
    // Refresh the page to show updated token status
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setSubmitError('');
    
    // Check if at least one platform is selected
    if (selectedPlatforms.length === 0) {
      setSubmitError('Wybierz przynajmniej jedną platformę reklamową (Meta lub Google Ads)');
      return;
    }

    // Validate selected platforms
    if (selectedPlatforms.includes('meta') && validationStatus.meta.status !== 'valid') {
      setSubmitError('Proszę najpierw zweryfikować poświadczenia Meta Ads');
      return;
    }

    if (selectedPlatforms.includes('google') && validationStatus.google.status !== 'valid') {
      setSubmitError('Proszę najpierw zweryfikować poświadczenia Google Ads');
      return;
    }

    setLoading(true);
    try {
      // Prepare form data based on selected platforms
      const clientData = {
        ...formData,
        // Only include Meta fields if Meta is selected
        ...(selectedPlatforms.includes('meta') ? {
          ad_account_id: formData.ad_account_id,
          meta_access_token: formData.meta_access_token,
          system_user_token: formData.system_user_token,
        } : {
          ad_account_id: '',
          meta_access_token: '',
          system_user_token: '',
        }),
        // Only include Google Ads fields if Google is selected
        ...(selectedPlatforms.includes('google') ? {
          google_ads_customer_id: formData.google_ads_customer_id,
          google_ads_refresh_token: formData.google_ads_refresh_token,
          google_ads_system_user_token: formData.google_ads_system_user_token,
          google_ads_enabled: true,
        } : {
          google_ads_customer_id: '',
          google_ads_refresh_token: '',
          google_ads_system_user_token: '',
          google_ads_enabled: false,
        })
      };

      await onAdd(clientData);
      setFormData({
        name: '',
        email: '',
        company: '',
        ad_account_id: '',
        meta_access_token: '',
        system_user_token: '',
        google_ads_customer_id: '',
        google_ads_refresh_token: '',
        google_ads_system_user_token: '',
        google_ads_enabled: false,
        reporting_frequency: 'monthly',
        notes: ''
      });
      setValidationStatus({ 
        meta: { status: 'idle', message: '' },
        google: { status: 'idle', message: '' }
      });
      setSubmitError('');
      setSelectedPlatforms(['meta']);
      onClose();
    } catch (error) {
      console.error('Error adding client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nie udało się dodać klienta. Spróbuj ponownie.';
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Dodaj nowego klienta</h2>
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
              Adres e-mail kontaktowy *
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

          {/* Platform Selection */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-purple-600" />
              Wybierz platformy reklamowe
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes('meta')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPlatforms(prev => [...prev, 'meta']);
                    } else {
                      setSelectedPlatforms(prev => prev.filter(p => p !== 'meta'));
                    }
                  }}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex items-center">
                  <Facebook className="h-5 w-5 mr-2 text-blue-600" />
                  <span className="font-medium">Meta Ads (Facebook & Instagram)</span>
                </div>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes('google')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPlatforms(prev => [...prev, 'google']);
                    } else {
                      setSelectedPlatforms(prev => prev.filter(p => p !== 'google'));
                    }
                  }}
                  className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <div className="flex items-center">
                  <Target className="h-5 w-5 mr-2 text-orange-600" />
                  <span className="font-medium">Google Ads</span>
                </div>
              </label>
            </div>
          </div>
          
          {/* Meta API Setup Section */}
          {selectedPlatforms.includes('meta') && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Key className="h-5 w-5 mr-2 text-blue-600" />
                Konfiguracja API Meta (Dostęp trwały)
              </h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 mr-2 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-1">💡 Zalecane: Token Systemowego Użytkownika</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      Dla trwałego dostępu, który nigdy nie wygasa, użyj tokenu Systemowego Użytkownika z Business Manager klienta.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open('https://business.facebook.com/', '_blank')}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Otwórz Business Manager
                    </button>
                  </div>
                </div>
              </div>

              {/* Required Ad Account ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID konta reklamowego Meta *
                </label>
                <input
                  type="text"
                  required={selectedPlatforms.includes('meta')}
                  value={formData.ad_account_id}
                  onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="act_123456789"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: act_XXXXXXXXX (znajdź w Ads Manager → Settings → Ad Account ID)
                </p>
              </div>

              {/* Preferred: System User Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System User Token (Zalecane - trwały dostęp)
                </label>
                <input
                  type="password"
                  value={formData.system_user_token}
                  onChange={(e) => setFormData({...formData, system_user_token: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="EAA... (permanentny token)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ✅ Najbezpieczniejszy - nigdy nie wygasa | Utwórz w Business Manager → Settings → System Users
                </p>
              </div>

              {/* Alternative: Regular Meta Access Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Access Token (Alternatywa - 60 dni)
                </label>
                <input
                  type="password"
                  value={formData.meta_access_token}
                  onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="EAA... (token 60-dniowy)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⏰ Wygasa co 60 dni | Pobierz z Graph API Explorer lub Apps → Twoja aplikacja → Token
                </p>
              </div>

              <button
                type="button"
                onClick={validateMetaCredentials}
                disabled={validating || (!formData.ad_account_id || (!formData.meta_access_token && !formData.system_user_token))}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {validating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sprawdzanie Meta...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Zweryfikuj poświadczenia Meta
                  </>
                )}
              </button>
              
              {validationStatus.meta.status !== 'idle' && (
                <div className={`text-sm p-3 rounded-md border ${
                  validationStatus.meta.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                  validationStatus.meta.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                  'bg-yellow-50 text-yellow-800 border-yellow-200'
                }`}>
                  <div className="flex items-start">
                    {validationStatus.meta.status === 'valid' ? (
                      <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                    ) : validationStatus.meta.status === 'invalid' ? (
                      <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                    )}
                    <div>
                      {validationStatus.meta.message}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Ads Setup Section */}
          {selectedPlatforms.includes('google') && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2 text-orange-600" />
                Konfiguracja Google Ads API
              </h3>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 mr-2 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-900 mb-1">🔑 Wymagane: Google Ads API Access</h4>
                    <p className="text-sm text-orange-800 mb-2">
                      Aby połączyć Google Ads, potrzebujesz Customer ID i Refresh Token z Google Ads API.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open('https://developers.google.com/google-ads/api', '_blank')}
                      className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                    >
                      Otwórz Google Ads API Console
                    </button>
                  </div>
                </div>
              </div>

              {/* Google Ads Customer ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Ads Customer ID *
                </label>
                <input
                  type="text"
                  required={selectedPlatforms.includes('google')}
                  value={formData.google_ads_customer_id}
                  onChange={(e) => setFormData({...formData, google_ads_customer_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="123-456-7890"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: XXX-XXX-XXXX (znajdź w Google Ads → Account Settings → Account Info)
                </p>
              </div>

              {/* Google Ads Refresh Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Ads Refresh Token *
                </label>
                <input
                  type="password"
                  required={selectedPlatforms.includes('google') && !formData.google_ads_system_user_token}
                  value={formData.google_ads_refresh_token}
                  onChange={(e) => setFormData({...formData, google_ads_refresh_token: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="1//..."
                  disabled={!!formData.google_ads_system_user_token}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Zaczyna się od &quot;1//&quot; | Uzyskaj z OAuth 2.0 flow dla Google Ads API
                </p>
              </div>

              {/* System User Token Alternative */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="mb-2">
                  <h4 className="font-medium text-green-900 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Alternatywa: System User Token
                  </h4>
                </div>
                <p className="text-sm text-green-800">
                  {formData.google_ads_system_user_token ? 
                    '✅ System User Token został ustawiony (permanentny dostęp)' :
                    'Użyj System User Token dla permanentnego dostępu bez konieczności odnawiania'
                  }
                </p>
                {formData.google_ads_system_user_token && (
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, google_ads_system_user_token: ''})}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Usuń System User Token
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={validateGoogleAdsCredentials}
                disabled={validating || (!formData.google_ads_customer_id || (!formData.google_ads_refresh_token && !formData.google_ads_system_user_token))}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {validating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sprawdzanie Google Ads...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Zweryfikuj poświadczenia Google Ads
                  </>
                )}
              </button>
              
              {validationStatus.google.status !== 'idle' && (
                <div className={`text-sm p-3 rounded-md border ${
                  validationStatus.google.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                  validationStatus.google.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                  'bg-yellow-50 text-yellow-800 border-yellow-200'
                }`}>
                  <div className="flex items-start">
                    {validationStatus.google.status === 'valid' ? (
                      <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                    ) : validationStatus.google.status === 'invalid' ? (
                      <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                    )}
                    <div>
                      {validationStatus.google.message}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
              Częstotliwość raportowania
            </label>
            <select
              value={formData.reporting_frequency}
              onChange={(e) => setFormData({...formData, reporting_frequency: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="monthly">Miesięcznie</option>
              <option value="weekly">Co tydzień</option>
              <option value="on_demand">Na żądanie</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uwagi
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Uwagi dotyczące tego klienta"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading || (selectedPlatforms.length === 0 || (selectedPlatforms.includes('meta') && validationStatus.meta.status !== 'valid') || (selectedPlatforms.includes('google') && validationStatus.google.status !== 'valid'))}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Dodawanie...' : 'Dodaj klienta'}
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isHeaderCondensed, setIsHeaderCondensed] = useState(false);

  const [generatingReport] = useState<string | null>(null);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [selectedClientForReport, setSelectedClientForReport] = useState<Client | null>(null);
  
  // Bulk operations state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // PDF viewer state

  

  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    clientId: string;
    clientName: string;
    clientEmail: string;
  }>({
    isOpen: false,
    clientId: '',
    clientName: '',
    clientEmail: ''
  });
  const [showGoogleAdsTokenModal, setShowGoogleAdsTokenModal] = useState(false);
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Track initial load to prevent duplicate calls
  const initialLoadDone = React.useRef(false);
  const isAuthReady = !authLoading && user && profile;

  // Handle authentication and initial load
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    // Redirect to login if no user
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Redirect if not admin
    if (profile?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    // Load clients only once on initial auth completion
    if (isAuthReady && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchClients();
    } else if (!isAuthReady && !authLoading) {
      // If we don't have user/profile but auth is not loading, stop loading
      setLoading(false);
    }
  }, [user, profile, authLoading, router, isAuthReady]);

  // Header condensation on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsHeaderCondensed(scrollY >= 120);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Refetch clients when search/filter/sort changes - DEBOUNCED to prevent excessive refreshing
  useEffect(() => {
    // Skip if initial load hasn't happened yet
    if (!initialLoadDone.current || !isAuthReady) {
      return;
    }

    // Add debouncing to prevent rapid API calls when typing in search
    const timeoutId = setTimeout(() => {
      fetchClients(1); // Reset to first page when filters change
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, frequencyFilter, sortBy, sortOrder, isAuthReady]);

  const fetchClients = async (page = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching clients for user:', user.id);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (frequencyFilter) params.append('frequency', frequencyFilter);

      const response = await fetch(`/api/clients?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const result = await response.json();
      setClients(result.clients || []);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };



  const addClient = async (clientData: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(clientData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add client');
      }

      const result = await response.json();
      
      // Show credentials modal to admin
      if (result.credentials) {
        setCredentialsModal({
          isOpen: true,
          clientId: result.id || '',
          clientName: clientData.name || '',
          clientEmail: clientData.email || ''
        });
      }

      await fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
      throw error;
    }
  };

  const updateClient = async (clientId: string, updates: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update client');
      }

      const result = await response.json();
      console.log('Client updated successfully:', result);

      await fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  };



  const generateReport = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    setSelectedClientForReport(client);
    setShowGenerateReportModal(true);
  };







  // Bulk operations functions
  const handleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(client => client.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedClients([]);
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć klientów');
      }

      const result = await response.json();
      console.log('Bulk delete result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie usunięto ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Nie udało się usunąć niektórych klientów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };



  const handleBulkRegenerateCredentials = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'regenerate_credentials',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate credentials');
      }

      const result = await response.json();
      console.log('Bulk regenerate credentials result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie ponownie wygenerowano poświadczenia dla ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk regenerate credentials:', error);
      alert('Nie udało się ponownie wygenerować niektórych poświadczeń. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateReports = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_reports',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się wygenerować raportów');
      }

      const result = await response.json();
      console.log('Bulk generate reports result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie wygenerowano ${result.results.success.length} raportów`);
    } catch (error) {
      console.error('Error in bulk generate reports:', error);
      alert('Nie udało się wygenerować niektórych raportów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkChangeFrequency = async (frequency: string) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'change_frequency',
          clientIds: selectedClients,
          frequency
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change frequency');
      }

      const result = await response.json();
      console.log('Bulk change frequency result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie zmieniono częstotliwość dla ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk change frequency:', error);
      alert('Nie udało się zmienić częstotliwości dla niektórych klientów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego klienta? Usunięcie tego klienta spowoduje również usunięcie konta użytkownika z Supabase.')) return;

    try {
      console.log('Starting client deletion for ID:', clientId);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      console.log('Session token obtained, making delete request...');

      // Use the server-side API endpoint for deletion with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć klienta');
      }

      const result = await response.json();
      console.log('Delete result:', result.message);
      
      await fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      if (error.name === 'AbortError') {
        alert('Żądanie usunięcia wygasło. Spróbuj ponownie.');
      } else {
        alert('Nie udało się usunąć klienta. Spróbuj ponownie.');
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'invalid':
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'expiring_soon':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Aktywny';
      case 'pending':
        return 'Oczekujący';
      case 'invalid':
        return 'Nieprawidłowy';
      case 'expired':
        return 'Wygasły';
      case 'expiring_soon':
        return 'Wygasa wkrótce';
      default:
        return 'Nieznany';
    }
  };

  const getTokenHealthIcon = (healthStatus: string) => {
    switch (healthStatus) {
      case 'valid':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'expiring_soon':
        return <AlertCircle className="h-3 w-3 text-orange-500" />;
      case 'expired':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      case 'invalid':
        return <X className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getTokenHealthText = (healthStatus: string) => {
    switch (healthStatus) {
      case 'valid':
        return 'Zdrowy';
      case 'expiring_soon':
        return 'Wygasa wkrótce';
      case 'expired':
        return 'Wygasły';
      case 'invalid':
        return 'Nieprawidłowy';
      default:
        return 'Nieznany';
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F9FC] to-[#EEF2F7]">
      {/* Enhanced Header with Premium Styling */}
      <header className={`bg-white border-b border-[#E9EEF5] shadow-[0_6px_16px_rgba(16,24,40,0.06)] sticky top-0 z-40 transition-all duration-120 ease-out md:bg-white/70 md:backdrop-blur-[12px] md:border-[rgba(16,24,40,0.06)] ${
        isHeaderCondensed ? 'h-16 md:h-16 lg:h-20' : 'h-20 md:h-16 lg:h-20'
      }`}>
        <div className="max-w-[1320px] mx-auto px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            
            {/* Left - Brand cluster */}
            <div className="flex items-center">
              <div className="bg-[#F4F6FB] p-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] cursor-pointer">
                {/* Analytics Spark Icon */}
                <svg className="w-6 h-6 text-[#1F3D8A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" ry="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" ry="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" ry="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" ry="1"/>
                  <circle cx="8.5" cy="8.5" r="0.5" fill="#7EA5FF"/>
                </svg>
              </div>
              <div className="ml-3">
                <div className="flex items-center space-x-2">
                  <h1 className={`font-bold text-[#101828] transition-all duration-120 ${
                    isHeaderCondensed ? 'text-lg md:text-lg lg:text-xl' : 'text-xl md:text-lg lg:text-2xl'
                  }`}>
                    Reports
                  </h1>
                  {/* DEV badge - remove in production */}
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full border border-red-200">
                    DEV
                  </span>
                </div>
                <p className={`text-[#667085] transition-all duration-120 ${
                  isHeaderCondensed ? 'text-xs opacity-0' : 'text-sm'
                }`}>
                  Google Ads and Meta Ads reports
                </p>
              </div>
            </div>

            {/* Center - Meta strony */}
            <div className="hidden lg:flex flex-col items-center text-center">
              <h2 className={`font-bold text-[#101828] transition-all duration-120 ${
                isHeaderCondensed ? 'text-base' : 'text-lg'
              }`}>
                Zarządzanie klientami
              </h2>
              <p className={`text-[#667085] transition-all duration-120 ${
                isHeaderCondensed ? 'text-xs opacity-0' : 'text-sm'
              }`}>
                Panel › Klienci
              </p>
            </div>

            {/* Right - Actions */}
            <div className="flex items-center space-x-2">

              {/* Primary CTAs */}
              <button
                onClick={() => router.push('/admin/reports')}
                className="h-10 px-4 bg-[#1F3D8A] text-white rounded-[9999px] hover:bg-[#1A2F6B] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(31,61,138,0.12)] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center space-x-2"
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Raporty</span>
              </button>
              
              <button
                onClick={() => setShowAddModal(true)}
                className="h-10 px-4 bg-[#7EA5FF] text-white rounded-[9999px] hover:bg-[#6B8FE6] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(31,61,138,0.12)] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Dodaj</span>
              </button>

              {/* Utilities */}
              <button
                onClick={() => router.push('/admin/calendar')}
                className="h-10 px-4 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] hover:text-[#1F3D8A] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(31,61,138,0.12)] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center space-x-2"
              >
                <Calendar className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Kalendarz</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowGoogleAdsTokenModal(true);
                }}
                className="h-10 px-4 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] hover:text-[#FF6B35] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(255,107,53,0.12)] focus:outline-none focus:ring-2 focus:ring-[#FFB89A] focus:ring-offset-2 flex items-center space-x-2"
              >
                <Target className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Google Ads Token</span>
              </button>

              <button
                onClick={() => router.push('/admin/monitoring')}
                className="h-10 px-4 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] hover:text-[#10B981] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(16,185,129,0.12)] focus:outline-none focus:ring-2 focus:ring-[#A7F3D0] focus:ring-offset-2 flex items-center space-x-2"
              >
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Monitoring</span>
              </button>

              <button
                onClick={() => router.push('/admin/settings')}
                className="h-10 px-4 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] hover:text-[#1F3D8A] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(31,61,138,0.12)] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center space-x-2"
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Ustawienia</span>
              </button>

              <button
                onClick={handleLogout}
                className="h-10 px-4 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] hover:text-[#D92D20] transition-all duration-120 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(31,61,138,0.12)] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center space-x-2"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium hidden lg:inline">Wyloguj</span>
              </button>

              {/* Mobile overflow menu */}
              <div className="lg:hidden">
                <button className="h-10 w-10 bg-white border border-[#E9EEF5] text-[#344054] rounded-[9999px] hover:bg-[#F8FAFC] hover:border-[#D0D7DE] transition-all duration-120 hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-2 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Sub-navigation */}
      <div className={`bg-white/90 backdrop-blur-sm border-b border-[#E9EEF5] sticky z-30 transition-all duration-120 ease-out ${
        isHeaderCondensed ? 'top-16 md:top-16 lg:top-20' : 'top-20 md:top-16 lg:top-20'
      }`}>
        <div className="max-w-[1320px] mx-auto px-6 lg:px-8">
          <div className={`flex items-center space-x-6 transition-all duration-120 ${
            isHeaderCondensed ? 'py-2' : 'py-3'
          }`}>
            <div className="flex items-center text-sm text-gray-600">
              <Home className="h-4 w-4 mr-2" />
              <span>Panel</span>
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
              <Users className="h-4 w-4 mr-2" />
              <span className="font-medium text-gray-900">Zarządzanie klientami</span>
            </div>
            <div className="text-sm text-gray-500">
              {clients.length} klient{clients.length !== 1 ? 'ów' : ''} • {selectedClients.length} wybranych
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        {/* Enhanced Search and Filters Section */}
        <div className="bg-white rounded-[18px] shadow-[0_8px_30px_rgba(16,24,40,0.06)] border border-[#E9EEF5] p-8 mb-8 md:bg-white/78 md:backdrop-blur-[10px] md:shadow-[0_8px_30px_rgba(16,24,40,0.10)] md:border-[rgba(255,255,255,0.38)]">
          <SearchFilters
            onSearchChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onFrequencyFilterChange={setFrequencyFilter}
            onSortChange={(sortBy, sortOrder) => {
              setSortBy(sortBy);
              setSortOrder(sortOrder);
            }}
            currentSearch={searchTerm}
            currentStatusFilter={statusFilter}
            currentFrequencyFilter={frequencyFilter}
            currentSortBy={sortBy}
            currentSortOrder={sortOrder}
          />
        </div>

        {clients.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-16 text-center">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 rounded-full w-32 h-32 mx-auto mb-8 flex items-center justify-center">
              <Building className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {searchTerm || statusFilter || frequencyFilter ? 'Nie znaleziono klientów' : 'Brak klientów'}
            </h3>
            <p className="text-gray-600 mb-10 max-w-md mx-auto text-lg">
              {searchTerm || statusFilter || frequencyFilter 
                ? 'Spróbuj dostosować kryteria wyszukiwania lub filtry, aby znaleźć to, czego szukasz.' 
                : 'Rozpocznij dodając pierwszego klienta do systemu.'}
            </p>
            {!searchTerm && !statusFilter && !frequencyFilter && (
                              <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-premium px-8 py-4 text-lg"
                >
                <div className="flex items-center">
                  <Plus className="h-6 w-6 mr-3" />
                  <span className="font-semibold">Dodaj pierwszego klienta</span>
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enhanced Bulk Actions */}
            {selectedClients.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-lg rounded-2xl shadow-xl ring-1 ring-blue-200/50 p-6">
                <BulkActions
                  selectedClients={selectedClients}
                  totalClients={clients.length}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  onBulkDelete={handleBulkDelete}
                  onBulkRegenerateCredentials={handleBulkRegenerateCredentials}
                  onBulkGenerateReports={handleBulkGenerateReports}
                  onBulkChangeFrequency={handleBulkChangeFrequency}
                  isProcessing={isProcessing}
                />
              </div>
            )}
            
            {/* Redesigned Client Cards - Grid Layout */}
            <div className="space-y-4">
              {clients.map((client, index) => (
                <div 
                  key={client.id}
                  className="group bg-white rounded-[18px] shadow-[0_2px_10px_rgba(16,24,40,0.04)] hover:shadow-[0_6px_20px_rgba(16,24,40,0.06)] hover:translate-y-[-2px] transition-all duration-200 ease-out animate-fade-in min-h-[96px] sm:min-h-[120px] border border-[#E9EEF5] hover:border-[#E5EBF3] hover:bg-[#FAFBFF]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Responsive Layout: Mobile-first approach */}
                  <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5 items-start sm:items-center">
                    
                    {/* Client Identity Section */}
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      {/* Avatar/Monogram */}
                      <div className="relative">
                        {client.logo_url ? (
                          <div className="h-[40px] w-[40px] sm:h-[52px] sm:w-[52px] rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
                            <img 
                              src={client.logo_url} 
                              alt={`${client.name} logo`}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                // Fallback to initials if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            {/* Fallback initials (hidden by default) */}
                            <div className="h-[40px] w-[40px] sm:h-[52px] sm:w-[52px] bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl items-center justify-center shadow-lg -mt-[40px] sm:-mt-[52px] hidden">
                              <span className="text-lg sm:text-xl font-bold text-white">
                                {client.name?.charAt(0) || 'C'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-[40px] w-[40px] sm:h-[52px] sm:w-[52px] bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-lg sm:text-xl font-bold text-white">
                              {client.name?.charAt(0) || 'C'}
                            </span>
                          </div>
                        )}
                        {/* Status dot - only show when meaningful */}
                        {client.api_status === 'valid' && (
                          <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                        )}
                      </div>
                      
                      {/* Client Name & Contact */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-[17px] font-semibold text-[#101828] hover:underline cursor-pointer transition-all duration-200 truncate" title={client.name}>
                          {client.name}
                        </h3>
                        {/* Main email */}
                        <div className="flex items-center mt-1">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-blue-600 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-[#475467] truncate" title={client.email}>
                            {client.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Status Section - Only visible on mobile */}
                    <div className="sm:hidden flex flex-col space-y-2 mt-2 w-full">
                      {/* Row A: Contact/Identification */}
                      <div className="flex items-center space-x-3 flex-wrap">
                        {client.company && (
                          <div className="flex items-center">
                            <Building className="h-3 w-3 mr-1 text-[#667085]" />
                            <span className="text-xs text-[#667085] truncate max-w-[120px]" title={client.company}>
                              {client.company}
                            </span>
                          </div>
                        )}
                        {client.ad_account_id && (
                          <div className="flex items-center">
                            <svg className="h-3 w-3 mr-1 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.900a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-xs text-[#667085] truncate max-w-[100px]" title={client.ad_account_id}>
                              {client.ad_account_id}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Row B: Statuses */}
                      <div className="flex items-center space-x-2 flex-wrap gap-2">
                        {/* API Status Badge */}
                        <div 
                          className={`inline-flex items-center px-2 py-1 rounded-[9999px] text-xs font-medium ${
                            client.api_status === 'valid' 
                              ? 'bg-[#E8F8EE] text-[#106B46]' 
                              : client.api_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-[#FFF1F0] text-red-800'
                          }`}
                          title={client.api_status === 'valid' ? 'Token ważny' : client.api_status === 'pending' ? 'Token w trakcie weryfikacji' : 'Token nieważny'}
                        >
                          {getStatusIcon(client.api_status || 'pending')}
                          <span className="ml-1">
                            {getStatusText(client.api_status || 'pending')}
                          </span>
                        </div>
                        
                        {/* Token Health Badge */}
                        <div 
                          className={`inline-flex items-center px-2 py-1 rounded-[9999px] text-xs font-medium ${
                            client.token_health_status === 'valid' 
                              ? 'bg-[#E8F5FF] text-[#1F3D8A]' 
                              : client.token_health_status === 'expiring_soon'
                              ? 'bg-orange-100 text-orange-800'
                              : client.token_health_status === 'expired' || client.token_health_status === 'invalid'
                              ? 'bg-[#FFF7E6] text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                          title={client.token_health_status === 'valid' ? 'Integracje OK' : client.token_health_status === 'expiring_soon' ? 'Integracje wygasają wkrótce' : 'Problem z integracjami'}
                        >
                          {getTokenHealthIcon(client.token_health_status || 'unknown')}
                          <span className="ml-1">
                            {getTokenHealthText(client.token_health_status || 'unknown')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Information & Statuses Section */}
                    <div className="hidden sm:flex flex-col space-y-2 min-w-0 flex-1">
                      {/* Row A: Contact/Identification */}
                      <div className="flex items-center space-x-3">
                        {client.company && (
                          <div className="flex items-center">
                            <Building className="h-3 w-3 mr-1 text-[#667085]" />
                            <span className="text-xs text-[#667085] truncate max-w-[120px]" title={client.company}>
                              {client.company}
                            </span>
                          </div>
                        )}
                        {client.ad_account_id && (
                          <div className="flex items-center">
                            <svg className="h-3 w-3 mr-1 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.900a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-xs text-[#667085] truncate max-w-[100px]" title={client.ad_account_id}>
                              {client.ad_account_id}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Row B: Statuses */}
                      <div className="flex items-center space-x-2 sm:flex-wrap sm:gap-2">
                        {/* API Status Badge */}
                        <div 
                          className={`inline-flex items-center px-2.5 py-1.5 rounded-[9999px] text-xs font-medium h-7 sm:h-6 ${
                            client.api_status === 'valid' 
                              ? 'bg-[#E8F8EE] text-[#106B46]' 
                              : client.api_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-[#FFF1F0] text-red-800'
                          }`}
                          title={client.api_status === 'valid' ? 'Token ważny' : client.api_status === 'pending' ? 'Token w trakcie weryfikacji' : 'Token nieważny'}
                        >
                          {getStatusIcon(client.api_status || 'pending')}
                          <span className="ml-1 hidden sm:inline">
                            {getStatusText(client.api_status || 'pending')}
                          </span>
                        </div>
                        
                        {/* Token Health Badge */}
                        <div 
                          className={`inline-flex items-center px-2.5 py-1.5 rounded-[9999px] text-xs font-medium h-7 sm:h-6 ${
                            client.token_health_status === 'valid' 
                              ? 'bg-[#E8F5FF] text-[#1F3D8A]' 
                              : client.token_health_status === 'expiring_soon'
                              ? 'bg-orange-100 text-orange-800'
                              : client.token_health_status === 'expired' || client.token_health_status === 'invalid'
                              ? 'bg-[#FFF7E6] text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                          title={client.token_health_status === 'valid' ? 'Integracje OK' : client.token_health_status === 'expiring_soon' ? 'Integracje wygasają wkrótce' : 'Problem z integracjami'}
                        >
                          {getTokenHealthIcon(client.token_health_status || 'unknown')}
                          <span className="ml-1 hidden sm:inline">
                            {getTokenHealthText(client.token_health_status || 'unknown')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Section */}
                    <div className="flex items-center justify-end space-x-1 sm:space-x-2 flex-shrink-0">
                      {/* Delicate divider */}
                      <div className="w-px h-6 bg-[#E9EEF5] mx-3 hidden lg:block"></div>
                      {/* Last Report Mini-widget */}
                      <div className="flex-shrink-0 hidden sm:block">
                        {client.last_report_date ? (
                          <div 
                            className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-200 transition-colors"
                            title={`Ostatni raport: ${new Date(client.last_report_date).toLocaleDateString()}`}
                            onClick={() => router.push(`/reports?clientId=${client.id}`)}
                          >
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                          </div>
                        ) : (
                          <div 
                            className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 border border-gray-200 rounded-full flex items-center justify-center"
                            title="Brak raportów"
                          >
                            <span className="text-gray-400 text-xs sm:text-sm font-medium">—</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Action Bar - Icons with Tooltips */}
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <button
                          aria-label="Edytuj klienta"
                          title="Edytuj klienta"
                          onClick={() => {
                            setEditingClient(client);
                            setShowEditModal(true);
                          }}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-[#E9EEF5] rounded-full flex items-center justify-center hover:bg-[#F2F6FF] hover:border-[#E5EBF3] transition-all duration-[120ms] hover:translate-y-[-1px] focus:ring-2 focus:ring-[#BFD2FF] focus:outline-none min-h-[32px] sm:min-h-[40px]"
                        >
                          <svg className="h-4 w-4 text-[#667085] hover:text-[#1F3D8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        <button
                          aria-label="Zobacz raporty"
                          title="Zobacz raporty"
                          onClick={() => router.push(`/reports?clientId=${client.id}`)}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-[#E9EEF5] rounded-full flex items-center justify-center hover:bg-[#F2F6FF] hover:border-[#E5EBF3] transition-all duration-[120ms] hover:translate-y-[-1px] focus:ring-2 focus:ring-[#BFD2FF] focus:outline-none min-h-[32px] sm:min-h-[40px]"
                        >
                          <Eye className="h-4 w-4 text-[#667085]" />
                        </button>

                        <button
                          aria-label="Generuj raport"
                          title="Generuj raport"
                          onClick={() => generateReport(client.id)}
                          disabled={generatingReport === client.id}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-[#E9EEF5] rounded-full flex items-center justify-center hover:bg-[#F2F6FF] hover:border-[#E5EBF3] transition-all duration-[120ms] hover:translate-y-[-1px] focus:ring-2 focus:ring-[#BFD2FF] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px] sm:min-h-[40px]"
                        >
                          {generatingReport === client.id ? (
                            <RefreshCw className="h-4 w-4 text-[#667085] animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 text-[#667085]" />
                          )}
                        </button>
                        
                        <button
                          aria-label="Dane logowania"
                          title="Dane logowania"
                          onClick={() => setCredentialsModal({
                            isOpen: true,
                            clientId: client.id,
                            clientName: client.name,
                            clientEmail: client.email
                          })}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-[#E9EEF5] rounded-full flex items-center justify-center hover:bg-[#F2F6FF] hover:border-[#E5EBF3] transition-all duration-[120ms] hover:translate-y-[-1px] focus:ring-2 focus:ring-[#BFD2FF] focus:outline-none min-h-[32px] sm:min-h-[40px]"
                        >
                          <UserPlus className="h-4 w-4 text-[#667085]" />
                        </button>

                        <button
                          aria-label="Usuń klienta"
                          title="Usuń klienta"
                          onClick={() => deleteClient(client.id)}
                          className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-[#E9EEF5] rounded-full flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-all duration-[120ms] hover:translate-y-[-1px] focus:ring-2 focus:ring-red-200 focus:outline-none ml-1 sm:ml-3 min-h-[32px] sm:min-h-[40px]"
                        >
                          <Trash2 className="h-4 w-4 text-[#E54545]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Enhanced Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl ring-1 ring-black/5 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-semibold">{((pagination.page - 1) * pagination.limit) + 1}</span> do{' '}
                    <span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> z{' '}
                    <span className="font-semibold">{pagination.total}</span> klientów
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => fetchClients(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Poprzednia</span>
                    </button>
                    <div className="bg-gray-100 px-4 py-2 rounded-xl text-sm text-gray-700 font-medium">
                      Strona {pagination.page} z {pagination.totalPages}
                    </div>
                    <button
                      onClick={() => fetchClients(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>Następna</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addClient}
      />

      <EditClientModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingClient(null);
        }}
        onUpdate={updateClient}
        client={editingClient}
      />

      <CredentialsModal
        isOpen={credentialsModal.isOpen}
        onClose={() => setCredentialsModal({ ...credentialsModal, isOpen: false })}
        clientId={credentialsModal.clientId}
        clientName={credentialsModal.clientName}
        clientEmail={credentialsModal.clientEmail}
        onCredentialsUpdated={fetchClients}
      />

      {selectedClientForReport && (
        <GenerateReportModal
          isOpen={showGenerateReportModal}
          onClose={() => {
            setShowGenerateReportModal(false);
            setSelectedClientForReport(null);
          }}
          clientId={selectedClientForReport.id}
          clientName={selectedClientForReport.name}
          clientEmail={selectedClientForReport.email}
        />
      )}

      {/* Google Ads Token Modal */}
      <GoogleAdsTokenModal
        isOpen={showGoogleAdsTokenModal}
        onClose={() => setShowGoogleAdsTokenModal(false)}
        onSuccess={(tokenData) => {
          setShowGoogleAdsTokenModal(false);
          // Optionally refresh client data or show success message
          if (tokenData) {
            console.log(`${tokenData.type} token saved successfully`);
          }
        }}
      />
    </div>
  );
} 