'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import AdminNavbar from '../../../components/AdminNavbar';
import { useAuth } from '../../../components/AuthProvider';
import { AdminLoading } from '../../../components/LoadingSpinner';
import MetricsConfigurationModal from '../../../components/MetricsConfigurationModal';
import TemplateReportCustomizer, {
  type MetricsCustomizerClientConfig,
  type MetricsCustomizerPlatform,
} from '../../../components/metrics-config/TemplateReportCustomizer';
import { supabase } from '../../../lib/supabase';
import {
  addMetricToSection,
  moveMetricInSection,
  reorderMetricInSection,
  resetPlatformToTemplate,
  revertMetricToTemplate,
  setMetricCustomName,
  toggleMetricVisibility,
} from '../../../lib/metrics-template-customizer';
import type { MetricConfigItem, MetricSection } from '../../../lib/default-metrics-config';
import { getDefaultAdsProvider } from '../../../lib/ads-provider-utils';
import { notifyMetricsConfigUpdated } from '../../../lib/useMetricsConfig';

type SaveStatus = 'idle' | 'success' | 'error';

function DiscardChangesDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-dialog-title"
      aria-describedby="discard-dialog-description"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 id="discard-dialog-title" className="text-xl font-bold text-slate-950">
          Discard unsaved changes?
        </h2>
        <p id="discard-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
          You have unsaved client report customisations. Switching clients now will discard the current local edits.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            Discard and switch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MetricsConfigPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [clients, setClients] = useState<MetricsCustomizerClientConfig[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);

  const [metaMetrics, setMetaMetrics] = useState<MetricConfigItem[]>([]);
  const [googleMetrics, setGoogleMetrics] = useState<MetricConfigItem[]>([]);
  const [metaEnabled, setMetaEnabled] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [activePlatform, setActivePlatform] = useState<MetricsCustomizerPlatform>('google');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);

  const selectedClient = clients.find((config) => config.client.id === selectedClientId);
  const activeMetrics = activePlatform === 'meta' ? metaMetrics : googleMetrics;
  const setActiveMetrics = activePlatform === 'meta' ? setMetaMetrics : setGoogleMetrics;

  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }, []);

  const hydrateClientConfig = useCallback((clientConfig: MetricsCustomizerClientConfig) => {
    setSelectedClientId(clientConfig.client.id);
    setMetaMetrics(clientConfig.config.metaMetrics);
    setGoogleMetrics(clientConfig.config.googleMetrics);
    setMetaEnabled(clientConfig.config.metaEnabled);
    setGoogleEnabled(clientConfig.config.googleEnabled);
    setActivePlatform(getDefaultAdsProvider(clientConfig.client));
    setHasChanges(false);
    setSaveStatus('idle');
  }, []);

  const fetchConfigs = useCallback(async (): Promise<MetricsCustomizerClientConfig[]> => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/metrics-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch metrics config');
      const data = await res.json();
      const nextClients = (data.clients || []) as MetricsCustomizerClientConfig[];
      setClients(nextClients);

      const firstClient = nextClients[0];
      if (firstClient && !selectedClientId) {
        hydrateClientConfig(firstClient);
      }
      return nextClients;
    } catch (err) {
      console.error('Failed to fetch configs:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, hydrateClientConfig, selectedClientId]);

  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') {
      fetchConfigs();
    }
  }, [authLoading, fetchConfigs, profile?.role]);

  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [authLoading, profile, router]);

  const switchClient = (clientId: string) => {
    const client = clients.find((config) => config.client.id === clientId);
    if (client) hydrateClientConfig(client);
  };

  const handleClientSelect = (clientId: string) => {
    if (clientId === selectedClientId) return;
    if (hasChanges) {
      setPendingClientId(clientId);
      return;
    }
    switchClient(clientId);
  };

  const saveConfig = async (applyToAll = false) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const token = await getAuthToken();
      const payload = {
        metaMetrics,
        googleMetrics,
        metaEnabled,
        googleEnabled,
      };

      if (applyToAll) {
        const res = await fetch('/api/admin/metrics-config/bulk', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Bulk save failed');
      } else if (selectedClientId) {
        const res = await fetch(`/api/admin/metrics-config/${selectedClientId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Save failed');
      }

      setSaveStatus('success');
      setHasChanges(false);
      notifyMetricsConfigUpdated(applyToAll ? null : selectedClientId, applyToAll);
      const nextClients = await fetchConfigs();
      if (selectedClientId && nextClients.length > 0) {
        const match = nextClients.find((c) => c.client.id === selectedClientId);
        if (match) hydrateClientConfig(match);
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  };

  /** Writes the built-in standard template to every client (Meta + Google). Keeps platform visibility toggles. */
  const saveStandardTemplateToAllClients = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const token = await getAuthToken();
      const standardMeta = resetPlatformToTemplate();
      const standardGoogle = resetPlatformToTemplate();
      const res = await fetch('/api/admin/metrics-config/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metaMetrics: standardMeta,
          googleMetrics: standardGoogle,
          metaEnabled,
          googleEnabled,
        }),
      });
      if (!res.ok) throw new Error('Bulk standard template failed');

      setMetaMetrics(standardMeta);
      setGoogleMetrics(standardGoogle);
      setHasChanges(false);
      setSaveStatus('success');
      notifyMetricsConfigUpdated(null, true);
      const nextClients = await fetchConfigs();
      if (selectedClientId && nextClients.length > 0) {
        const match = nextClients.find((c) => c.client.id === selectedClientId);
        if (match) hydrateClientConfig(match);
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Standard template bulk error:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => {
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const updateActiveMetrics = (updater: (metrics: MetricConfigItem[]) => MetricConfigItem[]) => {
    setActiveMetrics((prev) => updater(prev));
    markDirty();
  };

  const handleSetPlatformEnabled = (platform: MetricsCustomizerPlatform, enabled: boolean) => {
    if (platform === 'meta') setMetaEnabled(enabled);
    else setGoogleEnabled(enabled);
    markDirty();
  };

  const handleRenameMetric = (section: MetricSection, key: string, name: string | null) => {
    updateActiveMetrics((metrics) => setMetricCustomName(metrics, section, key, name ?? ''));
  };

  const handleToggleMetric = (section: MetricSection, key: string) => {
    updateActiveMetrics((metrics) => toggleMetricVisibility(metrics, section, key));
  };

  const handleAddMetric = (section: MetricSection, key: string) => {
    updateActiveMetrics((metrics) => addMetricToSection(metrics, section, key));
  };

  const handleReorderMetric = (section: MetricSection, fromIndex: number, toIndex: number) => {
    updateActiveMetrics((metrics) => reorderMetricInSection(metrics, section, fromIndex, toIndex));
  };

  const handleMoveMetric = (section: MetricSection, key: string, direction: 'up' | 'down') => {
    updateActiveMetrics((metrics) => moveMetricInSection(metrics, section, key, direction));
  };

  const handleRevertMetric = (section: MetricSection, key: string) => {
    updateActiveMetrics((metrics) => revertMetricToTemplate(metrics, section, key));
  };

  const handleResetPlatform = () => {
    setActiveMetrics(resetPlatformToTemplate());
    markDirty();
  };

  if (authLoading || loading) {
    return <AdminLoading />;
  }

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminNavbar />
      <TemplateReportCustomizer
        clients={clients}
        selectedClientId={selectedClientId}
        selectedClient={selectedClient}
        activePlatform={activePlatform}
        activeMetrics={activeMetrics}
        metaEnabled={metaEnabled}
        googleEnabled={googleEnabled}
        hasChanges={hasChanges}
        saving={saving}
        saveStatus={saveStatus}
        onBack={() => router.push('/admin')}
        onSelectClient={handleClientSelect}
        onSelectPlatform={setActivePlatform}
        onSetPlatformEnabled={handleSetPlatformEnabled}
        showPreview={showPreview}
        onPreviewToggle={() => setShowPreview((prev) => !prev)}
        onOpenDiscovery={() => setMetricsModalOpen(true)}
        onSave={() => saveConfig(false)}
        onApplyCurrentLayoutToAllClients={() => saveConfig(true)}
        onApplyStandardTemplateToAllClients={saveStandardTemplateToAllClients}
        onResetPlatform={handleResetPlatform}
        onAddMetric={handleAddMetric}
        onRenameMetric={handleRenameMetric}
        onToggleMetric={handleToggleMetric}
        onReorderMetric={handleReorderMetric}
        onMoveMetric={handleMoveMetric}
        onRevertMetric={handleRevertMetric}
      />

      {selectedClientId && selectedClient && (
        <MetricsConfigurationModal
          open={metricsModalOpen}
          onClose={() => setMetricsModalOpen(false)}
          clientId={selectedClientId}
          clientName={selectedClient.client.name}
          metaMetrics={metaMetrics}
          googleMetrics={googleMetrics}
          setMetaMetrics={setMetaMetrics}
          setGoogleMetrics={setGoogleMetrics}
          onMarkDirty={markDirty}
          onSave={async () => {
            await saveConfig(false);
          }}
          saving={saving}
        />
      )}

      {pendingClientId && (
        <DiscardChangesDialog
          onCancel={() => setPendingClientId(null)}
          onConfirm={() => {
            switchClient(pendingClientId);
            setPendingClientId(null);
          }}
        />
      )}
    </div>
  );
}
