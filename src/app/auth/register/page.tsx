import React from 'react';
import Link from 'next/link';
import { BarChart3, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Header */}
        <div className="flex justify-center items-center mb-8">
          <BarChart3 className="h-8 w-8 text-primary-600" />
          <h1 className="ml-2 text-xl font-semibold text-gray-900">
            Meta Ads Raportowanie
          </h1>
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Utwórz swoje konto
          </h2>
          <p className="text-gray-600">
            Rozpocznij automatyzację raportowania Meta Ads już dziś
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card card-body">
          <form className="space-y-6" action="#" method="POST">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="form-label">
                Pełne imię i nazwisko
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="form-input pl-10"
                  placeholder="Wprowadź swoje pełne imię i nazwisko"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="form-label">
                Adres e-mail
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
                  placeholder="Wprowadź swój e-mail"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                Hasło
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="form-input pl-10"
                  placeholder="Utwórz hasło"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirm-password" className="form-label">
                Potwierdź hasło
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="form-input pl-10"
                  placeholder="Potwierdź swoje hasło"
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-600">
                Zgadzam się z{' '}
                <Link href="/legal/terms" className="text-primary-600 hover:text-primary-500 font-medium">
                  Regulaminem
                </Link>{' '}
                i{' '}
                <Link href="/legal/privacy" className="text-primary-600 hover:text-primary-500 font-medium">
                  Polityką Prywatności
                </Link>
              </label>
            </div>

            {/* Create Account Button */}
            <div>
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center group"
              >
                Utwórz konto
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
                  Masz już konto?
                </span>
              </div>
            </div>
          </div>

          {/* Sign In Link */}
          <div className="mt-6">
            <Link
              href="/auth/login"
              className="btn-secondary w-full text-center"
            >
              Zaloguj się zamiast tego
            </Link>
          </div>
        </div>

        {/* Footer Text */}
        <p className="mt-8 text-center text-sm text-gray-600">
          Dołącz do agencji, które już oszczędzają godziny dzięki zautomatyzowanemu raportowaniu
        </p>
      </div>
    </div>
  );
} 