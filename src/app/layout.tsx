import React from 'react';
import { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { DevExtensionErrorFilter } from '../components/DevExtensionErrorFilter';
import { initializeApp } from '../lib/startup-validation';

// Run startup validation
initializeApp();

export const metadata: Metadata = {
  title: 'Piotr Bajerlein Marketing — Raporty',
  description: 'Automatyczne raportowanie Meta Ads i Google Ads dla klientów agencji',
  keywords: ['meta ads', 'facebook ads', 'google ads', 'reporting', 'piotr bajerlein'],
  authors: [{ name: 'Piotr Bajerlein Marketing' }],
  robots: 'index, follow',
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