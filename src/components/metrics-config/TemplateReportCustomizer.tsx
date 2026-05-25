'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Table2,
  Users,
  Wand2,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import LiveClientView, { type LiveClientViewMode } from './LiveClientView';
import {
  BASE_TEMPLATE_NAME,
  REPORT_AREAS,
  getAreaById,
  getAvailableMetricsForSection,
  getClientChangeSummary,
  getClientChanges,
  getHiddenMetricsForSection,
  getMetricDiffStatus,
  getMetricId,
  getSectionDescription,
  getSectionMetrics,
  getSectionTitle,
  getVisibleMetricsForSection,
  type MetricChange,
  type MetricDiffStatus,
  type ReportAreaId,
} from '../../lib/metrics-template-customizer';
import type { MetricConfigItem, MetricSection } from '../../lib/default-metrics-config';

export type MetricsCustomizerPlatform = 'meta' | 'google';

export interface MetricsCustomizerClient {
  id: string;
  name: string;
  email: string;
  metaConnected: boolean;
  googleConnected: boolean;
}

export interface MetricsCustomizerClientConfig {
  client: MetricsCustomizerClient;
  config: {
    id: string | null;
    metaMetrics: MetricConfigItem[];
    googleMetrics: MetricConfigItem[];
    metaEnabled: boolean;
    googleEnabled: boolean;
    updatedAt: string | null;
  };
}

interface TemplateReportCustomizerProps {
  clients: MetricsCustomizerClientConfig[];
  selectedClientId: string | null;
  selectedClient?: MetricsCustomizerClientConfig;
  activePlatform: MetricsCustomizerPlatform;
  activeMetrics: MetricConfigItem[];
  metaEnabled: boolean;
  googleEnabled: boolean;
  hasChanges: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'success' | 'error';
  onBack: () => void;
  onSelectClient: (clientId: string) => void;
  onSelectPlatform: (platform: MetricsCustomizerPlatform) => void;
  onSetPlatformEnabled: (platform: MetricsCustomizerPlatform, enabled: boolean) => void;
  onPreviewToggle: () => void;
  showPreview: boolean;
  onOpenDiscovery: () => void;
  onSave: () => void;
  /** Push the current editor (Meta + Google) to every client. */
  onApplyCurrentLayoutToAllClients: () => Promise<void>;
  /** Reset every client to the built-in standard template (clears per-client tweaks). */
  onApplyStandardTemplateToAllClients: () => Promise<void>;
  onResetPlatform: () => void;
  onAddMetric: (section: MetricSection, key: string) => void;
  onRenameMetric: (section: MetricSection, key: string, name: string | null) => void;
  onToggleMetric: (section: MetricSection, key: string) => void;
  onReorderMetric: (section: MetricSection, fromIndex: number, toIndex: number) => void;
  onMoveMetric: (section: MetricSection, key: string, direction: 'up' | 'down') => void;
  onRevertMetric: (section: MetricSection, key: string) => void;
}

interface AddMetricState {
  section: MetricSection;
}

const AREA_ICONS: Record<ReportAreaId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  report: ListChecks,
  tables: Table2,
  changes: Wand2,
  advanced: SlidersHorizontal,
};

const STATUS_STYLES: Record<MetricDiffStatus, string> = {
  default: 'bg-slate-100 text-slate-600 border-slate-200',
  changed: 'bg-violet-50 text-violet-700 border-violet-200',
  added: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hidden: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<MetricDiffStatus, string> = {
  default: 'Default',
  changed: 'Changed',
  added: 'Added',
  hidden: 'Hidden',
};

function PlatformIcon({ platform }: { platform: MetricsCustomizerPlatform }) {
  if (platform === 'meta') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-semibold">
        f
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-semibold">
      G
    </span>
  );
}

