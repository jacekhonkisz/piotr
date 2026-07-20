'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Phase = 'validating' | 'ready' | 'invalid' | 'done';

function stripRecoveryParamsFromUrl(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  let changed = false;

  for (const key of ['token_hash', 'token', 'type', 'code']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (window.location.hash) {
    window.history.replaceState({}, '', url.pathname + url.search);
    changed = true;
  } else if (changed) {
    window.history.replaceState({}, '', url.pathname + url.search);
  }
}

function decodeAuthError(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('validating');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let resolved = false;

    const markReady = () => {
      if (resolved) return;
      resolved = true;
      stripRecoveryParamsFromUrl();
      setPhase('ready');
    };

    const markInvalid = (message?: string) => {
      if (resolved) return;
      resolved = true;
      if (message) {
        setError(message);
      }
      setPhase('invalid');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && session)
      ) {
        markReady();
      }
    });

    const bootstrap = async () => {
      if (typeof window === 'undefined') return;

      if (window.location.hash.includes('error')) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const desc = params.get('error_description');
        markInvalid(desc ? decodeAuthError(desc) : undefined);
        return;
      }

      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token');
      const type = url.searchParams.get('type');

      if (tokenHash && type === 'recovery') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });

        if (!verifyError && data.session) {
          markReady();
          return;
        }

        if (verifyError) {
          markInvalid(verifyError.message);
          return;
        }
      }

      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          markReady();
          return;
        }

        const { data: sessionAfterExchange } = await supabase.auth.getSession();
        if (!sessionAfterExchange.session) {
          markInvalid(exchangeError.message);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        markReady();
      }
    };

    bootstrap();

    const timeout = setTimeout(() => {
      if (!resolved) {
        setPhase((prev) => (prev === 'validating' ? 'invalid' : prev));
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    if (password !== confirm) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sesja resetowania wygasła. Poproś o nowy link.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }
      setPhase('done');
      await supabase.auth.signOut();
      setTimeout(() => router.replace('/auth/login'), 2500);
    } catch (err: any) {
      const message = (err?.message || '').toLowerCase();
      if (message.includes('should be different') || message.includes('same as the old')) {
        setError('Nowe hasło musi różnić się od poprzedniego.');
      } else if (message.includes('weak') || message.includes('at least')) {
        setError('Hasło jest zbyt słabe. Wybierz mocniejsze hasło.');
      } else if (message.includes('session') || message.includes('jwt')) {
        setError('Link wygasł lub sesja resetowania wygasła. Poproś o nowy link.');
        setPhase('invalid');
      } else {
        setError(err?.message || 'Nie udało się zaktualizować hasła.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center mb-8">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="ml-2 text-xl font-semibold text-gray-900">
            Meta Ads Raportowanie
          </h1>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Ustaw nowe hasło
          </h2>
          <p className="text-gray-600">Wprowadź nowe hasło do swojego konta</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10">
          {phase === 'validating' && (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-sm text-gray-600">Weryfikacja linku...</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Link jest nieprawidłowy lub wygasł
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {error || 'Poproś o nowy link do resetowania hasła.'}
              </p>
              <Link
                href="/auth/forgot-password"
                className="mt-6 inline-flex w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Wyślij nowy link
              </Link>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Hasło zostało zmienione
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Za chwilę przekierujemy Cię do strony logowania...
              </p>
            </div>
          )}

          {phase === 'ready' && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Nowe hasło
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum 6 znaków.</p>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                  Powtórz nowe hasło
                </label>
                <div className="mt-1">
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Zapisywanie...
                    </div>
                  ) : (
                    'Zapisz nowe hasło'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
