'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ManualCollectionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerWeeklyCollection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/manual/collect-client-weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', // Belmonte Hotel
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to collect data');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Manual Data Collection</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Collect Weekly Data for Belmonte Hotel</h2>
        <p className="text-gray-600 mb-4">
          This will collect 53 weeks + current week of data for Belmonte Hotel (both Meta & Google Ads)
        </p>

        <Button
          onClick={triggerWeeklyCollection}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Collecting... (may take 2-3 minutes)' : 'Start Collection'}
        </Button>

        {loading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">⏳ Collection in progress...</p>
            <p className="text-sm text-blue-600 mt-2">
              This may take 2-3 minutes. Please wait...
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-semibold">❌ Error:</p>
            <pre className="text-sm text-red-600 mt-2 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-semibold">✅ Success!</p>
            <pre className="text-sm text-green-600 mt-2 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
            <p className="mt-4 text-sm text-gray-600">
              Now refresh your Reports page to see the updated data!
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

