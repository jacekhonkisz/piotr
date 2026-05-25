'use client';

import React from 'react';
import { Users, Plus, RotateCcw } from 'lucide-react';

interface EmptyClientsStateProps {
  hasFilters: boolean;
  onResetFilters: () => void;
  onAddClient: () => void;
}

export default function EmptyClientsState({
  hasFilters,
  onResetFilters,
  onAddClient,
}: EmptyClientsStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E9EEF5] shadow-[0_2px_10px_rgba(16,24,40,0.04)] p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-[#F2F4F7] flex items-center justify-center mb-4">
        <Users className="h-6 w-6 text-[#667085]" />
      </div>
      <h3 className="text-base font-semibold text-[#101828] mb-1">
        {hasFilters ? 'Brak wyników' : 'Brak klientów'}
      </h3>
      <p className="text-sm text-[#667085] max-w-md mx-auto mb-5">
        {hasFilters
          ? 'Nie znaleziono klientów pasujących do wyszukiwania. Spróbuj zmienić filtry.'
          : 'Rozpocznij, dodając pierwszego klienta do systemu.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-white border border-[#E9EEF5] text-[#344054] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Wyczyść filtry
          </button>
        )}
        <button
          type="button"
          onClick={onAddClient}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-[#1F3D8A] text-white rounded-lg text-sm font-medium hover:bg-[#1A2F6B] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj klienta
        </button>
      </div>
    </div>
  );
}
