'use client';

import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InteractivePDFButtonProps {
  clientId: string;
  dateStart: string;
  dateEnd: string;
  className?: string;
  campaigns?: any[];
  totals?: any;
  client?: any;
  metaTables?: {
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  } | null;
}

const InteractivePDFButton: React.FC<InteractivePDFButtonProps> = ({
  clientId,
  dateStart,
  dateEnd,
  className = '',
  campaigns,
  totals,
  client,
  metaTables
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInteractivePDF = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Get the current session token (more robust approach)
      const sessionData = await supabase.auth.getSession();
      const accessToken = sessionData.data.session?.access_token;
      if (!accessToken) {
        throw new Error('No authentication token available');
      }

      // PRODUCTION FIX: Always use API fallback path to ensure Google Ads data is included
      // This forces the backend to fetch both Meta and Google Ads data fresh
      const requestBody = {
        clientId,
        dateRange: {
          start: dateStart,
          end: dateEnd
        }
        // Removed: campaigns, totals, client, metaTables to force API fallback path
        // This ensures both Meta and Google Ads data are always included
      };

      // Debug: Log the data being sent to PDF generation
      console.log('🔍 InteractivePDFButton: Sending data to PDF generation (PRODUCTION FIX):', {
        forcingAPIFallback: true,
        reason: 'Ensures both Meta and Google Ads data are included',
        clientId: clientId,
        dateRange: `${dateStart} to ${dateEnd}`,
        availableDataNotUsed: {
          hasCampaigns: !!campaigns?.length,
          hasTotals: !!totals,
          hasClient: !!client,
          hasMetaTables: !!metaTables
        }
      });

      // Debug: Check session and auth token
      console.log('🔐 InteractivePDFButton: Auth debug:', {
        hasSession: !!sessionData.data.session,
        sessionKeys: sessionData.data.session ? Object.keys(sessionData.data.session) : 'no session',
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        accessTokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'no token'
      });

      // Use main PDF generation that now includes both Meta and Google Ads
      console.log('📡 InteractivePDFButton: Making request to /api/generate-pdf');
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 InteractivePDFButton: Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ InteractivePDFButton: Request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ InteractivePDFButton: Request successful, processing PDF blob...');

      // Get the PDF blob
      const pdfBlob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `raport-reklamowy-${dateStart}-${dateEnd}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error generating interactive PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate interactive PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        onClick={generateInteractivePDF}
        disabled={isGenerating}
        className={`
          flex items-center space-x-2 transition-all duration-200
          ${isGenerating 
            ? 'bg-gray-400 text-white cursor-not-allowed opacity-75' 
            : className || 'px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-medium shadow-sm'
          }
        `}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generowanie PDF...</span>
          </>
        ) : (
          <>
            <FileText className="h-5 w-5" />
            <span>Pobierz PDF (Meta + Google)</span>
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          <p className="font-medium">Error generating PDF:</p>
          <p>{error}</p>
        </div>
      )}
    </>
  );
};

export default InteractivePDFButton; 