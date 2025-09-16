'use client';

import React from 'react';
import { X, Eye, FileText } from 'lucide-react';

interface StaticEmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: {
    subject: string;
    text: string;
    html: string;
    summary: string;
  } | null;
  clientName: string;
}

// SOLUTION: Pure display component with NO useEffect triggers
const StaticEmailPreviewModal = React.memo(function StaticEmailPreviewModal({
  isOpen,
  onClose,
  previewData,
  clientName
}: StaticEmailPreviewModalProps) {
  if (!isOpen || !previewData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Podgląd Email - {clientName}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temat
              </label>
              <div className="p-3 bg-gray-50 rounded-md border">
                {previewData.subject}
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Podsumowanie AI
              </label>
              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                {previewData.summary}
              </div>
            </div>

            {/* Email Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Treść Email
              </label>
              <div className="p-4 bg-gray-50 rounded-md border max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800">
                  {previewData.text}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors"
            >
              Zamknij Podgląd
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StaticEmailPreviewModal;
