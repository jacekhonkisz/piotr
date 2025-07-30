'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';

interface SearchFiltersProps {
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onFrequencyFilterChange: (frequency: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  currentSearch: string;
  currentStatusFilter: string;
  currentFrequencyFilter: string;
  currentSortBy: string;
  currentSortOrder: 'asc' | 'desc';
}

export default function SearchFilters({
  onSearchChange,
  onStatusFilterChange,
  onFrequencyFilterChange,
  onSortChange,
  currentSearch,
  currentStatusFilter,
  currentFrequencyFilter,
  currentSortBy,
  currentSortOrder
}: SearchFiltersProps) {
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, onSearchChange]);

  const clearAllFilters = () => {
    setSearchValue('');
    onSearchChange('');
    onStatusFilterChange('');
    onFrequencyFilterChange('');
    onSortChange('name', 'asc');
  };

  const hasActiveFilters = currentSearch || currentStatusFilter || currentFrequencyFilter || currentSortBy !== 'name' || currentSortOrder !== 'asc';

  const getSortIcon = (field: string) => {
    if (currentSortBy !== field) {
      return <ChevronDown className="h-4 w-4 text-gray-400" />;
    }
    return currentSortOrder === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-blue-600" /> : 
      <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Search Bar */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients by name, email, or company..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
            showFilters 
              ? 'bg-primary-50 border-primary-200 text-primary-700' 
              : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Status
              </label>
              <select
                value={currentStatusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="valid">Valid</option>
                <option value="invalid">Invalid/Expired</option>
                <option value="pending">Pending</option>
                <option value="expiring_soon">Expiring Soon</option>
              </select>
            </div>

            {/* Frequency Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reporting Frequency
              </label>
              <select
                value={currentFrequencyFilter}
                onChange={(e) => onFrequencyFilterChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Frequencies</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="on_demand">On Demand</option>
              </select>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <div className="flex space-x-2">
                <select
                  value={currentSortBy}
                  onChange={(e) => onSortChange(e.target.value, currentSortOrder)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="api_status">API Status</option>
                  <option value="last_report_date">Last Report</option>
                  <option value="created_at">Created Date</option>
                </select>
                <button
                  onClick={() => onSortChange(currentSortBy, currentSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {currentSortOrder === 'asc' ? 
                    <ChevronUp className="h-4 w-4" /> : 
                    <ChevronDown className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(currentStatusFilter || currentFrequencyFilter) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {currentStatusFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Status: {currentStatusFilter}
                  <button
                    onClick={() => onStatusFilterChange('')}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {currentFrequencyFilter && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Frequency: {currentFrequencyFilter}
                  <button
                    onClick={() => onFrequencyFilterChange('')}
                    className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 