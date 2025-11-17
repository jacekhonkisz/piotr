'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { FileText, Eye, Users, Globe, Trash2, Plus, ArrowLeft } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Client {
  id: string;
  name: string;
}

interface EmailTemplate {
  id: string;
  client_id: string | null;
  client_name?: string;
  template_name: string;
  html_template: string;
  text_template: string;
  is_active: boolean;
  updated_at: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'main' | 'clients'>('main');
  const [mainTemplate, setMainTemplate] = useState<EmailTemplate | null>(null);
  const [clientTemplates, setClientTemplates] = useState<EmailTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load data
  useEffect(() => {
    loadMainTemplate();
    loadClientTemplates();
    loadClients();
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!editingTemplate) return;
    
    // Check if template has actually changed
    if (activeTab === 'main') {
      if (editingTemplate === mainTemplate?.html_template) return;
    } else {
      if (selectedClient) {
        const currentTemplate = clientTemplates.find(t => t.client_id === selectedClient);
        if (editingTemplate === currentTemplate?.html_template) return;
      } else {
        return; // No client selected
      }
    }

    const autoSaveTimeout = setTimeout(() => {
      console.log('🔄 Auto-saving template...');
      saveTemplate(true); // Pass true to indicate auto-save (no alerts)
    }, 2000);

    return () => clearTimeout(autoSaveTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTemplate, activeTab, selectedClient]);

