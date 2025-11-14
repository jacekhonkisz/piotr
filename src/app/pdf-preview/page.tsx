'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PDFPreviewPage() {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Get params from URL or use defaults
  const clientId = searchParams.get('clientId') || 'e7bfc2c2-f0e6-4b45-af79-73fd9e33bb75'; // Belmonte Hotel
  const dateStart = searchParams.get('dateStart') || '2025-11-01';
  const dateEnd = searchParams.get('dateEnd') || '2025-11-30';

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🎨 Fetching PDF preview...');

        // Call the PDF generation API in preview mode
        // Uses service role key from environment for auth
        const response = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Preview-Mode': 'true', // Signal we want HTML, not PDF
          },
          body: JSON.stringify({
            clientId,
            dateRange: {
              start: dateStart,
              end: dateEnd,
            },
          }),
        });

        console.log('📊 Response status:', response.status);
        console.log('📊 Response content-type:', response.headers.get('content-type'));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('API Error Details:', errorData);
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        // Check if we got HTML back
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          const html = await response.text();
          console.log('✅ Received HTML, length:', html.length);
          setHtmlContent(html);
        } else {
          throw new Error('Expected HTML but got: ' + contentType);
        }

      } catch (err) {
        console.error('❌ Preview error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [clientId, dateStart, dateEnd]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating PDF preview...</p>
          <p className="text-xs text-gray-400 mt-2">Using real PDF generation code</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl mb-2">⚠️ Error</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
          <div className="mt-4 text-xs text-gray-500">
            <p>Troubleshooting:</p>
            <ul className="text-left mt-2 space-y-1">
              <li>• Make sure you're logged in</li>
              <li>• Check client ID is valid</li>
              <li>• Verify date range is correct</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Control Bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">📄 PDF Design Preview</h1>
            <span className="text-sm text-gray-500 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200">
              ✓ Live from /api/generate-pdf
            </span>
            <span className="text-xs text-gray-400">
              {dateStart} → {dateEnd}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              🔄 Refresh
            </button>
            <a
              href="/reports"
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              ← Back to Reports
            </a>
          </div>
        </div>
      </div>

      {/* PDF Content Preview */}
      <div className="max-w-[210mm] mx-auto my-8 bg-white shadow-2xl">
        <div
          className="pdf-preview-content"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{
            background: 'white',
            minHeight: '297mm',
          }}
        />
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
        <p className="font-medium text-green-600 mb-2">
          ✨ This preview uses the EXACT same HTML generation code as "Pobierz PDF"
        </p>
        <p>Make changes to <code className="bg-gray-100 px-2 py-0.5 rounded">/src/app/api/generate-pdf/route.ts</code> and refresh this page to see them instantly</p>
        <p className="mt-2 text-xs text-gray-400">
          Client: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{clientId}</code>
        </p>
      </div>
    </div>
  );
}
