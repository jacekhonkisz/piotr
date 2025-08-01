'use client';

import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InteractivePDFButtonProps {
  clientId: string;
  dateStart: string;
  dateEnd: string;
  className?: string;
}

const InteractivePDFButton: React.FC<InteractivePDFButtonProps> = ({
  clientId,
  dateStart,
  dateEnd,
  className = ''
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

      const response = await fetch('/api/generate-interactive-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange: {
            start: dateStart,
            end: dateEnd
          }
        })
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
      link.download = `interactive-meta-ads-report-${dateStart}-${dateEnd}.pdf`;
      
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
    <div className={`${className}`}>
      <button
        onClick={generateInteractivePDF}
        disabled={isGenerating}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm
          ${isGenerating 
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105'
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
            <span>Generuj PDF</span>
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          <p className="font-medium">Error generating PDF:</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded-lg border border-blue-200">
        <p className="font-medium">✨ Interactive PDF with tab switching</p>
      </div>
    </div>
  );
};

export default InteractivePDFButton; 