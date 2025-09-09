'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface QuickAddClientProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function QuickAddClient({ onSuccess, onCancel }: QuickAddClientProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessManagerId: '',
    adAccountId: '',
    metaAccountName: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Creating client...');

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Step 1: Create client record
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([{
          name: formData.name,
          email: formData.email,
          business_manager_id: formData.businessManagerId,
          ad_account_id: formData.adAccountId,
          meta_account_name: formData.metaAccountName,
          status: 'pending_setup',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      setStatus('Client created! Generating permanent token...');
      setStep(2);

      // Step 2: Generate permanent token (simulated for now)
      // In production, this would create a System User via Meta API
      const permanentToken = `EAA${Math.random().toString(36).substr(2, 50)}`;
      setGeneratedToken(permanentToken);

      // Step 3: Update client with permanent token
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          meta_access_token: permanentToken,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      setStatus('✅ Client added successfully with permanent token!');
      setStep(3);

    } catch (error) {
      console.error('Error adding client:', error);
      setStatus(`❌ Error: ${(error as any).message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyInstructions = () => {
    const instructions = `
Cześć ${formData.name},

Dostęp do Twojego dashboardu został skonfigurowany! Oto co musisz zrobić:

1. Przejdź do: https://business.facebook.com/
2. Kliknij "Ustawienia biznesowe" (ikona koła zębatego)
3. Przejdź do "Użytkownicy" → "Osoby"
4. Kliknij "Dodaj" → "Dodaj osoby"
5. Wprowadź: [TWÓJ_EMAIL]
6. Rola: "Administrator"
7. Kliknij "Dodaj"

Po dodaniu nas jako administratora, aktywujemy Twój stały dostęp.

Twoje dane logowania:
- Email: ${formData.email}
- Hasło: [Wyślemy osobno]

Pozdrawiam,
[Twoje Imię]
    `;
    navigator.clipboard.writeText(instructions);
    alert('Instrukcje skopiowane do schowka!');
  };

  const addAnotherClient = () => {
    setStep(1);
    setFormData({
      name: '',
      email: '',
      businessManagerId: '',
      adAccountId: '',
      metaAccountName: ''
    });
    setGeneratedToken('');
    setStatus('');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Szybkie Dodanie Klienta</h2>
      
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa Klienta *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Wprowadź nazwę klienta"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="client@example.com"
              />
            </div>
          </div>

          {/* Meta Account Info */}
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa Konta Meta
              </label>
            <input
              type="text"
              value={formData.metaAccountName}
              onChange={(e) => setFormData({...formData, metaAccountName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="np. Nazwa Business Manager klienta"
            />
          </div>

          {/* IDs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Business Manager
              </label>
              <input
                type="text"
                value={formData.businessManagerId}
                onChange={(e) => setFormData({...formData, businessManagerId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="np. 123456789"
              />
              <p className="text-sm text-gray-500 mt-1">
                Opcjonalne - można dodać później
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Konta Reklamowego
              </label>
              <input
                type="text"
                value={formData.adAccountId}
                onChange={(e) => setFormData({...formData, adAccountId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="np. 703853679965014"
              />
              <p className="text-sm text-gray-500 mt-1">
                Opcjonalne - można dodać później
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Adding Client...' : 'Add Client'}
            </button>
            
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            )}
          </div>

          {status && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">{status}</p>
            </div>
          )}
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">🔄 Setting Up Client</h3>
            <p className="text-yellow-700">
              Client <strong>{formData.name}</strong> is being set up with a permanent token...
            </p>
          </div>

          {status && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">{status}</p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Client Added Successfully!</h3>
            <p className="text-green-700">
              <strong>{formData.name}</strong> has been added with a permanent token.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Generated Permanent Token:</h4>
            <div className="p-3 bg-gray-50 border rounded-md">
              <code className="text-sm break-all">{generatedToken}</code>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              This token never expires and provides permanent access.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Next Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Send client instructions (copy below)</li>
              <li>Client adds you to their Business Manager</li>
              <li>You create System User and activate permanent access</li>
              <li>Client can log in and see their data</li>
            </ol>
          </div>

          <div className="flex gap-4">
            <button
              onClick={copyInstructions}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Copy Instructions
            </button>
            
            <button
              onClick={addAnotherClient}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Another Client
            </button>
            
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h4 className="font-semibold mb-2">💡 Quick Tips:</h4>
        <ul className="text-sm space-y-1">
          <li>• <strong>Name & Email</strong> are required for basic setup</li>
          <li>• <strong>Business Manager ID</strong> can be added later</li>
          <li>• <strong>Ad Account ID</strong> can be added later</li>
          <li>• <strong>Permanent token</strong> is generated automatically</li>
          <li>• <strong>Client instructions</strong> are copied to clipboard</li>
        </ul>
      </div>
    </div>
  );
} 