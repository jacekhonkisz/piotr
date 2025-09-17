'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { signIn } from '@/lib/auth';
import { BarChart3, Eye, EyeOff } from 'lucide-react';
import { LoginLoading } from '@/components/LoadingSpinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, profile, authLoading } = useAuth();
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const redirectedRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus email input on mount
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  // Handle authentication redirects - prevent multiple redirects
  useEffect(() => {
    console.log('Login page useEffect - authLoading:', authLoading, 'user:', user?.email, 'profile:', profile?.role, 'redirected:', redirectedRef.current);
    
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // Only redirect if auth is not loading, user is authenticated, and we haven't redirected yet
    if (!authLoading && user && profile && !redirectedRef.current) {
      console.log('User authenticated, redirecting based on role:', profile.role);
      redirectedRef.current = true;
      
      if (profile.role === 'admin') {
        console.log('Redirecting to /admin');
        router.replace('/admin');
      } else {
        console.log('Redirecting to /dashboard');
        router.replace('/dashboard');
      }
    } else if (!authLoading && !user) {
      console.log('No user authenticated, staying on login page');
      redirectedRef.current = false; // Reset redirect flag if no user
    } else if (!authLoading && user && !profile) {
      console.log('User authenticated but no profile loaded yet, waiting...');
      // Set a timeout to prevent infinite loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Profile loading timed out, redirecting anyway');
        if (user && !redirectedRef.current) {
          redirectedRef.current = true;
          // Redirect to dashboard as fallback
          router.replace('/dashboard');
        }
      }, 8000); // 8 second timeout
    } else if (authLoading) {
      console.log('Auth still loading...');
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      console.log('Sign in successful, waiting for auth state update');
      // Don't redirect manually - let the useEffect handle it when user state updates
    } catch (err: any) {
      console.error('Sign in error:', err);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Wystąpił błąd podczas logowania';
      
      if (err.message) {
        const message = err.message.toLowerCase();
        
        if (message.includes('invalid login credentials') || 
            message.includes('invalid email or password')) {
          errorMessage = 'Nieprawidłowy email lub hasło';
        } else if (message.includes('email not confirmed')) {
          errorMessage = 'Email nie został potwierdzony. Sprawdź swoją skrzynkę pocztową';
        } else if (message.includes('too many requests')) {
          errorMessage = 'Zbyt wiele prób logowania. Spróbuj ponownie za chwilę';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage = 'Problem z połączeniem. Sprawdź połączenie internetowe';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      redirectedRef.current = false; // Reset redirect flag on error
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  // Show loading while auth is initializing or if user is authenticated but we haven't redirected
  if (authLoading || (user && profile && !redirectedRef.current) || (user && !profile)) {
    return (
      <>
        <LoginLoading text={authLoading ? "Inicjalizacja..." : "Ładowanie profilu..."} />
        {user && !profile && (
          <div className="fixed inset-0 flex items-end justify-center pb-20 pointer-events-none">
            <div className="text-sm text-gray-500 bg-white/90 px-4 py-2 rounded-lg">
              Jeśli ładowanie trwa zbyt długo, strona zostanie przekierowana automatycznie
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Header */}
        <div className="flex justify-center items-center mb-8">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="ml-2 text-xl font-semibold text-gray-900">
            Meta Ads Raportowanie
          </h1>
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Zaloguj się</h2>
          <p className="mt-2 text-sm text-gray-600">
            Wprowadź swoje dane logowania
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adres email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  ref={emailInputRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="twoj@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Hasło
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
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
                    Logowanie...
                  </div>
                ) : (
                  'Zaloguj się'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 