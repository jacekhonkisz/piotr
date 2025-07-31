'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  X,
  FileText,
  Loader2
} from 'lucide-react';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportName?: string;
  clientName?: string;
}

export default function PDFViewer({ 
  isOpen, 
  onClose, 
  reportId, 
  reportName = 'Report',
  clientName = 'Client'
}: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showToolbar, setShowToolbar] = useState(true);

  useEffect(() => {
    if (isOpen && reportId) {
      loadPDF();
    }
  }, [isOpen, reportId]);

  const loadPDF = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get the current session token
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the updated download-pdf endpoint that now generates PDFs
      const response = await fetch(`/api/download-pdf?reportId=${reportId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load PDF (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;
    
    try {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${clientName}_${reportName}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setZoom(100);
    setRotation(0);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-full max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-gray-600 mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{reportName}</h2>
              <p className="text-sm text-gray-500">{clientName}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowToolbar(!showToolbar)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title={showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
            >
              {showToolbar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {showToolbar && (
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-[60px] text-center">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                title="Rotate"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              {rotation}° rotation
            </div>
          </div>
        )}

        {/* PDF Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load PDF</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {pdfUrl && !loading && !error && (
            <div className="h-full overflow-auto bg-gray-100 p-4">
              <div 
                className="bg-white shadow-lg mx-auto"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease-in-out'
                }}
              >
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ 
                    height: `${800 * (zoom / 100)}px`,
                    border: 'none'
                  }}
                  title={`PDF Viewer - ${reportName}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 