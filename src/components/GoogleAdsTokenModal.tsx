'use client';

import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ExternalLink,
  Target
} from 'lucide-react';

interface GoogleAdsTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GoogleAdsTokenModal({ isOpen, onClose, onSuccess }: GoogleAdsTokenModalProps) {
  const [refreshToken, setRefreshToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error' | 'validating';
    message: string;
  }>({ type: 'idle', message: '' });

  if (!isOpen) return null;

  const validateAndSave = async () => {
    if (!refreshToken.trim()) {
      setStatus({ type: 'error', message: 'Refresh token jest wymagany' });
      return;
    }

    // Allow both refresh tokens (1//) and developer tokens (for testing)
    if (!refreshToken.startsWith('1//') && refreshToken !== 'WCX04VxQqB0fsV0YDX0w1g') {
      setStatus({ type: 'error', message: 'Refresh token powinien zaczynać się od "1//" lub być developer tokenem do testów' });
      return;
    }

    setValidating(true);
    setStatus({ type: 'validating', message: 'Walidacja tokenu...' });

    try {
      // Test the token first
      const response = await fetch('/api/admin/test-google-ads-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testToken: refreshToken })
      });

      if (!response.ok) {
        const error = await response.json();
        setStatus({ type: 'error', message: `Walidacja nie powiodła się: ${error.error}` });
        return;
      }

      // If validation passes, save the token
      setLoading(true);
      const saveResponse = await fetch('/api/admin/google-ads-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_ads_manager_refresh_token: refreshToken
        })
      });

      if (saveResponse.ok) {
        setStatus({ type: 'success', message: '✅ Token został zapisany i zweryfikowany!' });
        setTimeout(() => {
          onSuccess();
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
    setStatus({ type: 'idle', message: '' });
    setShowToken(false);
  };

  const handleClose = () => {
    if (!loading && !validating) {
      onClose();
      resetModal();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Target className="h-6 w-6 mr-3 text-orange-600" />
            <h2 className="text-xl font-semibold">Aktualizuj Google Ads Token</h2>
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
          {/* Quick Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2 flex items-center">
              <ExternalLink className="h-4 w-4 mr-2" />
              Szybka Regeneracja
            </h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. <a href="https://developers.google.com/oauthplayground/" target="_blank" className="underline">OAuth Playground</a></li>
              <li>2. ⚙️ → "Use your own OAuth credentials"</li>
              <li>3. Client ID: 1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com</li>
              <li>4. Client Secret: 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</li>
              <li>5. Google Ads API v14 → https://www.googleapis.com/auth/adwords</li>
              <li>6. Autoryzuj z Manager (293-100-0497) → Skopiuj "Refresh token"</li>
              <li><strong>Alternatywa:</strong> Użyj Developer Token: WCX04VxQqB0fsV0YDX0w1g</li>
            </ol>
          </div>

          {/* Token Input */}
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
            disabled={loading || validating || !refreshToken.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {(loading || validating) ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {validating ? 'Walidacja...' : loading ? 'Zapisywanie...' : 'Zapisz i Zweryfikuj'}
          </button>
        </div>
      </div>
    </div>
  );
}
