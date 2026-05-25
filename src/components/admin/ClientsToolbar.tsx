'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';

export type IntegrationFilter = '' | 'meta' | 'google' | 'both' | 'none';

interface ClientsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;

  statusFilter: string;
  onStatusFilterChange: (value: string) => void;

  integrationFilter: IntegrationFilter;
  onIntegrationFilterChange: (value: IntegrationFilter) => void;

  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  onAddClient: () => void;
}

// Combined value to keep one dropdown for sort field + direction
const sortOptions = [
  { value: 'last_report_date:desc', label: 'Ostatnia aktywność' },
  { value: 'name:asc', label: 'Nazwa A–Z' },
  { value: 'name:desc', label: 'Nazwa Z–A' },
  { value: 'api_status:asc', label: 'Status' },
  { value: 'created_at:desc', label: 'Najnowsi klienci' },
];

export default function ClientsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  integrationFilter,
  onIntegrationFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  onAddClient,
}: ClientsToolbarProps) {
  const currentSortValue = `${sortBy}:${sortOrder}`;

  const handleSortValueChange = (value: string) => {
    const [field, order] = value.split(':') as [string, 'asc' | 'desc'];
    onSortChange(field, order);
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(16,24,40,0.04)] border border-[#E9EEF5] p-3 sm:p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Search input - dynamic, no submit needed */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#98A2B3] pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Szukaj klientów po nazwie, e-mailu lub firmie..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Szukaj klientów"
            className="w-full h-10 pl-9 pr-3 text-sm bg-[#F9FAFB] border border-[#E9EEF5] rounded-lg placeholder:text-[#98A2B3] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:border-[#7EA5FF] focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <label className="flex flex-col">
            <span className="sr-only">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="Filtruj po statusie"
              className="h-10 px-3 pr-8 text-sm bg-white border border-[#E9EEF5] rounded-lg text-[#344054] hover:border-[#D0D7DE] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] cursor-pointer min-w-[140px]"
            >
              <option value="">Status: Wszystkie</option>
              <option value="valid">Aktywny</option>
              <option value="pending">Oczekujący</option>
              <option value="expiring_soon">Ostrzeżenia</option>
              <option value="invalid">API błąd</option>
            </select>
          </label>

          {/* Integration filter */}
          <label className="flex flex-col">
            <span className="sr-only">Integracja</span>
            <select
              value={integrationFilter}
              onChange={(e) => onIntegrationFilterChange(e.target.value as IntegrationFilter)}
              aria-label="Filtruj po integracji"
              className="h-10 px-3 pr-8 text-sm bg-white border border-[#E9EEF5] rounded-lg text-[#344054] hover:border-[#D0D7DE] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] cursor-pointer min-w-[170px]"
            >
              <option value="">Integracja: Wszystkie</option>
              <option value="meta">Tylko Meta</option>
              <option value="google">Tylko Google</option>
              <option value="both">Meta + Google</option>
              <option value="none">Brak integracji</option>
            </select>
          </label>

          {/* Sort */}
          <label className="flex flex-col">
            <span className="sr-only">Sortuj</span>
            <select
              value={currentSortValue}
              onChange={(e) => handleSortValueChange(e.target.value)}
              aria-label="Sortuj klientów"
              className="h-10 px-3 pr-8 text-sm bg-white border border-[#E9EEF5] rounded-lg text-[#344054] hover:border-[#D0D7DE] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] cursor-pointer min-w-[200px]"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sortuj: {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Add client */}
          <button
            type="button"
            onClick={onAddClient}
            className="flex items-center gap-2 h-10 px-4 bg-[#1F3D8A] text-white rounded-lg text-sm font-medium hover:bg-[#1A2F6B] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-1 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Dodaj klienta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
