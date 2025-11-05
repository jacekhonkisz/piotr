/**
 * PDF GENERATION PROGRESS COMPONENT
 * 
 * Shows real-time progress for PDF generation
 * Displays progress bar, status, and estimated time remaining
 */

import React from 'react';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';

interface PDFGenerationProgressProps {
  clientId: string;
  dateRange: { start: string; end: string };
  onComplete?: (pdfUrl: string) => void;
  onError?: (error: string) => void;
}

export const PDFGenerationProgress: React.FC<PDFGenerationProgressProps> = ({
  clientId,
  dateRange,
  onComplete,
  onError
}) => {
  const {
    generatePDF,
    cancel,
    status,
    progress,
    pdfUrl,
    error,
    estimatedTimeRemaining,
    isGenerating
  } = usePDFGeneration();

  // Handle PDF generation
  const handleGenerate = async () => {
    try {
      const url = await generatePDF(clientId, dateRange);
      if (url && onComplete) {
        onComplete(url);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  // Render status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'processing':
        return '⏳';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '📄';
    }
  };

  // Render status text
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Starting PDF generation...';
      case 'processing':
        return 'Generating PDF...';
      case 'completed':
        return 'PDF ready!';
      case 'failed':
        return 'Generation failed';
      default:
        return 'Ready to generate';
    }
  };

  return (
    <div className="pdf-generation-progress">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <h3 className="text-lg font-semibold">{getStatusText()}</h3>
        </div>
        
        {estimatedTimeRemaining !== null && isGenerating && (
          <span className="text-sm text-gray-600">
            ~{estimatedTimeRemaining}s remaining
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {progress}% complete
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {status === 'idle' && (
          <button
            onClick={handleGenerate}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Generate PDF
          </button>
        )}

        {isGenerating && (
          <button
            onClick={cancel}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Cancel
          </button>
        )}

        {status === 'completed' && pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-center font-medium"
            >
              View PDF
            </a>
            <a
              href={pdfUrl}
              download
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              Download PDF
            </a>
          </>
        )}
      </div>

      {/* Progress Details (Development) */}
      {process.env.NODE_ENV === 'development' && isGenerating && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono">
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
          <div>Time Remaining: {estimatedTimeRemaining}s</div>
        </div>
      )}
    </div>
  );
};

/**
 * USAGE EXAMPLE:
 * 
 * import { PDFGenerationProgress } from '@/components/PDFGenerationProgress';
 * 
 * function MyComponent() {
 *   return (
 *     <PDFGenerationProgress
 *       clientId="123"
 *       dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
 *       onComplete={(url) => console.log('PDF ready:', url)}
 *       onError={(error) => console.error('PDF failed:', error)}
 *     />
 *   );
 * }
 */

