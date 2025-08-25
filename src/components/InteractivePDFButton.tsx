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

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      // If we have the data already, use it directly for faster generation
      const requestBody = campaigns && totals && client ? {
        clientId,
        dateRange: {
          start: dateStart,
          end: dateEnd
        },
        // Pass the data directly to avoid API calls
        campaigns,
        totals,
        client,
        metaTables // Add metaTables data for faster generation
      } : {
        clientId,
        dateRange: {
          start: dateStart,
          end: dateEnd
        }
      };

      // Debug: Log the data being sent to PDF generation
      console.log('🔍 InteractivePDFButton: Sending data to PDF generation:', {
        hasDirectData: !!(campaigns && totals && client),
        hasCampaigns: !!campaigns?.length,
        hasTotals: !!totals,
        hasClient: !!client,
        hasMetaTables: !!metaTables,
        metaTablesStructure: metaTables ? {
          hasPlacementPerformance: !!metaTables.placementPerformance?.length,
          hasDemographicPerformance: !!metaTables.demographicPerformance?.length,
          hasAdRelevanceResults: !!metaTables.adRelevanceResults?.length,
          demographicCount: metaTables.demographicPerformance?.length || 0,
          demographicSample: metaTables.demographicPerformance?.slice(0, 2)
        } : null
      });

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `raport-meta-ads-${dateStart}-${dateEnd}.pdf`;
      
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
            <span>Pobierz PDF</span>
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