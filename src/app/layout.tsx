import React from 'react';
import { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { DevExtensionErrorFilter } from '../components/DevExtensionErrorFilter';
import { initializeApp } from '../lib/startup-validation';

// Run startup validation
initializeApp();

export const metadata = {
  title: 'Meta Ads Reporting SaaS',
  description: 'Automated Meta Ads reporting platform for agencies and their clients',
  keywords: ['meta ads', 'facebook ads', 'reporting', 'saas', 'automation'],
  authors: [{ name: 'Your Agency Name' }],
  robots: 'index, follow', // Changed from 'noindex, nofollow'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="h-full" translate="no">
      <body className="h-full bg-gray-50 antialiased" translate="no">
        <AuthProvider>
          <DevExtensionErrorFilter />
          <div id="root" className="min-h-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
} 