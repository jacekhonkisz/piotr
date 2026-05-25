'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Building, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientSelectorProps {
  currentClient: Client | null;
  onClientChange: (client: Client) => void;
  userRole: string;
  variant?: 'default' | 'compact';
}

export default function ClientSelector({ currentClient, onClientChange, userRole, variant = 'default' }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isCompact = variant === 'compact';

  useEffect(() => {
    if (userRole === 'admin') {
      loadClients();
    }
  }, [userRole]);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading clients:', error);
        return;
      }

      setClients(clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show selector for non-admin users
  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div className={`relative ${isOpen ? 'z-[90]' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center space-x-2 border border-stroke/50 bg-white shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto ${
          isCompact
            ? 'h-9 rounded-md px-3 text-xs'
            : 'min-h-[44px] rounded-xl px-4 py-3 md:px-6'
        }`}
        aria-label="Select client"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Building className="h-4 w-4 text-muted" />
        <span className={`${isCompact ? 'text-xs' : 'text-sm md:text-base'} truncate font-medium text-text`}>
          {currentClient?.name || 'Select Client'}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl md:left-auto md:w-80">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted">
              Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted">
              No clients available
            </div>
          ) : (
            <div className="py-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    onClientChange(client);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 min-h-[44px] text-left hover:bg-page transition-colors duration-150 flex items-center space-x-3 ${
                    currentClient?.id === client.id ? 'bg-navy/10 text-navy' : 'text-text'
                  }`}
                  role="option"
                  aria-selected={currentClient?.id === client.id}
                >
                  <div className="h-8 w-8 bg-gradient-to-br from-navy to-navy/80 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {client.name?.charAt(0) || 'C'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{client.name}</div>
                    <div className="text-xs text-muted truncate">{client.email}</div>
                  </div>
                  {currentClient?.id === client.id && (
                    <div className="h-2 w-2 bg-navy rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 