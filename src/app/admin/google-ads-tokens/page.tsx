'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Target,
  ArrowLeft,
  TestTube,
  Activity,
  Users,
  Edit,
  Facebook
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import GoogleAdsTokenModal from '../../../components/GoogleAdsTokenModal';
import { AdminLoading } from '../../../components/LoadingSpinner';

interface TokenHealth {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  message: string;
  lastChecked: string;
  details?: {
    refreshTokenValid: boolean;
    developerTokenValid: boolean;
    accessibleCustomers: number;
    lastSuccessfulCall: string;
    errorCount: number;
  };
}

interface GoogleAdsSettings {
  google_ads_client_id: string;
  google_ads_client_secret: string;
  google_ads_developer_token: string;
  google_ads_manager_refresh_token: string;
  google_ads_manager_customer_id: string;
}

export default function GoogleAdsTokensPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [settings, setSettings] = useState<GoogleAdsSettings>({
    google_ads_client_id: '',
    google_ads_client_secret: '',
    google_ads_developer_token: '',
    google_ads_manager_refresh_token: '',
    google_ads_manager_customer_id: ''
  });
  
  const [tokenHealth, setTokenHealth] = useState<TokenHealth>({
    status: 'unknown',
    message: 'Sprawdzanie stanu tokenów...',
    lastChecked: new Date().toISOString()
  });
  
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [platformHealth, setPlatformHealth] = useState<any>(null);
  const [loadingPlatformHealth, setLoadingPlatformHealth] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Load settings and check token health
  useEffect(() => {
    if (user) {
      loadSettings();
      loadClients();
      loadPlatformHealth();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/google-ads-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setTokenHealth(data.health);
        setLastUpdate(data.lastUpdate || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        const googleClients = data.clients.filter((client: any) => client.google_ads_customer_id);
        setClients(googleClients);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadPlatformHealth = async () => {
    setLoadingPlatformHealth(true);
    try {
      const response = await fetch('/api/admin/platform-separation-health');
      if (response.ok) {
        const data = await response.json();
        setPlatformHealth(data.health);
      }
    } catch (error) {
      console.error('Error loading platform health:', error);
    } finally {
      setLoadingPlatformHealth(false);
    }
  };



  const testTokenHealth = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/admin/test-google-ads-health', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setTokenHealth(data.health);
        setLastUpdate(new Date().toISOString());
      } else {
        const error = await response.json();
        setTokenHealth({
          status: 'error',
          message: `Test failed: ${error.error}`,
          lastChecked: new Date().toISOString()
        });
      }
    } catch (error) {
      setTokenHealth({
        status: 'error',
        message: `Test error: ${error}`,
        lastChecked: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };



  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200 text-green-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (authLoading || loading) {
    return <AdminLoading text="Ładowanie ustawień Google Ads..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Powrót do Panelu Admin
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Target className="h-8 w-8 mr-3 text-orange-600" />
                Google Ads Token Management
              </h1>
              <p className="text-gray-600 mt-2">
                Zarządzaj tokenami Google Ads API i monitoruj ich stan zdrowia
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowTokenModal(true)}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Aktualizuj Token
              </button>
              
              <button
                onClick={testTokenHealth}
                disabled={testing}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {testing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Health
              </button>
            </div>
          </div>
        </div>

        {/* Token Health Status */}
        <div className={`rounded-lg border p-6 mb-8 ${getStatusColor(tokenHealth.status)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              {getStatusIcon(tokenHealth.status)}
              <div className="ml-3">
                <h3 className="font-semibold text-lg">Stan Tokenów Google Ads</h3>
                <p className="mt-1">{tokenHealth.message}</p>
                <p className="text-sm mt-2 opacity-75">
                  Ostatnie sprawdzenie: {new Date(tokenHealth.lastChecked).toLocaleString('pl-PL')}
                </p>
                
                {tokenHealth.details && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Refresh Token:</span> 
                      {tokenHealth.details.refreshTokenValid ? ' ✅ Ważny' : ' ❌ Nieważny'}
                    </div>
                    <div>
                      <span className="font-medium">Developer Token:</span> 
                      {tokenHealth.details.developerTokenValid ? ' ✅ Ważny' : ' ❌ Nieważny'}
                    </div>
                    <div>
                      <span className="font-medium">Dostępni klienci:</span> {tokenHealth.details.accessibleCustomers}
                    </div>
                    <div>
                      <span className="font-medium">Ostatnie udane połączenie:</span> 
                      {tokenHealth.details.lastSuccessfulCall ? 
                        new Date(tokenHealth.details.lastSuccessfulCall).toLocaleString('pl-PL') : 
                        'Nigdy'
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Activity className="h-6 w-6 opacity-50" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Token Configuration Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-blue-600" />
              Konfiguracja Systemu
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Manager Account</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Customer ID: <span className="font-mono">293-100-0497</span></div>
                  <div>Developer Token: <span className="font-mono">WCX04VxQqB...</span></div>
                  <div>Refresh Token: {settings.google_ads_manager_refresh_token ? 
                    <span className="text-green-600">✅ Skonfigurowany</span> : 
                    <span className="text-red-600">❌ Brak</span>
                  }</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Zarządzanie Tokenami</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <div>• <strong>Manager Token:</strong> Jeden token dla wszystkich klientów</div>
                  <div>• <strong>Client Tokens:</strong> Zarządzane przez "Dodaj Klienta"</div>
                  <div>• <strong>Aktualizacja:</strong> Użyj przycisku "Aktualizuj Token" powyżej</div>
                </div>
              </div>

              {lastUpdate && (
                <div className="text-sm text-gray-500">
                  Ostatnia aktualizacja: {new Date(lastUpdate).toLocaleString('pl-PL')}
                </div>
              )}
            </div>
          </div>

          {/* Connected Clients */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <Users className="h-5 w-5 mr-2 text-green-600" />
              Podłączeni Klienci ({clients.length})
            </h2>

            {clients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak klientów z Google Ads</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-gray-500">
                        ID: {client.google_ads_customer_id}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {tokenHealth.status === 'healthy' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <button
                        onClick={() => router.push(`/admin/clients/${client.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Szczegóły
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lastUpdate && (
              <div className="mt-6 pt-4 border-t text-sm text-gray-500">
                Ostatnia aktualizacja: {new Date(lastUpdate).toLocaleString('pl-PL')}
              </div>
            )}
          </div>
        </div>

        {/* Platform Separation Monitoring */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              <Activity className="h-5 w-5 mr-2 text-purple-600" />
              Monitorowanie Separacji Platform
            </h2>
            <button
              onClick={loadPlatformHealth}
              disabled={loadingPlatformHealth}
              className="flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loadingPlatformHealth ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Odśwież
            </button>
          </div>

          {platformHealth ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`rounded-lg border p-4 ${getStatusColor(platformHealth.overall.status)}`}>
                <div className="flex items-center">
                  {getStatusIcon(platformHealth.overall.status)}
                  <div className="ml-3">
                    <h3 className="font-semibold">Stan Ogólny</h3>
                    <p>{platformHealth.overall.message}</p>
                    <p className="text-sm mt-1 opacity-75">
                      Sprawdzono: {new Date(platformHealth.overall.lastChecked).toLocaleString('pl-PL')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Platform Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meta Platform */}
                <div className={`rounded-lg border p-4 ${getStatusColor(platformHealth.meta.status)}`}>
                  <div className="flex items-center mb-3">
                    <Facebook className="h-5 w-5 mr-2" />
                    <h3 className="font-semibold">Meta Ads Platform</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>Klienci: <span className="font-medium">{platformHealth.meta.clientsCount}</span></div>
                    <div>Ważne tokeny: <span className="font-medium">{platformHealth.meta.tokensValid}</span></div>
                    {platformHealth.meta.lastSuccessfulFetch && (
                      <div>Ostatnie pobranie: <span className="font-medium">
                        {new Date(platformHealth.meta.lastSuccessfulFetch).toLocaleString('pl-PL')}
                      </span></div>
                    )}
                    {platformHealth.meta.issues.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Problemy:</div>
                        <ul className="list-disc list-inside">
                          {platformHealth.meta.issues.map((issue: string, index: number) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Ads Platform */}
                <div className={`rounded-lg border p-4 ${getStatusColor(platformHealth.google.status)}`}>
                  <div className="flex items-center mb-3">
                    <Target className="h-5 w-5 mr-2" />
                    <h3 className="font-semibold">Google Ads Platform</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>Klienci: <span className="font-medium">{platformHealth.google.clientsCount}</span></div>
                    <div>Token ważny: <span className="font-medium">
                      {platformHealth.google.tokenValid ? '✅ Tak' : '❌ Nie'}
                    </span></div>
                    {platformHealth.google.lastSuccessfulFetch && (
                      <div>Ostatnie pobranie: <span className="font-medium">
                        {new Date(platformHealth.google.lastSuccessfulFetch).toLocaleString('pl-PL')}
                      </span></div>
                    )}
                    {platformHealth.google.issues.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Problemy:</div>
                        <ul className="list-disc list-inside">
                          {platformHealth.google.issues.map((issue: string, index: number) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Separation Status */}
              <div className={`rounded-lg border p-4 ${
                platformHealth.separation.dataIsolated && !platformHealth.separation.crossContamination 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <div className="flex items-center mb-3">
                  <Shield className="h-5 w-5 mr-2" />
                  <h3 className="font-semibold">Separacja Danych</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div>Dane izolowane: <span className="font-medium">
                    {platformHealth.separation.dataIsolated ? '✅ Tak' : '❌ Nie'}
                  </span></div>
                  <div>Krzyżowe zanieczyszczenie: <span className="font-medium">
                    {platformHealth.separation.crossContamination ? '❌ Wykryto' : '✅ Brak'}
                  </span></div>
                  {platformHealth.separation.issues.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Uwagi:</div>
                      <ul className="list-disc list-inside">
                        {platformHealth.separation.issues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {loadingPlatformHealth ? (
                <>
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Sprawdzanie stanu platform...</p>
                </>
              ) : (
                <>
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Kliknij "Odśwież" aby sprawdzić stan platform</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Token Update Modal */}
      <GoogleAdsTokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onSuccess={() => {
          loadSettings();
          testTokenHealth();
        }}
      />
    </div>
  );
}
