/**
 * React Hook for Async PDF Generation with Progress Tracking
 * 
 * Usage:
 * const { generatePDF, progress, status, pdfUrl, error } = usePDFGeneration();
 * 
 * generatePDF(clientId, dateRange).then(url => {
 *   console.log('PDF ready:', url);
 * });
 */

import { useState, useCallback, useRef } from 'react';

interface PDFGenerationState {
  jobId: string | null;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  pdfUrl: string | null;
  error: string | null;
  estimatedTimeRemaining: number | null;
}

interface UsePDFGenerationReturn {
  generatePDF: (clientId: string, dateRange: { start: string; end: string }) => Promise<string | null>;
  cancel: () => void;
  reset: () => void;
  jobId: string | null;
  status: PDFGenerationState['status'];
  progress: number;
  pdfUrl: string | null;
  error: string | null;
  estimatedTimeRemaining: number | null;
  isGenerating: boolean;
}

export function usePDFGeneration(): UsePDFGenerationReturn {
  const [state, setState] = useState<PDFGenerationState>({
    jobId: null,
    status: 'idle',
    progress: 0,
    pdfUrl: null,
    error: null,
    estimatedTimeRemaining: null
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  /**
   * Clear polling interval
   */
  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Poll for job status
   */
  const pollJobStatus = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/pdf-status/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();

      // Update state
      setState(prev => ({
        ...prev,
        status: data.status,
        progress: data.progress,
        pdfUrl: data.pdfUrl,
        error: data.error,
        estimatedTimeRemaining: data.estimatedTimeRemaining
      }));

      // Stop polling if completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        clearPolling();
      }

    } catch (error) {
      console.error('Error polling PDF status:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      clearPolling();
    }
  }, [clearPolling]);

  /**
   * Start PDF generation
   */
  const generatePDF = useCallback(async (
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<string | null> => {
    // Reset state
    isCancelledRef.current = false;
    clearPolling();

    setState({
      jobId: null,
      status: 'pending',
      progress: 0,
      pdfUrl: null,
      error: null,
      estimatedTimeRemaining: 30
    });

    try {
      // Start async PDF generation
      const response = await fetch('/api/generate-pdf-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, dateRange })
      });

      if (!response.ok) {
        throw new Error(`Failed to start PDF generation: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to start PDF generation');
      }

      const jobId = data.jobId;

      setState(prev => ({
        ...prev,
        jobId,
        status: 'processing',
        estimatedTimeRemaining: data.estimatedTime || 30
      }));

      // Start polling for status (every 1 second)
      pollIntervalRef.current = setInterval(() => {
        if (!isCancelledRef.current) {
          pollJobStatus(jobId);
        }
      }, 1000);

      // Wait for completion
      return new Promise((resolve, reject) => {
        const checkCompletion = setInterval(() => {
          if (isCancelledRef.current) {
            clearInterval(checkCompletion);
            clearPolling();
            reject(new Error('PDF generation cancelled'));
            return;
          }

          // Check current state
          setState(currentState => {
            if (currentState.status === 'completed' && currentState.pdfUrl) {
              clearInterval(checkCompletion);
              clearPolling();
              resolve(currentState.pdfUrl);
            } else if (currentState.status === 'failed') {
              clearInterval(checkCompletion);
              clearPolling();
              reject(new Error(currentState.error || 'PDF generation failed'));
            }
            return currentState;
          });
        }, 100);
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));

      clearPolling();
      return null;
    }
  }, [clearPolling, pollJobStatus]);

  /**
   * Cancel PDF generation
   */
  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    clearPolling();
    
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: 0,
      error: 'Cancelled by user'
    }));
  }, [clearPolling]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    clearPolling();
    isCancelledRef.current = false;
    
    setState({
      jobId: null,
      status: 'idle',
      progress: 0,
      pdfUrl: null,
      error: null,
      estimatedTimeRemaining: null
    });
  }, [clearPolling]);

  return {
    generatePDF,
    cancel,
    reset,
    jobId: state.jobId,
    status: state.status,
    progress: state.progress,
    pdfUrl: state.pdfUrl,
    error: state.error,
    estimatedTimeRemaining: state.estimatedTimeRemaining,
    isGenerating: state.status === 'pending' || state.status === 'processing'
  };
}

