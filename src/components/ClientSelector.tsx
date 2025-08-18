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
}

export default function ClientSelector({ currentClient, onClientChange, userRole }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-bg/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border border-stroke/50 hover:shadow-md transition-all duration-200"
      >
        <Building className="h-4 w-4 text-muted" />
        <span className="text-sm font-medium text-text">
          {currentClient?.name || 'Select Client'}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg/95 backdrop-blur-lg rounded-xl shadow-xl border border-stroke/50 z-50 max-h-64 overflow-y-auto">
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
                  className={`w-full px-4 py-3 text-left hover:bg-page transition-colors duration-150 flex items-center space-x-3 ${
                    currentClient?.id === client.id ? 'bg-navy/10 text-navy' : 'text-text'
                  }`}
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