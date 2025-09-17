'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  X, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ExternalLink,
  Target,
  Settings,
  Key,
  Shield,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface GoogleAdsTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenData?: { type: 'refresh_token' | 'system_user'; token: string }) => void;
  clientName?: string;
}

export default function GoogleAdsTokenModal({ isOpen, onClose, onSuccess, clientName }: GoogleAdsTokenModalProps) {
  const [tokenType, setTokenType] = useState<'refresh_token' | 'system_user'>('refresh_token');
  const [refreshToken, setRefreshToken] = useState('');
  const [systemUserToken, setSystemUserToken] = useState('');
  const [managerRefreshToken, setManagerRefreshToken] = useState('');
  const [existingRefreshToken, setExistingRefreshToken] = useState('');
  const [existingSystemUserToken, setExistingSystemUserToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showManagerToken, setShowManagerToken] = useState(false);
  const [showExistingToken, setShowExistingToken] = useState(false);
  const [showExistingSystemToken, setShowExistingSystemToken] = useState(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error' | 'validating';
    message: string;
  }>({ type: 'idle', message: '' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch existing tokens when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExistingTokens();
    }
  }, [isOpen]);

  const fetchExistingTokens = async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        return;
      }

      const response = await fetch('/api/admin/google-ads-settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Access settings from the nested structure
        const settings = data.settings || {};
        
        // Set existing tokens or empty string if not found
        const refreshToken = settings.google_ads_manager_refresh_token || '';
        const systemUserToken = settings.google_ads_system_user_token || '';
        
        setExistingRefreshToken(refreshToken);
        setExistingSystemUserToken(systemUserToken);
      } else {
        console.error('API response not ok:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch existing tokens:', error);
    }
  };

  if (!isOpen) return null;

  const validateAndSave = async () => {
    const currentToken = tokenType === 'refresh_token' ? refreshToken : systemUserToken;
    
    if (!currentToken.trim()) {
      setStatus({ type: 'error', message: `${tokenType === 'refresh_token' ? 'Refresh token' : 'System User Token'} jest wymagany` });
      return;
    }

    // Validation based on token type
    if (tokenType === 'refresh_token') {
      // Allow both refresh tokens (1//) and developer tokens (for testing)
      if (!refreshToken.startsWith('1//') && refreshToken !== 'WCX04VxQqB0fsV0YDX0w1g') {
        setStatus({ type: 'error', message: 'Refresh token powinien zaczynać się od "1//" lub być developer tokenem do testów' });
        return;
      }
    } else {
      // System user token validation
      if (systemUserToken.length < 20) {
        setStatus({ type: 'error', message: 'System User Token wydaje się za krótki' });
        return;
      }
    }

    setValidating(true);
    setStatus({ type: 'validating', message: 'Walidacja tokenu...' });

    try {
      let saveResponse;
      
      if (tokenType === 'refresh_token') {
        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setStatus({ type: 'error', message: 'Brak tokenu dostępu' });
          return;
        }

        // Test the token first
        const response = await fetch('/api/admin/test-google-ads-health', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ testToken: refreshToken })
        });

        if (!response.ok) {
          const error = await response.json();
          setStatus({ type: 'error', message: `Walidacja nie powiodła się: ${error.error}` });
          return;
        }

        // If validation passes, save the token
        setLoading(true);
        saveResponse = await fetch('/api/admin/google-ads-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            google_ads_manager_refresh_token: refreshToken
          })
        });
      } else {
        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setStatus({ type: 'error', message: 'Brak tokenu dostępu' });
          return;
        }

        // Save system user token
        setLoading(true);
        saveResponse = await fetch('/api/admin/google-ads-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            google_ads_system_user_token: systemUserToken,
            token_type: 'system_user'
          })
        });
      }

      if (saveResponse.ok) {
        setStatus({ type: 'success', message: '✅ Token został zapisany i zweryfikowany!' });
        setTimeout(() => {
          onSuccess({ type: tokenType, token: currentToken });
          onClose();
          resetModal();
        }, 1500);
      } else {
        const error = await saveResponse.json();
        setStatus({ type: 'error', message: `Błąd zapisu: ${error.error}` });
      }
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: `Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
      });
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const resetModal = () => {
    setRefreshToken('');
    setSystemUserToken('');
    setManagerRefreshToken('');
    setStatus({ type: 'idle', message: '' });
    setShowToken(false);
    setShowManagerToken(false);
    setShowExistingToken(false);
    setShowExistingSystemToken(false);
    setTokenType('refresh_token');
  };

  const handleClose = () => {
    if (!loading && !validating) {
      onClose();
      resetModal();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Target className="h-6 w-6 mr-3 text-orange-600" />
            <div>
              <h2 className="text-xl font-semibold">Google Ads Token Setup</h2>
              {clientName && <p className="text-sm text-gray-600">dla klienta: {clientName}</p>}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading || validating}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Token Type Switcher */}
          <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <button
              onClick={() => setTokenType('refresh_token')}
              disabled={loading || validating}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                tokenType === 'refresh_token'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              <Key className="h-4 w-4 mr-2" />
              Refresh Token
            </button>
            <button
              onClick={() => setTokenType('system_user')}
              disabled={loading || validating}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                tokenType === 'system_user'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              <Shield className="h-4 w-4 mr-2" />
              System User Token
            </button>
          </div>

          {/* Existing Token Display */}
          {tokenType === 'refresh_token' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                <Key className="h-4 w-4 mr-2" />
                Aktualny Refresh Token
              </h3>
              {existingRefreshToken ? (
                <>
                  <div className="flex">
                    <input
                      type={showExistingToken ? "text" : "password"}
                      value={existingRefreshToken}
                      readOnly
                      className="flex-1 border border-blue-300 px-3 py-2 rounded-l-lg bg-blue-50 text-blue-800 text-sm"
                    />
                    <button
                      onClick={() => setShowExistingToken(!showExistingToken)}
                      className="px-3 py-2 bg-blue-100 border border-l-0 border-blue-300 rounded-r-lg hover:bg-blue-200"
                    >
                      {showExistingToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Aktualnie używany token - wprowadź nowy poniżej aby zaktualizować
                  </p>
                </>
              ) : (
                <div className="text-center py-3">
                  <p className="text-blue-800 font-medium">Nie ustawiono</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Wprowadź token poniżej aby skonfigurować
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Aktualny System User Token
              </h3>
              {existingSystemUserToken ? (
                <>
                  <div className="flex">
                    <input
                      type={showExistingSystemToken ? "text" : "password"}
                      value={existingSystemUserToken}
                      readOnly
                      className="flex-1 border border-green-300 px-3 py-2 rounded-l-lg bg-green-50 text-green-800 text-sm"
                    />
                    <button
                      onClick={() => setShowExistingSystemToken(!showExistingSystemToken)}
                      className="px-3 py-2 bg-green-100 border border-l-0 border-green-300 rounded-r-lg hover:bg-green-200"
                    >
                      {showExistingSystemToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    Aktualnie używany token - wprowadź nowy poniżej aby zaktualizować
                  </p>
                </>
              ) : (
                <div className="text-center py-3">
                  <p className="text-green-800 font-medium">Nie ustawiono</p>
                  <p className="text-xs text-green-600 mt-1">
                    Wprowadź token poniżej aby skonfigurować
                  </p>
                </div>
              )}
            </div>
          )}


          {/* Token Input Fields */}
          {tokenType === 'refresh_token' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manager Refresh Token
              </label>
              <div className="flex">
                <input
                  type={showToken ? "text" : "password"}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  disabled={loading || validating}
                  className="flex-1 border border-gray-300 px-3 py-2 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="1//04..."
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  disabled={loading || validating}
                  className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Powinien zaczynać się od "1//" - jeden token dla wszystkich klientów
              </p>
              <button
                onClick={() => setRefreshToken('WCX04VxQqB0fsV0YDX0w1g')}
                disabled={loading || validating}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                🧪 Test: Użyj Developer Token jako Refresh Token
              </button>
            </div>
          ) : (
            <div>
              {/* System User Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System User Token *
                </label>
                <div className="flex">
                  <input
                    type={showToken ? "text" : "password"}
                    value={systemUserToken}
                    onChange={(e) => setSystemUserToken(e.target.value)}
                    disabled={loading || validating}
                    className="flex-1 border border-gray-300 px-3 py-2 rounded-l-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                    placeholder="Wprowadź System User Token..."
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    disabled={loading || validating}
                    className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Permanentny token dla tego klienta - nie wygasa
                </p>
              </div>
            </div>
          )}

          {/* Token Setup Guides */}
          {tokenType === 'refresh_token' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                <ExternalLink className="h-4 w-4 mr-2" />
                Szybka Regeneracja
              </h3>
              <ol className="text-sm text-blue-800 space-y-2">
                <li>1. <a href="https://developers.google.com/oauthplayground/" target="_blank" className="underline">OAuth Playground</a></li>
                <li>2. ⚙️ → "Use your own OAuth credentials"</li>
                <li>3. Client ID: <code className="bg-blue-100 px-1 rounded text-xs break-all">1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com</code></li>
                <li>4. Client Secret: <code className="bg-blue-100 px-1 rounded text-xs break-all">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</code></li>
                <li>5. Google Ads API v14 → <code className="bg-blue-100 px-1 rounded text-xs break-all">https://www.googleapis.com/auth/adwords</code></li>
                <li>6. Autoryzuj z Manager (293-100-0497) → Skopiuj "Refresh token"</li>
                <li><strong>Alternatywa:</strong> Użyj Developer Token: <code className="bg-blue-100 px-1 rounded text-xs">WCX04VxQqB0fsV0YDX0w1g</code></li>
              </ol>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                System User Token Setup
              </h3>
              <div className="text-sm text-green-800 space-y-3">
                <p><strong>Zalety:</strong> Permanentny dostęp, nie wymaga ponownej autoryzacji</p>
                <div>
                  <p className="font-medium mb-2">Kroki do utworzenia System User Token:</p>
                  <ol className="space-y-2 ml-4">
                    <li>1. <a href="https://developers.google.com/oauthplayground/" target="_blank" className="underline">OAuth Playground</a></li>
                    <li>2. ⚙️ → "Use your own OAuth credentials"</li>
                    <li>3. Client ID: <code className="bg-green-100 px-1 rounded text-xs break-all">1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com</code></li>
                    <li>4. Client Secret: <code className="bg-green-100 px-1 rounded text-xs break-all">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</code></li>
                    <li>5. Google Ads API v14 → <code className="bg-green-100 px-1 rounded text-xs break-all">https://www.googleapis.com/auth/adwords</code></li>
                    <li>6. Autoryzuj z Manager (293-100-0497) → Utwórz System User Token</li>
                    <li><strong>Alternatywa:</strong> Użyj Developer Token: <code className="bg-green-100 px-1 rounded text-xs">WCX04VxQqB0fsV0YDX0w1g</code></li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {status.message && (
            <div className={`rounded-lg p-3 flex items-center ${
              status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
              status.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
              status.type === 'validating' ? 'bg-blue-50 border border-blue-200 text-blue-800' :
              'bg-gray-50 border border-gray-200 text-gray-800'
            }`}>
              {status.type === 'success' && <CheckCircle className="h-5 w-5 mr-2" />}
              {status.type === 'error' && <AlertCircle className="h-5 w-5 mr-2" />}
              {status.type === 'validating' && <RefreshCw className="h-5 w-5 mr-2 animate-spin" />}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={loading || validating}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            onClick={validateAndSave}
            disabled={loading || validating || (tokenType === 'refresh_token' ? !refreshToken.trim() : !systemUserToken.trim())}
            className={`px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center ${
              tokenType === 'refresh_token' ? 'bg-blue-600' : 'bg-green-600'
            }`}
          >
            {(loading || validating) ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : tokenType === 'refresh_token' ? (
              <Key className="h-4 w-4 mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {validating ? 'Walidacja...' : loading ? 'Zapisywanie...' : 
             tokenType === 'refresh_token' ? 'Zapisz Refresh Token' : 'Zapisz System User Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
