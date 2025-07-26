import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meta Ads Reporting SaaS',
  description: 'Automated Meta Ads reporting platform for agencies and their clients',
  keywords: ['meta ads', 'facebook ads', 'reporting', 'saas', 'automation'],
  authors: [{ name: 'Your Agency Name' }],
  robots: 'noindex, nofollow', // Remove in production
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <AuthProvider>
          <div id="root" className="min-h-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
} 