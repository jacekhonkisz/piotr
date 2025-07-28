'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Mail } from 'lucide-react';

interface Credentials {
  username: string;
  password: string;
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: Credentials;
  clientName: string;
  clientEmail: string;
}

export default function CredentialsModal({ 
  isOpen, 
  onClose, 
  credentials, 
  clientName, 
  clientEmail 
}: CredentialsModalProps) {
  const [copiedField, setCopiedField] = useState<'username' | 'password' | 'email' | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, field: 'username' | 'password' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const generateEmailTemplate = () => {
    const subject = encodeURIComponent('Your Meta Ads Reporting Account Access');
    const body = encodeURIComponent(`Dear ${clientName},

Your Meta Ads reporting account has been successfully created. Here are your login credentials:

Username: ${credentials.username}
Password: ${credentials.password}

Please save these credentials securely. You can access your reports at: [YOUR_APP_URL]

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
Your Reporting Team`);

    return `mailto:${clientEmail}?subject=${subject}&body=${body}`;
  };

  const copyEmailTemplate = async () => {
    const emailContent = `Dear ${clientName},

Your Meta Ads reporting account has been successfully created. Here are your login credentials:

Username: ${credentials.username}
Password: ${credentials.password}

Please save these credentials securely. You can access your reports at: [YOUR_APP_URL]

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
Your Reporting Team`;

    await copyToClipboard(emailContent, 'email');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client Created Successfully!</h2>
              <p className="text-sm text-gray-600">Account credentials generated</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Credentials:</h3>
            
            {/* Username */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Username
              </label>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md p-3">
                <span className="flex-1 text-sm font-mono text-gray-900">
                  {credentials.username}
                </span>
                <button
                  onClick={() => copyToClipboard(credentials.username, 'username')}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy username"
                >
                  {copiedField === 'username' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Password
              </label>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md p-3">
                <span className="flex-1 text-sm font-mono text-gray-900">
                  {credentials.password}
                </span>
                <button
                  onClick={() => copyToClipboard(credentials.password, 'password')}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy password"
                >
                  {copiedField === 'password' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ Please save these credentials securely.
              </p>
            </div>
          </div>

          {/* Email Actions */}
          <div className="space-y-3">
            <a
              href={generateEmailTemplate()}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email to Client
            </a>
            
            <button
              onClick={copyEmailTemplate}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {copiedField === 'email' ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Email Template Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Email Template
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
} 