function StatusBadge({ status }: { status: MetricDiffStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function CompactHeader({
  hasChanges,
  saving,
  onBack,
  onPreviewToggle,
  onResetClick,
  onRequestApplyCurrentToAll,
  onSave,
}: {
  hasChanges: boolean;
  saving: boolean;
  onBack: () => void;
  onPreviewToggle: () => void;
  onResetClick: () => void;
  onRequestApplyCurrentToAll: () => void;
  onSave: () => void;
}) {
  return (
    <header className="flex h-12 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Wróć do panelu administratora"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg">
              Report Customiser
            </h1>
            <span className="hidden truncate text-xs text-slate-500 md:inline">
              Configure left · live client view right
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onPreviewToggle}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-3 text-xs font-semibold text-[#1F3D8A] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Open full preview</span>
          <span className="lg:hidden">Preview</span>
        </button>
        <button
          type="button"
          onClick={onResetClick}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Reset</span>
        </button>
        <button
          type="button"
          onClick={onRequestApplyCurrentToAll}
          disabled={saving || !hasChanges}
          title="Apply this client’s current Meta + Google layout to every client"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-[#1F3D8A] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Apply to all clients</span>
          <span className="lg:hidden">Apply all</span>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !hasChanges}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1F3D8A] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#172d66] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </header>
  );
}

function SaveStatusBanner({
  saveStatus,
}: {
  saveStatus: 'idle' | 'success' | 'error';
}) {
  if (saveStatus === 'idle') return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium sm:px-6 lg:px-8 ${
        saveStatus === 'success'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-700'
      }`}
    >
      {saveStatus === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {saveStatus === 'success' ? 'Configuration saved.' : 'Could not save configuration. Please try again.'}
    </div>
  );
}

type OrganisationBulkMode = 'sync-current' | 'reset-standard';

function OrganisationBulkDialog({
  mode,
  clientCount,
  saving,
  onCancel,
  onConfirm,
}: {
  mode: OrganisationBulkMode | null;
  clientCount: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!mode) return null;
  const isSync = mode === 'sync-current';
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="org-bulk-title"
      aria-describedby="org-bulk-desc"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1F3D8A]">
          {isSync ? <Copy className="h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
        </div>
        <h2 id="org-bulk-title" className="text-lg font-bold text-slate-950">
          {isSync ? 'Apply this layout to all clients?' : 'Reset every client to the standard template?'}
        </h2>
        <p id="org-bulk-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          {isSync ? (
            <>
              This will overwrite report customisation for <strong className="font-semibold text-slate-800">{clientCount}</strong>{' '}
              client{clientCount === 1 ? '' : 's'} with the <strong className="font-semibold text-slate-800">Meta + Google</strong>{' '}
              configuration currently loaded in this editor (what you see in the left panel for both platforms).
            </>
          ) : (
            <>
              This will set <strong className="font-semibold text-slate-800">all {clientCount}</strong> client
              {clientCount === 1 ? '' : 's'} to the built-in <strong className="font-semibold text-slate-800">{BASE_TEMPLATE_NAME}</strong>{' '}
              defaults for both Meta and Google: custom names, hidden metrics, and order return to the standard model. Platform visibility
              toggles (Meta/Google visible) stay as they are now.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={saving || clientCount === 0}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
              isSync ? 'bg-[#1F3D8A] hover:bg-[#172d66] focus:ring-[#1F3D8A]' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSync ? 'Apply to all clients' : 'Reset all to standard'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BaseTemplateMenu({
  clientCount,
  hasChanges,
  saving,
  onRequestSyncCurrentToAll,
  onRequestResetStandardToAll,
}: {
  clientCount: number;
  hasChanges: boolean;
  saving: boolean;
  onRequestSyncCurrentToAll: () => void;
  onRequestResetStandardToAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-[55] shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        disabled={saving || clientCount === 0}
        className="inline-flex h-8 max-w-[min(100%,220px)] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
      >
        <Wand2 className="h-3.5 w-3.5 shrink-0 text-[#1F3D8A]" />
        <span className="text-slate-500">Base:</span>
        <span className="min-w-0 truncate">{BASE_TEMPLATE_NAME}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close base template menu"
            className="fixed inset-0 z-[60] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-9 z-[70] w-[min(calc(100vw-2rem),320px)] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              disabled={!hasChanges}
              title={!hasChanges ? 'Change metrics first, or use “Reset all” below' : undefined}
              onClick={() => {
                setOpen(false);
                onRequestSyncCurrentToAll();
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Copy className="h-3.5 w-3.5 text-[#1F3D8A]" />
                Use editor as default for everyone
              </span>
              <span className="pl-5 text-[11px] leading-snug text-slate-500">
                Saves the Meta + Google layout you see now to every client (dashboard, report, tables).
              </span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRequestResetStandardToAll();
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-xs transition hover:bg-amber-50"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Users className="h-3.5 w-3.5 text-amber-600" />
                Reset all clients to standard template
              </span>
              <span className="pl-5 text-[11px] leading-snug text-slate-500">
                Clears per-client tweaks and applies the built-in {BASE_TEMPLATE_NAME} model everywhere.
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CompactClientPicker({
  clients,
  selectedClientId,
  onSelectClient,
}: {
  clients: MetricsCustomizerClientConfig[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = clients.find((c) => c.client.id === selectedClientId);
  const filtered = clients.filter(({ client }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${client.name} ${client.email}`.toLowerCase().includes(q);
  });

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 max-w-[260px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
      >
        <span className="text-slate-500">Client:</span>
        <span className="truncate">{selected?.client.name ?? 'Select…'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close client list"
            className="fixed inset-0 z-[60] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-9 z-[70] w-[320px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none transition focus:border-[#1F3D8A] focus:bg-white focus:ring-2 focus:ring-[#1F3D8A]/15"
                autoFocus
              />
            </div>
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {filtered.map(({ client }) => {
                const active = client.id === selectedClientId;
                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectClient(client.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                        active ? 'bg-[#1F3D8A] text-white' : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="min-w-0 truncate font-semibold">{client.name}</span>
                      <span className={`truncate text-[11px] ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                        {client.email}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-2.5 py-3 text-xs text-slate-500">No clients found.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformSegment({
  activePlatform,
  metaEnabled,
  googleEnabled,
  selectedClient,
  onSelectPlatform,
  onSetPlatformEnabled,
}: {
  activePlatform: MetricsCustomizerPlatform;
  metaEnabled: boolean;
  googleEnabled: boolean;
  selectedClient?: MetricsCustomizerClientConfig;
  onSelectPlatform: (platform: MetricsCustomizerPlatform) => void;
  onSetPlatformEnabled: (platform: MetricsCustomizerPlatform, enabled: boolean) => void;
}) {
  const activeEnabled = activePlatform === 'meta' ? metaEnabled : googleEnabled;
  const connected =
    activePlatform === 'meta'
      ? selectedClient?.client.metaConnected
      : selectedClient?.client.googleConnected;
  return (
    <div className="flex items-center gap-1.5">
      <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white p-0.5">
        {(['meta', 'google'] as const).map((id) => {
          const active = activePlatform === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectPlatform(id)}
              aria-pressed={active}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition ${
                active ? 'bg-[#1F3D8A] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <PlatformBadge platform={id} active={active} />
              {id === 'meta' ? 'Meta' : 'Google'}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activeEnabled}
        onClick={() => onSetPlatformEnabled(activePlatform, !activeEnabled)}
        title={`Show ${activePlatform === 'meta' ? 'Meta Ads' : 'Google Ads'} data to this client`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
      >
        <span className={`relative h-4 w-7 rounded-full transition ${activeEnabled ? 'bg-[#1F3D8A]' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${activeEnabled ? 'left-3.5' : 'left-0.5'}`} />
        </span>
        <span className="hidden sm:inline">{activeEnabled ? 'Visible' : 'Hidden'}</span>
      </button>
      <span
        className={`inline-flex h-8 items-center rounded-lg border px-2 text-[11px] font-semibold ${
          connected
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}
        title={connected ? 'API connected' : 'API not connected'}
      >
        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        API {connected ? 'connected' : 'off'}
      </span>
    </div>
  );
}

function PlatformBadge({ platform, active }: { platform: MetricsCustomizerPlatform; active: boolean }) {
  const cls = active
    ? 'bg-white/20 text-white'
    : platform === 'meta'
    ? 'bg-blue-50 text-blue-600'
    : 'bg-emerald-50 text-emerald-600';
  return (
    <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${cls}`}>
      {platform === 'meta' ? 'f' : 'G'}
    </span>
  );
}

function ContextStrip({
  clients,
  selectedClientId,
  onSelectClient,
  activePlatform,
  metaEnabled,
  googleEnabled,
  selectedClient,
  onSelectPlatform,
  onSetPlatformEnabled,
  activeMetrics,
  hasChanges,
  saving,
  onOpenDiscovery,
  onRequestSyncCurrentToAll,
  onRequestResetStandardToAll,
}: {
  clients: MetricsCustomizerClientConfig[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  activePlatform: MetricsCustomizerPlatform;
  metaEnabled: boolean;
  googleEnabled: boolean;
  selectedClient?: MetricsCustomizerClientConfig;
  onSelectPlatform: (platform: MetricsCustomizerPlatform) => void;
  onSetPlatformEnabled: (platform: MetricsCustomizerPlatform, enabled: boolean) => void;
  activeMetrics: MetricConfigItem[];
  hasChanges: boolean;
  saving: boolean;
  onOpenDiscovery: () => void;
  onRequestSyncCurrentToAll: () => void;
  onRequestResetStandardToAll: () => void;
}) {
  const summary = getClientChangeSummary(activeMetrics);
  const totalChanges = summary.changed + summary.added + summary.hidden;
  return (
    <div className="flex h-11 min-w-0 items-center gap-2 px-4 sm:px-6 lg:px-8">
      {/* Client picker must NOT sit inside overflow-x-auto: that clips the dropdown list. */}
      <div className="relative z-50 shrink-0">
        <CompactClientPicker
          clients={clients}
          selectedClientId={selectedClientId}
          onSelectClient={onSelectClient}
        />
      </div>
      <BaseTemplateMenu
        clientCount={clients.length}
        hasChanges={hasChanges}
        saving={saving}
        onRequestSyncCurrentToAll={onRequestSyncCurrentToAll}
        onRequestResetStandardToAll={onRequestResetStandardToAll}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        <span className="hidden h-5 w-px shrink-0 bg-slate-200 sm:inline-block" />
        <PlatformSegment
          activePlatform={activePlatform}
          metaEnabled={metaEnabled}
          googleEnabled={googleEnabled}
          selectedClient={selectedClient}
          onSelectPlatform={onSelectPlatform}
          onSetPlatformEnabled={onSetPlatformEnabled}
        />
        <span className="hidden h-5 w-px shrink-0 bg-slate-200 lg:inline-block" />
        <span
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold ${
            totalChanges > 0
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
          title={`${summary.added} added · ${summary.changed} changed · ${summary.hidden} hidden`}
        >
          {totalChanges} {totalChanges === 1 ? 'change' : 'changes'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenDiscovery}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1F3D8A]/20 bg-blue-50 px-2.5 text-[11px] font-semibold text-[#1F3D8A] transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            <Settings2 className="h-3.5 w-3.5" />
            API metrics
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportAreaNav({
  activeArea,
  onChange,
  activeMetrics,
}: {
  activeArea: ReportAreaId;
  onChange: (area: ReportAreaId) => void;
  activeMetrics: MetricConfigItem[];
}) {
  const changes = getClientChanges(activeMetrics);
  return (
    <nav aria-label="Report customiser areas" className="flex h-11 items-center gap-1 border-b border-slate-200 bg-white px-2">
      {REPORT_AREAS.map((area) => {
        const Icon = AREA_ICONS[area.id];
        const active = activeArea === area.id;
        const areaChangeCount = area.id === 'changes'
          ? changes.length
          : changes.filter((change) => area.sections.includes(change.section)).length;
        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onChange(area.id)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30 ${
              active ? 'bg-[#1F3D8A] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
            {area.label}
            {areaChangeCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {areaChangeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function MetricRowCard({
  metric,
  index,
  total,
  onRename,
  onToggle,
  onRevert,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  metric: MetricConfigItem;
  index: number;
  total: number;
  onRename: (name: string | null) => void;
  onToggle: () => void;
  onRevert: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(metric.customName || metric.defaultName);
  // Keep the draft in sync when the underlying metric label changes (server
  // refresh, rename via inspector, etc.) so the next edit starts fresh.
  React.useEffect(() => {
    setDraftName(metric.customName || metric.defaultName);
  }, [metric.section, metric.key, metric.customName, metric.defaultName]);
  const status = getMetricDiffStatus(metric);
  const displayName = metric.customName || metric.defaultName;

  const commitName = () => {
    const nextName = draftName.trim();
    onRename(!nextName || nextName === metric.defaultName ? null : nextName);
    setIsEditing(false);
  };

  const cancelName = () => {
    setDraftName(metric.customName || metric.defaultName);
    setIsEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group rounded-2xl border bg-white p-4 transition hover:border-slate-300 hover:shadow-sm ${
        metric.visible ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50/60'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-slate-100"
          >
            <GripVertical className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={commitName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitName();
                    if (event.key === 'Escape') cancelName();
                  }}
                  aria-label={`Rename ${metric.defaultName}`}
                  className="h-9 min-w-[220px] rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none ring-2 ring-blue-100 focus:border-[#1F3D8A] focus:ring-[#1F3D8A]/20"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setIsEditing(true)}
                  className={`truncate rounded-lg text-left text-sm font-bold outline-none transition hover:bg-blue-50 focus:ring-2 focus:ring-[#1F3D8A]/20 ${metric.visible ? 'text-slate-950' : 'text-slate-500'}`}
                  title="Double-click or use Edit to rename"
                >
                  {displayName}
                </button>
              )}
              <StatusBadge status={status} />
              {metric.customName && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  Custom name
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">{metric.key}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{metric.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={index === 0}
            aria-label={`Move ${displayName} up`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            aria-label={`Move ${displayName} down`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={metric.visible}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30 ${
              metric.visible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {metric.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {metric.visible ? 'Visible' : 'Hidden'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {status !== 'default' && (
            <button
              type="button"
              onClick={onRevert}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            >
              <RotateCcw className="h-4 w-4" />
              Revert
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricSectionCard({
  section,
  metrics,
  onAddMetric,
  onRenameMetric,
  onToggleMetric,
  onReorderMetric,
  onMoveMetric,
  onRevertMetric,
}: {
  section: MetricSection;
  metrics: MetricConfigItem[];
  onAddMetric: (section: MetricSection) => void;
  onRenameMetric: (section: MetricSection, key: string, name: string | null) => void;
  onToggleMetric: (section: MetricSection, key: string) => void;
  onReorderMetric: (section: MetricSection, fromIndex: number, toIndex: number) => void;
  onMoveMetric: (section: MetricSection, key: string, direction: 'up' | 'down') => void;
  onRevertMetric: (section: MetricSection, key: string) => void;
}) {
  const [showHidden, setShowHidden] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const sectionItems = getSectionMetrics(metrics, section);
  const visibleItems = getVisibleMetricsForSection(metrics, section);
  const hiddenItems = getHiddenMetricsForSection(metrics, section);
  const sectionChanges = sectionItems.filter((metric) => getMetricDiffStatus(metric) !== 'default');
  const visibleChangedCount = sectionChanges.length;
  const renderedItems = showHidden ? [...visibleItems, ...hiddenItems] : visibleItems;

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{getSectionTitle(section)}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{getSectionDescription(section)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {visibleItems.length} visible
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {hiddenItems.length} hidden
            </span>
            {visibleChangedCount > 0 && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {visibleChangedCount} changes from standard
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onAddMetric(section);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1F3D8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172d66] focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <Plus className="h-4 w-4" />
          Add metric
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {renderedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No visible metrics in this section.</p>
            <p className="mt-1 text-sm text-slate-500">Add a metric or show hidden metrics to customise this part of the template.</p>
          </div>
        ) : (
          renderedItems.map((metric) => {
            const realIndex = sectionItems.findIndex((item) => item.key === metric.key);
            return (
              <MetricRowCard
                key={getMetricId(metric.section, metric.key)}
                metric={metric}
                index={realIndex}
                total={sectionItems.length}
                onRename={(name) => onRenameMetric(section, metric.key, name)}
                onToggle={() => onToggleMetric(section, metric.key)}
                onRevert={() => onRevertMetric(section, metric.key)}
                onMove={(direction) => onMoveMetric(section, metric.key, direction)}
                onDragStart={() => setDraggedIndex(realIndex)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedIndex !== null) onReorderMetric(section, draggedIndex, realIndex);
                  setDraggedIndex(null);
                }}
              />
            );
          })
        )}
      </div>

      {hiddenItems.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden((value) => !value)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <ChevronDown className={`h-4 w-4 transition ${showHidden ? 'rotate-180' : ''}`} />
          {showHidden ? 'Hide available metrics' : `Show hidden / available metrics (${hiddenItems.length})`}
        </button>
      )}
    </section>
  );
}

function ChangesSummaryPanel({
  activeMetrics,
  onJumpToSection,
  onRevertMetric,
}: {
  activeMetrics: MetricConfigItem[];
  onJumpToSection: (section: MetricSection) => void;
  onRevertMetric: (section: MetricSection, key: string) => void;
}) {
  const changes = getClientChanges(activeMetrics);
  const grouped = changes.reduce<Record<string, MetricChange[]>>((acc, change) => {
    acc[change.section] = [...(acc[change.section] ?? []), change];
    return acc;
  }, {});

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Changes from {BASE_TEMPLATE_NAME}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{changes.length} local changes</h2>
        <p className="mt-1 text-sm text-slate-600">
          This client uses the standard report template. Only client-specific changes are listed here.
        </p>
      </div>

      {changes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
          <h3 className="mt-3 text-lg font-bold text-slate-950">This client matches the standard template.</h3>
          <p className="mt-1 text-sm text-slate-500">No local report customisations have been made for this platform.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([section, sectionChanges]) => (
            <div key={section} className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">{getSectionTitle(section as MetricSection)}</h3>
                  <p className="text-xs text-slate-500">{sectionChanges.length} changes</p>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToSection(section as MetricSection)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
                >
                  Open section
                </button>
              </div>
              <div className="space-y-2">
                {sectionChanges.map((change) => (
                  <div key={change.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{change.label}</span>
                        <StatusBadge status={change.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{change.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRevertMetric(change.section, change.key)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Revert
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AdvancedMetricsTable({
  activeMetrics,
  onSelectMetric,
  onToggleMetric,
  onRevertMetric,
}: {
  activeMetrics: MetricConfigItem[];
  onSelectMetric: (metric: MetricConfigItem) => void;
  onToggleMetric: (section: MetricSection, key: string) => void;
  onRevertMetric: (section: MetricSection, key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const rows = activeMetrics
    .filter((metric) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${metric.section} ${metric.key} ${metric.defaultName} ${metric.customName ?? ''} ${metric.description}`
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => `${a.section}-${a.order}`.localeCompare(`${b.section}-${b.order}`));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Advanced metrics table</h2>
          <p className="text-sm text-slate-600">Power-user view for searching all technical sections and keys.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search section, key, label..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#1F3D8A] focus:bg-white focus:ring-2 focus:ring-[#1F3D8A]/15"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Section</th>
              <th scope="col" className="px-4 py-3">Display name</th>
              <th scope="col" className="px-4 py-3">Technical key</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Visible</th>
              <th scope="col" className="px-4 py-3">Order</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((metric) => {
              const status = getMetricDiffStatus(metric);
              return (
                <tr key={getMetricId(metric.section, metric.key)} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-700">{getSectionTitle(metric.section)}</td>
                  <td className="px-4 py-3 text-slate-900">{metric.customName || metric.defaultName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{metric.key}</td>
                  <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  <td className="px-4 py-3">{metric.visible ? 'Visible' : 'Hidden'}</td>
                  <td className="px-4 py-3">{metric.order + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => onSelectMetric(metric)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button type="button" onClick={() => onToggleMetric(metric.section, metric.key)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">{metric.visible ? 'Hide' : 'Show'}</button>
                      {status !== 'default' && (
                        <button type="button" onClick={() => onRevertMetric(metric.section, metric.key)} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100">Revert</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddMetricDrawer({
  state,
  activeMetrics,
  onClose,
  onAdd,
}: {
  state: AddMetricState;
  activeMetrics: MetricConfigItem[];
  onClose: () => void;
  onAdd: (section: MetricSection, key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const options = getAvailableMetricsForSection(activeMetrics, state.section, query);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-metric-title">
      <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add metric</p>
              <h2 id="add-metric-title" className="mt-1 text-xl font-bold text-slate-950">
                Add metric to {getSectionTitle(state.section)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">Search recommended, hidden, and available metrics for this section.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close add metric drawer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, key, or description..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#1F3D8A] focus:bg-white focus:ring-2 focus:ring-[#1F3D8A]/15"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {options.map((metric) => {
              const status = getMetricDiffStatus(metric);
              const alreadyUsed = metric.visible;
              return (
                <div key={metric.key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-950">{metric.customName || metric.defaultName}</h3>
                        <StatusBadge status={status} />
                        {alreadyUsed && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Already used</span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-400">{metric.key}</p>
                      <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyUsed}
                      onClick={() => {
                        onAdd(state.section, metric.key);
                        onClose();
                      }}
                      className="shrink-0 rounded-xl bg-[#1F3D8A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#172d66] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
                    >
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricInspector({
  metric,
  onClose,
  onRename,
  onToggle,
  onRevert,
}: {
  metric: MetricConfigItem;
  onClose: () => void;
  onRename: (section: MetricSection, key: string, name: string | null) => void;
  onToggle: (section: MetricSection, key: string) => void;
  onRevert: (section: MetricSection, key: string) => void;
}) {
  const [name, setName] = useState(metric.customName || metric.defaultName);
  // Re-sync local draft when the inspected metric changes (e.g. switching the
  // selected metric in the side panel) so the input doesn't keep stale text.
  React.useEffect(() => {
    setName(metric.customName || metric.defaultName);
  }, [metric.section, metric.key, metric.customName, metric.defaultName]);
  const status = getMetricDiffStatus(metric);

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20 xl:w-80 xl:shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metric inspector</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">{metric.customName || metric.defaultName}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close metric inspector"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 space-y-4">
        <StatusBadge status={status} />
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Display name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => onRename(metric.section, metric.key, name)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRename(metric.section, metric.key, name);
            }}
            className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-[#1F3D8A] focus:bg-white focus:ring-2 focus:ring-[#1F3D8A]/15"
          />
          <span className="mt-1 block text-xs text-slate-500">Default: {metric.defaultName}</span>
        </label>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Technical key</p>
          <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">{metric.key}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{getSectionTitle(metric.section)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
          <p className="mt-1 text-sm text-slate-600">{metric.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={metric.visible}
          onClick={() => onToggle(metric.section, metric.key)}
          className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
        >
          Visible in this section
          <span className={`relative h-6 w-11 rounded-full transition ${metric.visible ? 'bg-[#1F3D8A]' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${metric.visible ? 'left-6' : 'left-1'}`} />
          </span>
        </button>
        {status !== 'default' && (
          <button
            type="button"
            onClick={() => onRevert(metric.section, metric.key)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          >
            <RotateCcw className="h-4 w-4" />
            Revert this metric to standard
          </button>
        )}
      </div>
    </aside>
  );
}

function ResetChangesDialog({
  clientName,
  platform,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  platform: MetricsCustomizerPlatform;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h2 id="reset-dialog-title" className="text-xl font-bold text-slate-950">Reset client changes?</h2>
        <p id="reset-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
          You are about to remove all custom changes for {clientName} on {platform === 'meta' ? 'Meta Ads' : 'Google Ads'} and restore the {BASE_TEMPLATE_NAME} template.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            Reset changes
          </button>
        </div>
      </div>
    </div>
  );
}

function FullPreviewModal({
  mode,
  activeMetrics,
  selectedClient,
  activePlatform,
  metaEnabled,
  googleEnabled,
  onClose,
}: {
  mode: LiveClientViewMode;
  activeMetrics: MetricConfigItem[];
  selectedClient?: MetricsCustomizerClientConfig;
  activePlatform: MetricsCustomizerPlatform;
  metaEnabled: boolean;
  googleEnabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="full-preview-title">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Full preview</p>
            <h2 id="full-preview-title" className="mt-1 text-xl font-bold text-slate-950">
              {selectedClient?.client.name ?? 'Client'} · {activePlatform === 'meta' ? 'Meta Ads' : 'Google Ads'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Uses sample values. Shows the current unsaved configuration.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close full preview"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
          {selectedClient && (
            <LiveClientView
              mode={mode}
              metrics={activeMetrics}
              client={selectedClient.client}
              platform={activePlatform}
              metaEnabled={metaEnabled}
              googleEnabled={googleEnabled}
              size="full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FloatingDirtyBar({
  changeCount,
  saving,
  onReview,
  onRequestApplyCurrentToAll,
  onSave,
}: {
  changeCount: number;
  saving: boolean;
  onReview: () => void;
  onRequestApplyCurrentToAll: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="px-2">
          <p className="text-sm font-bold text-slate-950">
            {changeCount} unsaved {changeCount === 1 ? 'change' : 'changes'}
          </p>
          <p className="text-xs text-slate-500">Review, apply broadly, or save this client’s report customisation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onReview} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30">
            Review changes
          </button>
          <button
            type="button"
            onClick={onRequestApplyCurrentToAll}
            disabled={saving}
            className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-[#1F3D8A] transition hover:bg-blue-100 disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
          >
            Apply to all clients
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-[#1F3D8A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#172d66] disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplateReportCustomizer({
  clients,
  selectedClientId,
  selectedClient,
  activePlatform,
  activeMetrics,
  metaEnabled,
  googleEnabled,
  hasChanges,
  saving,
  saveStatus,
  onBack,
  onSelectClient,
  onSelectPlatform,
  onSetPlatformEnabled,
  onPreviewToggle,
  showPreview,
  onOpenDiscovery,
  onSave,
  onApplyCurrentLayoutToAllClients,
  onApplyStandardTemplateToAllClients,
  onResetPlatform,
  onAddMetric,
  onRenameMetric,
  onToggleMetric,
  onReorderMetric,
  onMoveMetric,
  onRevertMetric,
}: TemplateReportCustomizerProps) {
  const [activeArea, setActiveArea] = useState<ReportAreaId>('dashboard');
  const [addMetricState, setAddMetricState] = useState<AddMetricState | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [orgBulkDialog, setOrgBulkDialog] = useState<OrganisationBulkMode | null>(null);
  const activeAreaConfig = getAreaById(activeArea);
  const changeCount = getClientChanges(activeMetrics).length;
  const liveViewMode: LiveClientViewMode =
    activeArea === 'dashboard' ? 'dashboard' : activeArea === 'tables' ? 'tables' : 'report';

  const handleOrganisationBulkConfirm = async () => {
    if (!orgBulkDialog) return;
    try {
      if (orgBulkDialog === 'sync-current') {
        await onApplyCurrentLayoutToAllClients();
      } else {
        await onApplyStandardTemplateToAllClients();
      }
    } finally {
      setOrgBulkDialog(null);
    }
  };

  const jumpToSection = (section: MetricSection) => {
    const area = REPORT_AREAS.find((candidate) => candidate.sections.includes(section));
    if (area) {
      setActiveArea(area.id);
    }
  };

  const handleAreaChange = (areaId: ReportAreaId) => {
    setActiveArea(areaId);
  };

  const liveViewLabel =
    liveViewMode === 'dashboard'
      ? 'Dashboard'
      : liveViewMode === 'tables'
      ? 'Tables'
      : 'Report';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#F8FAFC]">
      <div className="z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <CompactHeader
          hasChanges={hasChanges}
          saving={saving}
          onBack={onBack}
          onPreviewToggle={onPreviewToggle}
          onResetClick={() => setShowResetDialog(true)}
          onRequestApplyCurrentToAll={() => setOrgBulkDialog('sync-current')}
          onSave={onSave}
        />
        <SaveStatusBanner saveStatus={saveStatus} />
        <div className="border-t border-slate-100 bg-white/90">
          <ContextStrip
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={onSelectClient}
            activePlatform={activePlatform}
            metaEnabled={metaEnabled}
            googleEnabled={googleEnabled}
            selectedClient={selectedClient}
            onSelectPlatform={onSelectPlatform}
            onSetPlatformEnabled={onSetPlatformEnabled}
            activeMetrics={activeMetrics}
            hasChanges={hasChanges}
            saving={saving}
            onOpenDiscovery={onOpenDiscovery}
            onRequestSyncCurrentToAll={() => setOrgBulkDialog('sync-current')}
            onRequestResetStandardToAll={() => setOrgBulkDialog('reset-standard')}
          />
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,0.82fr)_minmax(380px,1.18fr)] xl:grid-cols-[minmax(280px,0.78fr)_minmax(400px,1.22fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white">
          <ReportAreaNav activeArea={activeArea} onChange={handleAreaChange} activeMetrics={activeMetrics} />
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {activeArea === 'changes' ? (
                <ChangesSummaryPanel
                  activeMetrics={activeMetrics}
                  onJumpToSection={jumpToSection}
                  onRevertMetric={onRevertMetric}
                />
              ) : activeArea === 'advanced' ? (
                <AdvancedMetricsTable
                  activeMetrics={activeMetrics}
                  onSelectMetric={(metric) => jumpToSection(metric.section)}
                  onToggleMetric={onToggleMetric}
                  onRevertMetric={onRevertMetric}
                />
              ) : (
                <div className="space-y-4">
                  {activeAreaConfig.sections.map((section) => (
                    <MetricSectionCard
                      key={section}
                      section={section}
                      metrics={activeMetrics}
                      onAddMetric={(nextSection) => {
                        setAddMetricState({ section: nextSection });
                      }}
                      onRenameMetric={onRenameMetric}
                      onToggleMetric={onToggleMetric}
                      onReorderMetric={onReorderMetric}
                      onMoveMetric={onMoveMetric}
                      onRevertMetric={onRevertMetric}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live client view
              </span>
              <span className="font-semibold text-slate-800">{liveViewLabel}</span>
              <span className="hidden text-slate-400 sm:inline">· sample data</span>
            </div>
            <button
              type="button"
              onClick={onPreviewToggle}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 text-[11px] font-semibold text-[#1F3D8A] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1F3D8A]/30"
            >
              <Eye className="h-3.5 w-3.5" />
              Open full preview
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-slate-50">
            {selectedClient ? (
              <LiveClientView
                mode={liveViewMode}
                metrics={activeMetrics}
                client={selectedClient.client}
                platform={activePlatform}
                metaEnabled={metaEnabled}
                googleEnabled={googleEnabled}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
                Select a client to preview the live client view.
              </div>
            )}
          </div>
        </aside>
      </div>


      {addMetricState && (
        <AddMetricDrawer
          state={addMetricState}
          activeMetrics={activeMetrics}
          onClose={() => setAddMetricState(null)}
          onAdd={onAddMetric}
        />
      )}

      {showResetDialog && selectedClient && (
        <ResetChangesDialog
          clientName={selectedClient.client.name}
          platform={activePlatform}
          onCancel={() => setShowResetDialog(false)}
          onConfirm={() => {
            onResetPlatform();
            setShowResetDialog(false);
          }}
        />
      )}

      {showPreview && (
        <FullPreviewModal
          mode={liveViewMode}
          activeMetrics={activeMetrics}
          selectedClient={selectedClient}
          activePlatform={activePlatform}
          metaEnabled={metaEnabled}
          googleEnabled={googleEnabled}
          onClose={onPreviewToggle}
        />
      )}

      {hasChanges && (
        <FloatingDirtyBar
          changeCount={changeCount}
          saving={saving}
          onReview={() => handleAreaChange('changes')}
          onRequestApplyCurrentToAll={() => setOrgBulkDialog('sync-current')}
          onSave={onSave}
        />
      )}

      <OrganisationBulkDialog
        mode={orgBulkDialog}
        clientCount={clients.length}
        saving={saving}
        onCancel={() => {
          if (!saving) setOrgBulkDialog(null);
        }}
        onConfirm={handleOrganisationBulkConfirm}
      />
    </div>
  );
}
