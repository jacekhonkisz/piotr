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

      // Fetch Meta tables data first (like GenerateReportModal does)
      console.log('🔍 InteractivePDFButton: Fetching Meta tables data for PDF generation...');
      
      let metaTablesData = null;
      try {
        const metaTablesResponse = await fetch('/api/fetch-meta-tables', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            dateRange: {
              start: dateStart,
              end: dateEnd
            },
            clientId
          })
        });

        if (metaTablesResponse.ok) {
          const metaTablesResult = await metaTablesResponse.json();
          console.log('📊 InteractivePDFButton: Meta tables API response:', metaTablesResult);
          
          if (metaTablesResult.success) {
            metaTablesData = metaTablesResult.data.metaTables;
            console.log('✅ InteractivePDFButton: Meta tables data fetched for PDF:', {
              placementCount: metaTablesData.placementPerformance?.length || 0,
              demographicCount: metaTablesData.demographicPerformance?.length || 0,
              adRelevanceCount: metaTablesData.adRelevanceResults?.length || 0
            });
            
            // Debug demographic data
            if (metaTablesData.demographicPerformance?.length > 0) {
              console.log('🔍 InteractivePDFButton: Sample demographic data:', metaTablesData.demographicPerformance.slice(0, 2));
            } else {
              console.log('⚠️ InteractivePDFButton: No demographic data in Meta tables response');
            }
          } else {
            console.error('❌ InteractivePDFButton: Meta tables API returned success: false', metaTablesResult);
          }
        } else {
          const errorText = await metaTablesResponse.text();
          console.error('❌ InteractivePDFButton: Meta tables API request failed:', metaTablesResponse.status, errorText);
        }
      } catch (metaError) {
        console.error('❌ InteractivePDFButton: Error fetching Meta tables data:', metaError);
      }

      // Use smart caching approach for consistency
      const requestBody = {
        clientId,
        dateRange: {
          start: dateStart,
          end: dateEnd
        }
        // Removed direct data - PDF will use smart caching for consistency
      };

      // Debug: Log the data being sent to PDF generation
      console.log('🔍 InteractivePDFButton: Sending data to PDF generation (FIXED):', {
        includingMetaTablesData: true,
        reason: 'Fetched Meta tables data to ensure demographic charts appear',
        clientId: clientId,
        dateRange: `${dateStart} to ${dateEnd}`,
        dataIncluded: {
          hasCampaigns: !!campaigns?.length,
          hasTotals: !!totals,
          hasClient: !!client,
          hasMetaTables: !!metaTablesData,
          demographicDataCount: metaTablesData?.demographicPerformance?.length || 0
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