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
  X,
  Calendar,
  Clock
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
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={handleSelectAll}
              className="group flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <div className="mr-3 p-1 rounded-md group-hover:bg-gray-100 transition-colors duration-200">
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                )}
              </div>
              <span className="font-medium">
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </span>
            </button>
          </div>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {totalClients} client{totalClients !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <CheckSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <span className="text-sm font-semibold text-blue-900">
                  {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected
                </span>
                <div className="text-xs text-blue-600">
                  {isPartiallySelected ? 'Partially selected' : 'All clients selected'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onBulkGenerateReports}
                disabled={isProcessing}
                className="group relative px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Generate Reports</span>
                </div>
              </button>
              
              <button
                onClick={onBulkRegenerateCredentials}
                disabled={isProcessing}
                className="group relative px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <div className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Regenerate Credentials</span>
                </div>
              </button>
              
              <button
                onClick={() => setShowFrequencyModal(true)}
                disabled={isProcessing}
                className="group relative px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Change Frequency</span>
                </div>
              </button>
              
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="group relative px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <div className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Delete</span>
                </div>
              </button>
            </div>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={onClearSelection}
              className="group relative px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center">
                <X className="h-4 w-4 mr-2 text-gray-500 group-hover:text-gray-700 transition-colors" />
                <span className="text-sm font-medium">Clear Selection</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Frequency Change Modal */}
      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Change Reporting Frequency</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Update frequency for {selectedClients.length} selected client{selectedClients.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button 
                onClick={() => setShowFrequencyModal(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  onBulkChangeFrequency('monthly');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-blue-700">Monthly</div>
                    <div className="text-sm text-gray-500 mt-1">Reports sent once per month</div>
                  </div>
                  <Calendar className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
                </div>
              </button>
              
              <button
                onClick={() => {
                  onBulkChangeFrequency('weekly');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-green-700">Weekly</div>
                    <div className="text-sm text-gray-500 mt-1">Reports sent once per week</div>
                  </div>
                  <Clock className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
                </div>
              </button>
              
              <button
                onClick={() => {
                  onBulkChangeFrequency('on_demand');
                  setShowFrequencyModal(false);
                }}
                className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-orange-700">On Demand</div>
                    <div className="text-sm text-gray-500 mt-1">Reports generated manually only</div>
                  </div>
                  <FileText className="h-5 w-5 text-gray-400 group-hover:text-orange-600" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex items-center mb-6">
              <div className="bg-red-100 p-3 rounded-xl mr-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-900">Confirm Bulk Delete</h3>
                <p className="text-sm text-red-600 mt-1">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-800">
                Are you sure you want to delete <strong>{selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}</strong>? 
                This will also delete their user accounts from Supabase.
              </p>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
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