  const loadMainTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .is('client_id', null)
        .eq('template_type', 'monthly_report')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading main template:', error);
        return;
      }

      if (data) {
        setMainTemplate(data);
        setEditingTemplate(data.html_template);
      }
    } catch (error) {
      console.error('Error loading main template:', error);
    }
  };

  const loadClientTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select(`
          *,
          client:clients(name)
        `)
        .not('client_id', 'is', null)
        .eq('template_type', 'monthly_report')
        .eq('is_active', true);

      if (error) {
        console.error('Error loading client templates:', error);
        return;
      }

      if (data) {
        const templatesWithNames = data.map(t => ({
          ...t,
          client_name: (t.client as any)?.name || 'Unknown'
        }));
        setClientTemplates(templatesWithNames);
      }
    } catch (error) {
      console.error('Error loading client templates:', error);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('api_status', 'valid')
        .order('name');

      if (error) {
        console.error('Error loading clients:', error);
        return;
      }

      if (data) {
        setClients(data);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const saveTemplate = async (isAutoSave = false) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (activeTab === 'main') {
        // Update main template
        if (mainTemplate) {
          const { error } = await supabase
            .from('email_templates')
            .update({
              html_template: editingTemplate,
              updated_at: new Date().toISOString()
            })
            .eq('id', mainTemplate.id);

          if (error) throw error;
          
          setLastSaved(new Date());
          if (!isAutoSave) {
            alert('✅ Szablon główny zapisany! Zmiana dotyczy wszystkich klientów bez dostosowanego szablonu.');
          }
          loadMainTemplate();
        }
      } else {
        // Update or create client template
        if (selectedClient) {
          const existing = clientTemplates.find(t => t.client_id === selectedClient);
          
          if (existing) {
            const { error } = await supabase
              .from('email_templates')
              .update({
                html_template: editingTemplate,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);

            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('email_templates')
              .insert({
                client_id: selectedClient,
                admin_id: user.id,
                template_type: 'monthly_report',
                template_name: 'Dostosowany szablon',
                html_template: editingTemplate,
                text_template: '',
                is_active: true
              });

            if (error) throw error;
          }

          setLastSaved(new Date());
          if (!isAutoSave) {
            alert('✅ Szablon klienta zapisany!');
          }
          loadClientTemplates();
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      if (!isAutoSave) {
        alert('❌ Błąd podczas zapisywania szablonu');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteClientTemplate = async (templateId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon? Klient będzie używał głównego szablonu.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;

      alert('✅ Szablon usunięty. Klient będzie używał głównego szablonu.');
      loadClientTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('❌ Błąd podczas usuwania szablonu');
    }
  };

  const loadClientTemplate = (clientId: string) => {
    const template = clientTemplates.find(t => t.client_id === clientId);
    if (template) {
      setEditingTemplate(template.html_template);
    } else {
      // Use main template as starting point
      setEditingTemplate(mainTemplate?.html_template || '');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ width: '100vw', maxWidth: 'none', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="flex items-center pl-4">
          <button
            onClick={() => router.push('/admin/calendar')}
            className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Wróć do kalendarza"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 hover:text-gray-900" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-purple-600" />
              Szablony E-mail
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Zarządzaj szablonem głównym i dostosowanymi szablonami dla klientów
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'main'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className="w-4 h-4 inline-block mr-2" />
            Szablon Główny (Globalne)
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'clients'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Szablony Klientów ({clientTemplates.length})
          </button>
        </div>
      </div>

      {/* Main Template Tab */}
      {activeTab === 'main' && (
        <>
          {/* Info Banner */}
          <div className="bg-purple-50 border-b border-purple-200 py-3">
            <div className="flex items-start pl-4">
              <Globe className="w-5 h-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-purple-900">
                <strong>⚠️ SZABLON GŁÓWNY (GLOBALNY)</strong>
                <br /><br />
                <strong>Ten szablon jest używany przez:</strong>
                <br />• Wszystkich klientów, którzy NIE mają dostosowanego szablonu
                <br />• Nowych klientów (domyślnie)
                <br /><br />
                <strong className="text-purple-700">🔔 Zmiana tego szablonu wpłynie na WSZYSTKICH klientów bez dostosowanego szablonu!</strong>
              </div>
            </div>
          </div>

          {/* Auto-save indicator */}
          {lastSaved && (
            <div className="py-2 text-[10px] text-gray-500 flex items-center bg-white border-b border-gray-200 pl-4">
              <svg className="w-2.5 h-2.5 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zapisano automatycznie: {lastSaved.toLocaleTimeString('pl-PL')}
            </div>
          )}

          {/* Split View: Editor + Preview */}
          <div className="grid grid-cols-2 gap-0 w-full" style={{ height: 'calc(100vh - 280px)' }}>
            {/* Left: HTML Editor */}
            <div className="border-r border-gray-200 flex flex-col">
              <h2 className="text-sm font-semibold text-gray-700 py-3 bg-gray-100 border-b border-gray-200 pl-4">Edytor HTML</h2>
              <textarea
                value={editingTemplate}
                onChange={(e) => setEditingTemplate(e.target.value)}
                className="flex-1 w-full text-xs font-mono bg-gray-900 text-purple-300 leading-relaxed resize-none border-0 focus:outline-none p-4"
                placeholder="<html>...</html>"
                spellCheck={false}
              />
            </div>

            {/* Right: Live Preview */}
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-gray-700 py-3 bg-gray-100 border-b border-gray-200 flex items-center pl-4">
                <Eye className="w-4 h-4 mr-2 text-purple-600" />
                Podgląd na żywo
              </h2>
              <div className="flex-1 bg-white overflow-auto p-4">
                <div dangerouslySetInnerHTML={{ __html: editingTemplate }} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Client Templates Tab */}
      {activeTab === 'clients' && (
        <>
          {/* Client Selection */}
          <div className="bg-white border-b border-gray-200 py-4 pl-4 pr-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Wybierz klienta do edycji szablonu
              </h2>
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  loadClientTemplate(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Wybierz klienta --</option>
                {clients.map((client) => {
                  const hasCustom = clientTemplates.some(t => t.client_id === client.id);
                  return (
                    <option key={client.id} value={client.id}>
                      {client.name} {hasCustom ? '✅ (ma dostosowany szablon)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

          {/* Existing Client Templates List */}
          {clientTemplates.length > 0 && (
            <div className="bg-white border-b border-gray-200 py-4 pl-4 pr-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Dostosowane szablony ({clientTemplates.length})
              </h3>
              <div className="space-y-2">
                {clientTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900">{template.client_name}</div>
                        <div className="text-sm text-gray-500">
                          Zaktualizowano: {new Date(template.updated_at).toLocaleDateString('pl-PL')}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedClient(template.client_id!);
                          setEditingTemplate(template.html_template);
                        }}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() => deleteClientTemplate(template.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client Template Editor */}
          {selectedClient && (
            <>
              {/* Info Banner */}
              <div className="bg-blue-50 border-b border-blue-200 py-3">
                <div className="flex items-start pl-4">
                  <Users className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    <strong>Szablon dla klienta: {clients.find(c => c.id === selectedClient)?.name}</strong>
                    <br />
                    Zmiany dotyczą TYLKO tego klienta. Auto-zapis włączony (2 sekundy).
                  </div>
                </div>
              </div>

              {/* Auto-save indicator */}
              {lastSaved && (
                <div className="py-2 text-[10px] text-gray-500 flex items-center bg-white border-b border-gray-200 pl-4">
                  <svg className="w-2.5 h-2.5 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Zapisano automatycznie: {lastSaved.toLocaleTimeString('pl-PL')}
                </div>
              )}

              {/* Split View: Editor + Preview */}
              <div className="grid grid-cols-2 gap-0 w-full" style={{ height: 'calc(100vh - 280px)' }}>
                {/* Left: HTML Editor */}
                <div className="border-r border-gray-200 flex flex-col">
                  <h2 className="text-sm font-semibold text-gray-700 py-3 bg-gray-100 border-b border-gray-200 pl-4">Edytor HTML</h2>
                  <textarea
                    value={editingTemplate}
                    onChange={(e) => setEditingTemplate(e.target.value)}
                    className="flex-1 w-full text-xs font-mono bg-gray-900 text-green-400 leading-relaxed resize-none border-0 focus:outline-none p-4"
                    placeholder="<html>...</html>"
                    spellCheck={false}
                  />
                </div>

                {/* Right: Live Preview */}
                <div className="flex flex-col">
                  <h2 className="text-sm font-semibold text-gray-700 py-3 bg-gray-100 border-b border-gray-200 flex items-center pl-4">
                    <Eye className="w-4 h-4 mr-2 text-blue-600" />
                    Podgląd na żywo
                  </h2>
                  <div className="flex-1 bg-white overflow-auto p-4">
                    <div dangerouslySetInnerHTML={{ __html: editingTemplate }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

