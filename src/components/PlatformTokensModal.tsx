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
  Key,
  Shield,
  Facebook
} from 'lucide-react';

interface PlatformTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data?: { platform: 'google' | 'meta'; type?: string; token: string }) => void;
}

export default function PlatformTokensModal({ isOpen, onClose, onSuccess }: PlatformTokensModalProps) {
  // Platform selection
  const [platform, setPlatform] = useState<'google' | 'meta'>('google');
  
  // Google Ads States
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
  const [existingGoogleRefreshToken, setExistingGoogleRefreshToken] = useState('');
  
  // Meta States
  const [metaSystemUserToken, setMetaSystemUserToken] = useState('');
  const [existingMetaSystemUserToken, setExistingMetaSystemUserToken] = useState('');
  
  // Common States
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showExistingToken, setShowExistingToken] = useState(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        return;
      }

      // Fetch Google Ads settings
      const googleResponse = await fetch('/api/admin/google-ads-settings', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        cache: 'no-store' // Disable cache
      });
      
      if (googleResponse.ok) {
        const data = await googleResponse.json();
        const settings = data.settings || {};
        setExistingGoogleRefreshToken(settings.google_ads_manager_refresh_token || '');
      }

      // Fetch Meta settings
      const metaResponse = await fetch('/api/admin/meta-settings', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        cache: 'no-store' // Disable cache
      });
      
      if (metaResponse.ok) {
        const data = await metaResponse.json();
        console.log('🔍 Meta settings API response:', data);
        console.log('🔑 Meta token value:', data.meta_system_user_token);
        console.log('🔑 Meta token length:', data.meta_system_user_token?.length);
        setExistingMetaSystemUserToken(data.meta_system_user_token || '');
      } else {
        console.error('❌ Meta settings API failed:', metaResponse.status, await metaResponse.text());
      }
    } catch (error) {
      console.error('Failed to fetch existing tokens:', error);
    }
  };

  const validateAndSaveGoogle = async () => {
    if (!googleRefreshToken.trim()) {
      setStatus({ type: 'error', message: 'Refresh token jest wymagany' });
      return;
    }

    // Validate refresh token format
    if (!googleRefreshToken.startsWith('1//') && googleRefreshToken !== 'WCX04VxQqB0fsV0YDX0w1g') {
      setStatus({ type: 'error', message: 'Refresh token powinien zaczynać się od "1//" lub być developer tokenem do testów' });
      return;
    }

    setValidating(true);
    setStatus({ type: 'validating', message: 'Walidacja tokenu...' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus({ type: 'error', message: 'Brak tokenu dostępu' });
        return;
      }

      // Test the token first
      const testResponse = await fetch('/api/admin/test-google-ads-health', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ testToken: googleRefreshToken })
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        setStatus({ type: 'error', message: `Walidacja nie powiodła się: ${error.error}` });
        return;
      }

      // Save the token
      setLoading(true);
      const saveResponse = await fetch('/api/admin/google-ads-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ google_ads_manager_refresh_token: googleRefreshToken })
      });

      if (saveResponse.ok) {
        setStatus({ type: 'success', message: '✅ Google Ads token został zapisany i zweryfikowany!' });
        setTimeout(() => {
          onSuccess({ platform: 'google', type: 'refresh_token', token: googleRefreshToken });
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

  const validateAndSaveMeta = async () => {
    if (!metaSystemUserToken.trim()) {
      setStatus({ type: 'error', message: 'Meta System User Token jest wymagany' });
      return;
    }

    if (metaSystemUserToken.length < 50) {
      setStatus({ type: 'error', message: 'Token wydaje się za krótki (Meta tokeny zwykle mają 100+ znaków)' });
      return;
    }

    if (!metaSystemUserToken.startsWith('EAA')) {
      setStatus({ type: 'error', message: 'Meta tokeny zwykle zaczynają się od "EAA"' });
      return;
    }

    setValidating(true);
    setStatus({ type: 'validating', message: 'Zapisywanie tokenu Meta...' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus({ type: 'error', message: 'Brak tokenu dostępu' });
        return;
      }

      setLoading(true);
      const saveResponse = await fetch('/api/admin/meta-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          meta_system_user_token: metaSystemUserToken
        })
      });

      if (saveResponse.ok) {
        setStatus({ type: 'success', message: '✅ Meta System User Token został zapisany!' });
        setTimeout(() => {
          onSuccess({ platform: 'meta', token: metaSystemUserToken });
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

  const handleSave = () => {
    if (platform === 'google') {
      validateAndSaveGoogle();
    } else {
      validateAndSaveMeta();
    }
  };

  const resetModal = () => {
    setGoogleRefreshToken('');
    setMetaSystemUserToken('');
    setStatus({ type: 'idle', message: '' });
    setShowToken(false);
    setShowExistingToken(false);
    setPlatform('google');
  };

  const handleClose = () => {
    if (!loading && !validating) {
      onClose();
      resetModal();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Key className="h-6 w-6 mr-3 text-orange-600" />
            <div>
              <h2 className="text-xl font-semibold">Platform API Tokens</h2>
              <p className="text-sm text-gray-600">Zarządzaj tokenami Google Ads i Meta</p>
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

        {/* Platform Tabs */}
        <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 border-b">
          <button
            onClick={() => setPlatform('google')}
            disabled={loading || validating}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              platform === 'google'
                ? 'bg-[#EA580C] text-white shadow-lg scale-105 border-2 border-[#C2410C] hover:bg-[#DC2626]'
                : 'bg-white text-gray-700 hover:bg-orange-50 border-2 border-gray-300 hover:border-orange-300'
            } disabled:opacity-50`}
          >
            <Target className="h-5 w-5 mr-2" />
            Google Ads
          </button>
          <button
            onClick={() => setPlatform('meta')}
            disabled={loading || validating}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              platform === 'meta'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg scale-105 border-2 border-blue-700'
                : 'bg-white text-gray-700 hover:bg-blue-50 border-2 border-transparent hover:border-blue-200'
            } disabled:opacity-50`}
          >
            <Facebook className="h-5 w-5 mr-2" />
            Meta Ads
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {platform === 'google' ? (
            <>
              {/* Existing Google Token Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Key className="h-4 w-4 mr-2" />
                  Aktualny Refresh Token
                </h3>
                {existingGoogleRefreshToken ? (
                  <>
                    <div className="flex">
                      <input
                        type={showExistingToken ? "text" : "password"}
                        value={existingGoogleRefreshToken}
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
                      Dla trwałego dostępu, opublikuj aplikację OAuth do trybu "Production"
                    </p>
                  </div>
                )}
              </div>

              {/* Google Token Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manager Refresh Token
                </label>
                <div className="flex">
                  <input
                    type={showToken ? "text" : "password"}
                    value={googleRefreshToken}
                    onChange={(e) => setGoogleRefreshToken(e.target.value)}
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
              </div>

              {/* Google Setup Guide */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-medium text-orange-900 mb-2 flex items-center">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Szybka Regeneracja
                </h3>
                <ol className="text-sm text-orange-800 space-y-2">
                  <li>1. <a href="https://developers.google.com/oauthplayground/" target="_blank" className="underline">OAuth Playground</a></li>
                  <li>2. ⚙️ → "Use your own OAuth credentials"</li>
                  <li>3. Google Ads API v14 → Autoryzuj z Manager (293-100-0497)</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              {/* Meta Token Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Aktualny Meta System User Token
                </h3>
                {existingMetaSystemUserToken ? (
                  <>
                    <div className="flex">
                      <input
                        type={showExistingToken ? "text" : "password"}
                        value={existingMetaSystemUserToken}
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
                      Aktualnie używany token globalny - wprowadź nowy poniżej aby zaktualizować
                    </p>
                  </>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-blue-800 font-medium">Nie ustawiono</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Ten token będzie używany dla wszystkich klientów Meta
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Token Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta System User Token *
                </label>
                <div className="flex">
                  <input
                    type={showToken ? "text" : "password"}
                    value={metaSystemUserToken}
                    onChange={(e) => setMetaSystemUserToken(e.target.value)}
                    disabled={loading || validating}
                    className="flex-1 border border-gray-300 px-3 py-2 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    placeholder="EAABwzLixnjYBO..."
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
                  Permanentny token dla wszystkich klientów Meta - nie wygasa
                </p>
              </div>

              {/* Meta Setup Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  System User Token Setup
                </h3>
                <div className="text-sm text-blue-800 space-y-3">
                  <p><strong>Zalety:</strong> Permanentny dostęp, nie wymaga ponownej autoryzacji, jeden token dla wszystkich klientów</p>
                  <div>
                    <p className="font-medium mb-2">Kroki do utworzenia:</p>
                    <ol className="space-y-2 ml-4">
                      <li>1. <a href="https://business.facebook.com/" target="_blank" className="underline">Business Manager</a></li>
                      <li>2. Settings → System Users → Add</li>
                      <li>3. Generate Token z uprawnieniami: ads_read, ads_management, business_management</li>
                      <li>4. Przypisz token do wszystkich kont reklamowych</li>
                    </ol>
                  </div>
                </div>
              </div>
            </>
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
            onClick={handleSave}
            disabled={loading || validating || (
              platform === 'google' 
                ? !googleRefreshToken.trim()
                : !metaSystemUserToken.trim()
            )}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center bg-blue-600"
          >
            {(loading || validating) ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : platform === 'google' ? (
              <Key className="h-4 w-4 mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {validating ? 'Walidacja...' : loading ? 'Zapisywanie...' : 
             platform === 'google'
              ? 'Zapisz Refresh Token'
              : 'Zapisz Meta Token'}
          </button>
        </div>
      </div>
    </div>
  );
}

