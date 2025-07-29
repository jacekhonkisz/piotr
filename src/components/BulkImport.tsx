'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface BulkImportProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function BulkImport({ onSuccess, onCancel }: BulkImportProps) {
  const [csvData, setCsvData] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [defaultToken, setDefaultToken] = useState('EAAUeX5mK8YoBPKe7fiMsBO6jlOm9QSg4LaUoWNG5RCHLRg42DXgxsf3sHQvbHJgfuvIzy0LISAp2zH8BS77Wc5BQVPJjJ19aiyPPCQpO2TkZBcSNwLB8RTN1wC9xuLl8ETwVWFDnYgmajiCmYFZAJfV3OnpNl8MAGXKIQ9esDH4gKAMmL4NOJZCce46ewZDZD');
  const [defaultAdAccount, setDefaultAdAccount] = useState('703853679965014');

  const parseCSV = (csv: string) => {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    return data;
  };

  const handleCSVChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const csv = e.target.value;
    setCsvData(csv);
    
    if (csv.trim()) {
      try {
        const parsed = parseCSV(csv);
        setPreview(parsed.slice(0, 5)); // Show first 5 rows
      } catch (error) {
        setPreview([]);
      }
    } else {
      setPreview([]);
    }
  };

  const handleImport = async () => {
    if (!csvData.trim()) {
      alert('Please enter CSV data');
      return;
    }

    setLoading(true);
    try {
      const clients = parseCSV(csvData);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const clientsToInsert = clients.map(client => ({
        name: client.name || client.Name || client.NAME,
        email: client.email || client.Email || client.EMAIL,
        meta_access_token: client.meta_access_token || client.token || defaultToken,
        ad_account_id: client.ad_account_id || client.adAccountId || defaultAdAccount,
        role: client.role || 'client',
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('clients')
        .insert(clientsToInsert);

      if (error) throw error;

      alert(`✅ Successfully imported ${clients.length} clients!`);
      onSuccess?.();
    } catch (error) {
      console.error('Error importing clients:', error);
      alert('Error importing clients: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,email,meta_access_token,ad_account_id,role
John Doe,john@example.com,EAA...,703853679965014,client
Jane Smith,jane@example.com,EAA...,703853679965014,client`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Bulk Import Clients</h2>
      
      <div className="space-y-6">
        {/* Default Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Meta API Token
            </label>
            <input
              type="password"
              value={defaultToken}
              onChange={(e) => setDefaultToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="EAA..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Ad Account ID
            </label>
            <input
              type="text"
              value={defaultAdAccount}
              onChange={(e) => setDefaultAdAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="703853679965014"
            />
          </div>
        </div>

        {/* CSV Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              CSV Data
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              Download Template
            </button>
          </div>
          
          <textarea
            value={csvData}
            onChange={handleCSVChange}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="name,email,meta_access_token,ad_account_id,role&#10;John Doe,john@example.com,EAA...,703853679965014,client&#10;Jane Smith,jane@example.com,EAA...,703853679965014,client"
          />
          
          <p className="text-sm text-gray-500 mt-1">
            CSV should have columns: name, email, meta_access_token (optional), ad_account_id (optional), role (optional)
          </p>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Preview (First 5 rows)</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Email</th>
                    <th className="text-left py-2">Token</th>
                    <th className="text-left py-2">Ad Account</th>
                    <th className="text-left py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{row.name || row.Name || row.NAME}</td>
                      <td className="py-2">{row.email || row.Email || row.EMAIL}</td>
                      <td className="py-2">
                        {(row.meta_access_token || row.token || defaultToken).substring(0, 10)}...
                      </td>
                      <td className="py-2">{row.ad_account_id || row.adAccountId || defaultAdAccount}</td>
                      <td className="py-2">{row.role || 'client'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleImport}
            disabled={loading || !csvData.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Importing...' : `Import ${preview.length} Clients`}
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 