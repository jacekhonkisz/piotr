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
  Calendar
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { MetaAPIService } from '../../lib/meta-api';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';
import CredentialsModal from '../../components/CredentialsModal';
import EditClientModal from '../../components/EditClientModal';
import SearchFilters from '../../components/SearchFilters';
import BulkActions from '../../components/BulkActions';
import GenerateReportModal from '../../components/GenerateReportModal';



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
    reporting_frequency: 'monthly' as const,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [submitError, setSubmitError] = useState<string>('');

  const validateMetaCredentials = async () => {
    // Check if Ad Account ID is provided (required)
    if (!formData.ad_account_id) {
      setValidationStatus({ status: 'invalid', message: 'Meta Ad Account ID jest wymagane' });
      return;
    }
    
    // Check if at least one token is provided
    if (!formData.meta_access_token && !formData.system_user_token) {
      setValidationStatus({ status: 'invalid', message: 'Podaj token Meta Access (60 dni) lub System User Token (permanentny)' });
      return;
    }
    
    // Use System User token if provided (permanent), otherwise use regular access token (60 days)
    const tokenToUse = formData.system_user_token || formData.meta_access_token;
    const tokenType = formData.system_user_token ? 'System User Token (Permanentny)' : 'Meta Access Token (60 dni)';

    setValidating(true);
    setValidationStatus({ status: 'validating', message: `Walidacja ${tokenType}...` });

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
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
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
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Połączenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}. Znaleziono ${campaigns.length} kampanie.`;
        
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
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Połączenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}. Dostęp do kampanii może być ograniczony.`;
        
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
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      }

    } catch (error) {
      setValidationStatus({ 
        status: 'invalid', 
        message: `Błąd walidacji: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setSubmitError('');
    
    if (validationStatus.status !== 'valid') {
      setValidationStatus({ status: 'invalid', message: 'Proszę najpierw zweryfikować swoje poświadczenia Meta Ads.' });
      return;
    }

    setLoading(true);
    try {
      await onAdd(formData);
      setFormData({
        name: '',
        email: '',
        company: '',
        ad_account_id: '',
        meta_access_token: '',
        system_user_token: '',
        reporting_frequency: 'monthly',
        notes: ''
      });
      setValidationStatus({ status: 'idle', message: '' });
      setSubmitError('');
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
          
                    {/* Meta API Setup Section */}
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
                required
                value={formData.ad_account_id}
                onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="np. act_123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                Znajdź to w Ads Manager → Ustawienia konta
              </p>
            </div>

            {/* Token Choice Section */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Key className="h-4 w-4 mr-2" />
                Wybierz typ tokenu (Wybierz jeden)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      onChange={(e) => setFormData({...formData, system_user_token: e.target.value})}
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
                      onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
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
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
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
            <div className="bg-gray-50 p-4 rounded-md mt-4">
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

                         {/* Quick Help */}
             <div className="mt-4 p-3 bg-gray-50 rounded-md">
               <h4 className="text-sm font-medium text-gray-700 mb-2">🔧 Przewodnik wyboru tokenu:</h4>
               <div className="text-xs text-gray-600 space-y-1">
                 <p>• <strong>ID konta reklamowego Meta</strong> (Wymagane): Twój identyfikator konta reklamowego</p>
                 <p>• <strong>Wybierz jeden typ tokenu:</strong></p>
                 <div className="ml-4 space-y-1">
                   <p>🛡️ <strong>Token Systemowego Użytkownika:</strong> Dostęp trwały, nigdy nie wygasa (Zalecane)</p>
                   <p>⏰ <strong>Token Meta Access:</strong> Dostęp 60-dniowy, wymaga odnowienia ręcznego</p>
                 </div>
               </div>
               <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                 <strong>💡 Wskazówka:</strong> Tokeny Systemowego Użytkownika są preferowane dla dostępu trwałego. Jeśli masz jeden, użyj go!
               </div>
             </div>
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
              disabled={loading || validationStatus.status !== 'valid'}
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

    // Load clients if user and profile are available
    if (user && profile) {
      fetchClients();
    } else {
      // If we don't have user/profile but auth is not loading, stop loading
      setLoading(false);
    }
  }, [user, profile, authLoading, router]);

  // Refetch clients when search/filter/sort changes
  useEffect(() => {
    if (user && profile) {
      fetchClients(1); // Reset to first page when filters change
    }
  }, [searchTerm, statusFilter, frequencyFilter, sortBy, sortOrder]);

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-12">
          <LoadingSpinner text="Ładowanie klientów..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header with Premium Styling */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-2xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Zarządzanie klientami</h1>
                <p className="text-gray-600">Zarządzaj kontami klientów i raportami</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">

              <button
                onClick={() => router.push('/admin/reports')}
                className="nav-premium-button-primary"
              >
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Zobacz wszystkie raporty</span>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/calendar')}
                className="group nav-premium-button hover:border-purple-300"
              >
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-600 group-hover:text-purple-600 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Kalendarz wysyłek</span>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/settings')}
                className="group nav-premium-button"
              >
                <div className="flex items-center">
                  <Settings className="h-4 w-4 mr-2 text-gray-600 group-hover:text-gray-800 transition-colors" />
                  <span className="text-sm font-medium text-gray-700">Ustawienia</span>
                </div>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="btn-premium-success"
              >
                <div className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Dodaj klienta</span>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="group nav-premium-button hover:border-red-300"
              >
                <div className="flex items-center">
                  <LogOut className="h-4 w-4 mr-2 text-gray-600 group-hover:text-red-600 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-red-700">Wyloguj się</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Sub-navigation */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/50 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center py-3 space-x-6">
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
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 mb-8">
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
            
            {/* Premium Client Cards */}
            <div className="space-y-4">
              {clients.map((client, index) => (
                <div 
                  key={client.id}
                  className="group bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl ring-1 ring-black/5 p-6 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    {/* Client Info */}
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="h-14 w-14 bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                          <span className="text-lg font-bold text-white">
                            {client.name?.charAt(0) || 'C'}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-white rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                          {client.api_status === 'valid' ? (
                            <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                          ) : client.api_status === 'pending' ? (
                            <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                          ) : (
                            <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                          {client.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {client.email}
                          </div>
                          {client.company && (
                            <div className="flex items-center">
                              <Building className="h-3 w-3 mr-1" />
                              {client.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center space-x-3">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                        client.api_status === 'valid' 
                          ? 'bg-green-100 text-green-800 border-green-200' 
                          : client.api_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-red-100 text-red-800 border-red-200'
                      }`}>
                        {getStatusIcon(client.api_status || 'pending')}
                        <span className="ml-1">
                          {getStatusText(client.api_status || 'pending')}
                        </span>
                      </div>
                      
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
                        client.token_health_status === 'valid' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : client.token_health_status === 'expiring_soon'
                          ? 'bg-orange-100 text-orange-800 border-orange-200'
                          : client.token_health_status === 'expired' || client.token_health_status === 'invalid'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {getTokenHealthIcon(client.token_health_status || 'unknown')}
                        <span className="ml-1">
                          {getTokenHealthText(client.token_health_status || 'unknown')}
                        </span>
                      </div>
                    </div>

                    {/* Credentials & Last Report */}
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center justify-center text-gray-600 mb-1">
                          <Key className="h-3 w-3 mr-1" />
                          <span className={client.generated_username ? 'text-gray-900' : 'text-gray-400'}>
                            {client.generated_username || 'Nie wygenerowano'}
                          </span>
                        </div>
                        {client.credentials_generated_at && (
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {new Date(client.credentials_generated_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center">
                        <div className="text-gray-600 mb-1">Ostatni raport</div>
                        {client.last_report_date ? (
                          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                            {new Date(client.last_report_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400 bg-gray-100 px-3 py-1 rounded-full text-xs">Brak raportów</span>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                          title="Edytuj klienta"
                          onClick={() => {
                            setEditingClient(client);
                            setShowEditModal(true);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-105"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                          title="Zobacz raporty"
                          onClick={() => router.push(`/reports?clientId=${client.id}`)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200 hover:scale-105"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                          title="Generuj raport"
                          onClick={() => generateReport(client.id)}
                          disabled={generatingReport === client.id}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingReport === client.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      
                      <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                          title="Dane logowania"
                          onClick={() => setCredentialsModal({
                            isOpen: true,
                            clientId: client.id,
                            clientName: client.name,
                            clientEmail: client.email
                          })}
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200 hover:scale-105"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm hover:shadow-md transition-all duration-200">
                        <button
                          title="Usuń klienta"
                          onClick={() => deleteClient(client.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-105"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
} 