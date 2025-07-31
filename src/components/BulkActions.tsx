'use client';

import React, { useState } from 'react';
import { 
  Trash2, 
  Mail, 
  RefreshCw, 
  FileText, 
  UserPlus, 
  CheckSquare, 
  Square,
  AlertTriangle,
  X
} from 'lucide-react';

interface BulkActionsProps {
  selectedClients: string[];
  totalClients: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkRegenerateCredentials: () => void;
  onBulkGenerateReports: () => void;
  onBulkChangeFrequency: (frequency: string) => void;
  isProcessing: boolean;
}

export default function BulkActions({
  selectedClients,
  totalClients,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  onBulkRegenerateCredentials,
  onBulkGenerateReports,
  onBulkChangeFrequency,
  isProcessing
}: BulkActionsProps) {
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAllSelected = selectedClients.length === totalClients && totalClients > 0;
  const isPartiallySelected = selectedClients.length > 0 && selectedClients.length < totalClients;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
  };

  const handleBulkDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    onBulkDelete();
    setShowDeleteConfirm(false);
  };

  if (selectedClients.length === 0) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={handleSelectAll}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {totalClients} clients
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <CheckSquare className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onBulkGenerateReports}
                disabled={isProcessing}
                className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <FileText className="h-3 w-3 mr-1" />
                Generate Reports
              </button>
              

              
              <button
                onClick={onBulkRegenerateCredentials}
                disabled={isProcessing}
                className="flex items-center px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Regenerate Credentials
              </button>
              
              <button
                onClick={() => setShowFrequencyModal(true)}
                disabled={isProcessing}
                className="flex items-center px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Change Frequency
              </button>
              
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex items-center px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onClearSelection}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      {/* Frequency Change Modal */}
      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Change Reporting Frequency</h3>
              <button onClick={() => setShowFrequencyModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Change reporting frequency for {selectedClients.length} selected client{selectedClients.length !== 1 ? 's' : ''}.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  onBulkChangeFrequency('monthly');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <div className="font-medium">Monthly</div>
                <div className="text-sm text-gray-500">Reports sent once per month</div>
              </button>
              
              <button
                onClick={() => {
                  onBulkChangeFrequency('weekly');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <div className="font-medium">Weekly</div>
                <div className="text-sm text-gray-500">Reports sent once per week</div>
              </button>
              
              <button
                onClick={() => {
                  onBulkChangeFrequency('on_demand');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <div className="font-medium">On Demand</div>
                <div className="text-sm text-gray-500">Reports generated manually only</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-red-900">Confirm Bulk Delete</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}? 
              This action cannot be undone and will also delete their user accounts from Supabase.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete {selectedClients.length} Client{selectedClients.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 