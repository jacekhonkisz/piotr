'use client';

import { useState } from 'react';
import { X, Send, Eye, FileText } from 'lucide-react';
import EmailPreviewModal from './EmailPreviewModal';

interface SendCustomReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientEmail: string;
  period: string;
  campaigns?: any[];
  totals?: any;
  client?: any;
  metaTables?: any;
  dateRange: { start: string; end: string };
}

export default function SendCustomReportModal({
  isOpen,
  onClose,
  clientName,
  clientEmail,
  period,
  campaigns,
  totals,
  client,
  metaTables,
  dateRange
}: SendCustomReportModalProps) {
  const [customMessage, setCustomMessage] = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Default Polish email template
  const defaultPolishTemplate = `Dzień dobry,

Przesyłamy raport wyników kampanii Meta Ads za okres ${period}.

W załączeniu znajdziecie Państwo szczegółowy raport z wynikami oraz analizą kampanii reklamowych.

W razie pytań lub potrzeby omówienia strategii optymalizacji, jesteśmy do dyspozycji.

Pozdrawiamy,
Zespół Meta Ads`;

  const [emailTemplate, setEmailTemplate] = useState(defaultPolishTemplate);

  const handleSend = async () => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/send-custom-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client?.id,
          dateRange,
          customMessage: emailTemplate, // Use the editable template
          includePdf,
          campaigns: campaigns || [],
          totals,
          client,
          metaTables
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setStatus('success');
        setSuccessMessage(`Email wysłany pomyślnie do ${clientEmail}`);
        
        // Reset form after successful send
        setTimeout(() => {
          onClose();
          setStatus('idle');
          setSuccessMessage('');
          setEmailTemplate(defaultPolishTemplate);
          setCustomMessage('');
        }, 2000);
      } else {
        const error = await response.json();
        setStatus('error');
        setErrorMessage(error.error || 'Błąd podczas wysyłania email');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Błąd sieci. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetTemplate = () => {
    setEmailTemplate(defaultPolishTemplate);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Wyślij Raport Email
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Email Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Klient:</span>
                  <span className="ml-2 text-gray-900">{clientName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <span className="ml-2 text-gray-900">{clientEmail}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Okres:</span>
                  <span className="ml-2 text-gray-900">{period}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Załącznik PDF:</span>
                  <span className="ml-2 text-gray-900">{includePdf ? 'Tak' : 'Nie'}</span>
                </div>
              </div>
            </div>

            {/* Editable Email Template */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Treść Email (w języku polskim)
                </label>
                <button
                  onClick={resetTemplate}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Przywróć domyślną treść
                </button>
              </div>
              <textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Wprowadź treść email w języku polskim..."
              />
              <p className="mt-2 text-sm text-gray-600">
                💡 Podsumowanie kampanii zostanie automatycznie dodane z wygenerowanego raportu PDF
              </p>
            </div>

            {/* PDF Attachment Option */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includePdf}
                  onChange={(e) => setIncludePdf(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Dołącz raport PDF jako załącznik</span>
              </label>
            </div>

            {/* Status Messages */}
            {status === 'success' && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                ✅ {successMessage}
              </div>
            )}

            {status === 'error' && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                ❌ {errorMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isLoading}
              >
                <Eye className="w-4 h-4" />
                Podgląd
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  disabled={isLoading}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSend}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Wyślij Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showPreview && (
        <EmailPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          clientId={client?.id || ''}
          clientName={clientName}
          dateRange={dateRange}
          customMessage={emailTemplate}
          campaigns={campaigns || []}
          totals={totals}
          client={client}
          metaTables={metaTables}
        />
      )}
    </>
  );
} 