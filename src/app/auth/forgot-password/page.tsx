import React from 'react';
import Link from 'next/link';
import { BarChart3, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
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
            Reset your password
          </h2>
          <p className="text-gray-600">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card card-body">
          <form className="space-y-6" action="#" method="POST">
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
                  className="form-input pl-10"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Send Reset Link Button */}
            <div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Send reset link
              </button>
            </div>
          </form>

          {/* Back to Login */}
          <div className="mt-6">
            <Link
              href="/auth/login"
              className="btn-secondary w-full flex items-center justify-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>

        {/* Footer Text */}
        <p className="mt-8 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-primary-600 hover:text-primary-500 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
} 