'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Enhanced Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Szukaj klientów po nazwie, e-mailu lub firmie..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            autoComplete="off"
            className="w-full pl-14 pr-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/90 shadow-sm hover:shadow-md transition-all duration-200 text-lg"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`group relative px-6 py-4 rounded-2xl border transition-all duration-200 flex items-center space-x-3 ${
            showFilters 
              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-md' 
              : 'bg-white/90 border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
          }`}
        >
          <SlidersHorizontal className={`h-5 w-5 transition-colors ${
            showFilters ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
          }`} />
          <span className="font-medium text-lg">Filtry</span>
          {hasActiveFilters && (
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="group relative px-5 py-4 text-lg text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-2xl transition-all duration-200 flex items-center space-x-3 border border-gray-200 hover:border-gray-300"
          >
            <X className="h-5 w-5" />
            <span className="font-medium">Wyczyść wszystko</span>
          </button>
        )}
      </div>

      {/* Enhanced Filters Panel */}
      {showFilters && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200/50 rounded-2xl p-8 space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Status Filter */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Status API
              </label>
              <select
                value={currentStatusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-200 text-lg"
              >
                <option value="">Wszystkie statusy</option>
                <option value="valid">Prawidłowy</option>
                <option value="invalid">Nieprawidłowy/Wygasły</option>
                <option value="pending">Oczekujący</option>
                <option value="expiring_soon">Wygasa wkrótce</option>
              </select>
            </div>

            {/* Frequency Filter */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Częstotliwość raportowania
              </label>
              <select
                value={currentFrequencyFilter}
                onChange={(e) => onFrequencyFilterChange(e.target.value)}
                className="w-full px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-200 text-lg"
              >
                <option value="">Wszystkie częstotliwości</option>
                <option value="monthly">Miesięcznie</option>
                <option value="weekly">Co tydzień</option>
                <option value="on_demand">Na żądanie</option>
              </select>
            </div>

            {/* Sort Options */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Sortuj według
              </label>
              <div className="flex space-x-3">
                <select
                  value={currentSortBy}
                  onChange={(e) => onSortChange(e.target.value, currentSortOrder)}
                  className="flex-1 px-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-200 text-lg"
                >
                  <option value="name">Nazwa</option>
                  <option value="email">E-mail</option>
                  <option value="api_status">Status API</option>
                  <option value="last_report_date">Ostatni raport</option>
                  <option value="created_at">Data utworzenia</option>
                </select>
                <button
                  onClick={() => onSortChange(currentSortBy, currentSortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-4 border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {currentSortOrder === 'asc' ? 
                    <ChevronUp className="h-5 w-5 text-blue-600" /> : 
                    <ChevronDown className="h-5 w-5 text-blue-600" />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Active Filters Display */}
          {(currentStatusFilter || currentFrequencyFilter) && (
            <div className="border-t border-gray-200/50 pt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Aktywne filtry:</h4>
              <div className="flex flex-wrap gap-4">
                {currentStatusFilter && (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                    Status: {currentStatusFilter}
                    <button
                      onClick={() => onStatusFilterChange('')}
                      className="ml-3 hover:bg-blue-200 rounded-full p-1 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
                {currentFrequencyFilter && (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200 shadow-sm">
                    Częstotliwość: {currentFrequencyFilter}
                    <button
                      onClick={() => onFrequencyFilterChange('')}
                      className="ml-3 hover:bg-green-200 rounded-full p-1 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 