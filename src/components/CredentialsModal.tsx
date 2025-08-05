'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Mail, Eye, EyeOff, RefreshCw, Save } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface Credentials {
  username: string;
  password: string;
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientEmail: string;
  onCredentialsUpdated?: () => void;
}

export default function CredentialsModal({ 
  isOpen, 
  onClose, 
  clientId,
  clientName, 
  clientEmail,
  onCredentialsUpdated
}: CredentialsModalProps) {
  const [credentials, setCredentials] = useState<Credentials>({ username: clientEmail, password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | 'email' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(clientEmail);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (isOpen) {
      setCredentials({ username: clientEmail, password: '' });
      setNewEmail(clientEmail);
      setEditingEmail(false);
      setMessage(null);
      fetchCurrentCredentials();
    }
  }, [isOpen, clientEmail]);

  const fetchCurrentCredentials = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/clients/${clientId}/credentials`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCredentials({
          username: data.username || clientEmail,
          password: data.password || ''
        });
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setMessage({ type: 'error', text: 'Nie udało się załadować bieżących poświadczeń' });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'username' | 'password' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      setMessage({ type: 'success', text: `${field === 'username' ? 'E-mail' : field === 'password' ? 'Hasło' : 'E-mail'} skopiowane do schowka!` });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setMessage({ type: 'error', text: 'Nie udało się skopiować do schowka' });
    }
  };

  const regeneratePassword = async () => {
    setIsRegenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/clients/${clientId}/regenerate-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate password');
      }

      const data = await response.json();
      setCredentials(prev => ({ ...prev, password: data.password }));
      setShowPassword(true); // Show the new password
      setMessage({ type: 'success', text: 'Hasło ponownie wygenerowane pomyślnie!' });
      
      if (onCredentialsUpdated) {
        onCredentialsUpdated();
      }
    } catch (error) {
      console.error('Error regenerating password:', error);
      setMessage({ type: 'error', text: 'Nie udało się ponownie wygenerować hasła' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateEmail = async () => {
    if (!newEmail || newEmail === clientEmail) {
      setEditingEmail(false);
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/clients/${clientId}/update-email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: newEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update email');
      }

      setCredentials(prev => ({ ...prev, username: newEmail }));
      setMessage({ type: 'success', text: 'E-mail zaktualizowany pomyślnie!' });
      setEditingEmail(false);
      
      if (onCredentialsUpdated) {
        onCredentialsUpdated();
      }
    } catch (error) {
      console.error('Error updating email:', error);
      setMessage({ type: 'error', text: 'Nie udało się zaktualizować e-maila' });
    } finally {
      setIsSaving(false);
    }
  };

  const generateEmailTemplate = () => {
    const subject = encodeURIComponent('Twoje zaktualizowane poświadczenia konta raportowania Meta Ads');
    const body = encodeURIComponent(`Dear ${clientName},

Twoje poświadczenia konta raportowania Meta Ads zostały zaktualizowane. Oto Twoje bieżące dane logowania:

E-mail: ${credentials.username}
Hasło: ${credentials.password}

Proszę zapisać te poświadczenia w bezpiecznym miejscu. Możesz uzyskać dostęp do swoich raportów pod adresem: [YOUR_APP_URL]

Jeśli masz pytania lub potrzebujesz pomocy, nie wahaj się z nami skontaktować.

Pozdrawiamy,
Zespół raportowania`);

    return `mailto:${credentials.username}?subject=${subject}&body=${body}`;
  };

  const copyEmailTemplate = async () => {
    const emailContent = `Dear ${clientName},

Twoje poświadczenia konta raportowania Meta Ads zostały zaktualizowane. Oto Twoje bieżące dane logowania:

E-mail: ${credentials.username}
Hasło: ${credentials.password}

Proszę zapisać te poświadczenia w bezpiecznym miejscu. Możesz uzyskać dostęp do swoich raportów pod adresem: [YOUR_APP_URL]

Jeśli masz pytania lub potrzebujesz pomocy, nie wahaj się z nami skontaktować.

Pozdrawiamy,
Zespół raportowania`;

    await copyToClipboard(emailContent, 'email');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Poświadczenia klienta</h2>
              <p className="text-sm text-gray-600">{clientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-600">Ładowanie poświadczeń...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Email/Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail logowania
                </label>
                {editingEmail ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Wprowadź nowy e-mail"
                    />
                    <button
                      onClick={updateEmail}
                      disabled={isSaving}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      {isSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmail(false);
                        setNewEmail(credentials.username);
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md p-3">
                    <span className="flex-1 text-sm font-mono text-gray-900">
                      {credentials.username}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(credentials.username, 'username')}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Kopiuj e-mail"
                      >
                        {copiedField === 'username' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingEmail(true)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edytuj e-mail"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hasło
                </label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md p-3">
                  <span className="flex-1 text-sm font-mono text-gray-900">
                    {showPassword ? credentials.password : '••••••••••••'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(credentials.password, 'password')}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Kopiuj hasło"
                    >
                      {copiedField === 'password' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={regeneratePassword}
                      disabled={isRegenerating}
                      className="p-1 text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Ponownie wygeneruj hasło"
                    >
                      {isRegenerating ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Proszę zapisać te poświadczenia w bezpiecznym miejscu. Zmiany są stosowane natychmiast.
                </p>
              </div>

              {/* Email Actions */}
              <div className="space-y-3">
                <a
                  href={generateEmailTemplate()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Wyślij e-mail do klienta
                </a>
                
                <button
                  onClick={copyEmailTemplate}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {copiedField === 'email' ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Szablon e-mail skopiowany!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Kopiuj szablon e-mail
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
} 