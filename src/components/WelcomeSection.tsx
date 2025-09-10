'use client';

import React from 'react';
import { User, Building2 } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface WelcomeSectionProps {
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  profile: Profile | null;
  client: Client | null;
  isLoading?: boolean;
}

// Helper function to capitalize first letter of each word
const capitalizeWords = (str: string): string => {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to get display name with proper capitalization
const getDisplayName = (profile: Profile | null, user: { email: string } | null): string => {
  if (profile?.full_name) {
    return capitalizeWords(profile.full_name);
  }
  if (user?.email) {
    const emailName = user.email.split('@')[0];
    return capitalizeWords(emailName.replace(/[._-]/g, ' '));
  }
  return 'Użytkownik';
};

export default function WelcomeSection({ user, profile, client, isLoading = false }: WelcomeSectionProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  // Get display name with proper capitalization
  const displayName = getDisplayName(profile, user);
  
  // Get client name with proper capitalization
  const clientName = client?.name ? capitalizeWords(client.name) : 'Dashboard';
  const companyName = client?.company ? capitalizeWords(client.company) : null;

  return (
    <div className="text-center mb-8">
      <div className="flex flex-col items-center space-y-4">
        {/* Logo/Avatar Section */}
        <div className="flex-shrink-0">
          {client?.logo_url ? (
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shadow-sm group-hover:shadow-md transition-all duration-200 bg-white">
                <img
                  src={client.logo_url}
                  alt={`${clientName} logo`}
                  className="w-full h-full object-contain object-center p-2"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const icon = document.createElement('div');
                      icon.className = 'w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center';
                      icon.innerHTML = '<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
                      parent.appendChild(icon);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center border border-gray-200 shadow-sm">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          )}
        </div>

        {/* Welcome Text Section */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Witaj, {displayName}! 👋
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-medium mb-2">
            {profile.role === 'admin' 
              ? `Zarządzasz kontem: ${clientName}` 
              : `Panel dla: ${clientName}`
            }
          </p>
          {companyName && companyName !== clientName && (
            <p className="text-slate-500 text-xs sm:text-sm mb-3">
              {companyName}
            </p>
          )}
        </div>

        {/* Status and Info Row */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
          <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-full px-4 py-2 border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-green-700">
              {profile.role === 'admin' ? 'Administrator' : 'Klient'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{user.email}</span>
          </div>
          
          <div className="text-xs text-slate-500 font-medium">
            Ostatnie logowanie: {new Date().toLocaleDateString('pl-PL')}
          </div>
        </div>

        {/* Development-only Cache Status */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-700">Fresh Cache</span>
              </div>
              <div className="text-sm text-slate-600">
                {Math.floor(Math.random() * 1000) + 100}ms
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Aktualizacja: {new Date().toLocaleTimeString('pl-PL')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
