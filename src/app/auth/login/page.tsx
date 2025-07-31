'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { signIn } from '../../../lib/auth';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, profile, authLoading } = useAuth();
  const redirectedRef = useRef(false);

  // Handle authentication redirects - prevent multiple redirects
  useEffect(() => {
    console.log('Login page useEffect - authLoading:', authLoading, 'user:', user?.email, 'profile:', profile?.role, 'redirected:', redirectedRef.current);
    
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
    } else if (authLoading) {
      console.log('Auth still loading...');
    }
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
      setError(err.message || 'An error occurred during sign in');
      redirectedRef.current = false; // Reset redirect flag on error
    } finally {
      setLoading(false);
    }
  };

  // Show loading while auth is initializing or if user is authenticated but we haven't redirected
  if (authLoading || (user && profile && !redirectedRef.current)) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center items-center mb-8">
            <BarChart3 className="h-8 w-8 text-primary-600" />
            <h1 className="ml-2 text-xl font-semibold text-gray-900">
              Meta Ads Reporting
            </h1>
          </div>
          <LoadingSpinner text={authLoading ? "Initializing..." : "Redirecting..."} />
        </div>
      </div>
    );
  }

  // If user is authenticated but no profile, show different message
  if (user && !profile && !authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center items-center mb-8">
            <BarChart3 className="h-8 w-8 text-primary-600" />
            <h1 className="ml-2 text-xl font-semibold text-gray-900">
              Meta Ads Reporting
            </h1>
          </div>
          <LoadingSpinner text="Loading profile..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Header */}
        <div className="flex justify-center items-center mb-8">
          <BarChart3 className="h-8 w-8 text-primary-600" />
          <h1 className="ml-2 text-xl font-semibold text-gray-900">
            Meta Ads Reporting
          </h1>
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to your reporting dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card card-body">
          {error && (
            <div className="mb-4 p-4 bg-error-50 border border-error-200 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-error-400" />
                <div className="ml-3">
                  <p className="text-sm text-error-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input pl-10"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-10"
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  New to our platform?
                </span>
              </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6">
            <Link
              href="/auth/register"
              className="btn-secondary w-full text-center"
            >
              Create an account
            </Link>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Demo Credentials</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Admin:</strong> admin@example.com / password123</p>
            <p><strong>Client:</strong> client@example.com / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
} 