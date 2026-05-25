'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Clock, ShieldCheck, ShieldAlert, ChevronUp, ChevronDown } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import ClientActionsMenu from './ClientActionsMenu';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientsTableProps {
  clients: Client[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  onOpenReports: (client: Client) => void;
  onOpenDashboard: (client: Client) => void;
  onGenerateReport: (client: Client) => void;
  onEdit: (client: Client) => void;
  onCredentials: (client: Client) => void;
  onMetricsConfig?: (client: Client) => void;
  onDelete: (client: Client) => void;
}

// Sortable headers (only fields the API supports)
const sortableFields = new Set(['name', 'last_report_date', 'api_status']);

export default function ClientsTable({
  clients,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenReports,
  onOpenDashboard,
  onGenerateReport,
  onEdit,
  onCredentials,
  onMetricsConfig,
  onDelete,
}: ClientsTableProps) {
  const handleHeaderClick = (field: string) => {
    if (!sortableFields.has(field)) return;
    if (sortBy === field) {
      onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(field, field === 'last_report_date' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="bg-white rounded-t-2xl shadow-[0_2px_10px_rgba(16,24,40,0.04)] border border-[#E9EEF5] border-b-0 overflow-hidden">
      {/* Table on >=md screens */}
      <div className="hidden md:block">
        <div
          role="table"
          aria-label="Lista klientów"
          className="min-w-full"
        >
          {/* Header */}
          <div
            role="row"
            className="grid grid-cols-[minmax(260px,2.4fr)_minmax(170px,1.2fr)_minmax(150px,1fr)_minmax(140px,1fr)_140px_60px] items-center px-5 h-11 bg-[#F8FAFC] border-b border-[#E9EEF5] text-[12px] font-semibold text-[#667085] uppercase tracking-wide"
          >
            <SortHeader
              label="Klient"
              field="name"
              activeField={sortBy}
              order={sortOrder}
              onClick={handleHeaderClick}
            />
            <SortHeader
              label="Status"
              field="api_status"
              activeField={sortBy}
              order={sortOrder}
              onClick={handleHeaderClick}
            />
            <div role="columnheader">Integracje</div>
            <SortHeader
              label="Ostatnia aktywność"
              field="last_report_date"
              activeField={sortBy}
              order={sortOrder}
              onClick={handleHeaderClick}
            />
            <div role="columnheader">Główna akcja</div>
            <div role="columnheader" className="text-right">Więcej</div>
          </div>

          {/* Rows */}
          <div role="rowgroup" className="divide-y divide-[#F0F3F8]">
            {clients.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                onOpenReports={onOpenReports}
                onOpenDashboard={onOpenDashboard}
                onGenerateReport={onGenerateReport}
                onEdit={onEdit}
                onCredentials={onCredentials}
                onMetricsConfig={onMetricsConfig}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Compact card list on small screens */}
      <div className="md:hidden divide-y divide-[#F0F3F8]">
        {clients.map((client) => (
          <ClientRowCompact
            key={client.id}
            client={client}
            onOpenReports={onOpenReports}
            onOpenDashboard={onOpenDashboard}
            onGenerateReport={onGenerateReport}
            onEdit={onEdit}
            onCredentials={onCredentials}
            onMetricsConfig={onMetricsConfig}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

interface SortHeaderProps {
  label: string;
  field: string;
  activeField: string;
  order: 'asc' | 'desc';
  onClick: (field: string) => void;
}

function SortHeader({ label, field, activeField, order, onClick }: SortHeaderProps) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={isActive ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onClick(field)}
      className="flex items-center gap-1 text-left text-[12px] font-semibold uppercase tracking-wide text-[#667085] hover:text-[#344054] transition-colors"
    >
      <span>{label}</span>
      {isActive ? (
        order === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5 text-[#1F3D8A]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#1F3D8A]" />
        )
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-[#D0D5DD] opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

interface RowProps {
  client: Client;
  onOpenReports: (client: Client) => void;
  onOpenDashboard: (client: Client) => void;
  onGenerateReport: (client: Client) => void;
  onEdit: (client: Client) => void;
  onCredentials: (client: Client) => void;
  onMetricsConfig?: (client: Client) => void;
  onDelete: (client: Client) => void;
}

function ClientRow({
  client,
  onOpenReports,
  onOpenDashboard,
  onGenerateReport,
  onEdit,
  onCredentials,
  onMetricsConfig,
  onDelete,
}: RowProps) {
  const lastActivity = getLastActivity(client);

  return (
    <div
      role="row"
      className="grid grid-cols-[minmax(260px,2.4fr)_minmax(170px,1.2fr)_minmax(150px,1fr)_minmax(140px,1fr)_140px_60px] items-center px-5 min-h-[68px] hover:bg-[#FAFBFF] transition-colors"
    >
      {/* Klient */}
      <div className="flex items-center gap-3 min-w-0 py-3">
        <Avatar client={client} />
        <div className="min-w-0">
          <div
            className="text-[14px] font-semibold text-[#101828] truncate"
            title={client.name}
          >
            {client.name}
          </div>
          <div
            className="text-[12.5px] text-[#667085] truncate"
            title={client.email}
          >
            {client.email}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center flex-wrap gap-1.5 py-3">
        <ActiveBadge status={client.api_status} />
        <TokenHealthBadge status={client.token_health_status} />
      </div>

      {/* Integracje */}
      <div className="flex items-center flex-wrap gap-1.5 py-3">
        <IntegrationBadges client={client} />
      </div>

      {/* Ostatnia aktywność */}
      <div className="flex items-center text-[13px] text-[#475467] py-3">
        {lastActivity ? formatActivity(lastActivity) : <span className="text-[#98A2B3]">—</span>}
      </div>

      {/* Główna akcja */}
      <div className="py-3">
        <button
          type="button"
          onClick={() => onOpenReports(client)}
          className="inline-flex items-center justify-center h-9 px-4 bg-[#1F3D8A] text-white text-sm font-medium rounded-lg hover:bg-[#1A2F6B] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:ring-offset-1 shadow-sm transition-all w-full"
        >
          Raporty
        </button>
      </div>

      {/* Więcej */}
      <div className="flex justify-end py-3">
        <ClientActionsMenu
          onOpenDashboard={() => onOpenDashboard(client)}
          onOpenReports={() => onOpenReports(client)}
          onGenerateReport={() => onGenerateReport(client)}
          onEdit={() => onEdit(client)}
          onCredentials={() => onCredentials(client)}
          onMetricsConfig={onMetricsConfig ? () => onMetricsConfig(client) : undefined}
          onDelete={() => onDelete(client)}
        />
      </div>
    </div>
  );
}

function ClientRowCompact({
  client,
  onOpenReports,
  onOpenDashboard,
  onGenerateReport,
  onEdit,
  onCredentials,
  onMetricsConfig,
  onDelete,
}: RowProps) {
  const lastActivity = getLastActivity(client);
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar client={client} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101828] truncate">{client.name}</div>
          <div className="text-xs text-[#667085] truncate">{client.email}</div>
        </div>
        <ClientActionsMenu
          onOpenDashboard={() => onOpenDashboard(client)}
          onOpenReports={() => onOpenReports(client)}
          onGenerateReport={() => onGenerateReport(client)}
          onEdit={() => onEdit(client)}
          onCredentials={() => onCredentials(client)}
          onMetricsConfig={onMetricsConfig ? () => onMetricsConfig(client) : undefined}
          onDelete={() => onDelete(client)}
        />
      </div>
      <div className="flex items-center flex-wrap gap-1.5">
        <ActiveBadge status={client.api_status} />
        <TokenHealthBadge status={client.token_health_status} />
        <IntegrationBadges client={client} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[#667085]">
          {lastActivity ? formatActivity(lastActivity) : '—'}
        </span>
        <button
          type="button"
          onClick={() => onOpenReports(client)}
          className="inline-flex items-center justify-center h-8 px-3 bg-[#1F3D8A] text-white text-xs font-medium rounded-md hover:bg-[#1A2F6B] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] transition-all"
        >
          Raporty
        </button>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function Avatar({ client }: { client: Client }) {
  if (client.logo_url) {
    return (
      <div className="h-9 w-9 rounded-full overflow-hidden bg-[#F2F4F7] flex items-center justify-center flex-shrink-0 ring-1 ring-[#E9EEF5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={client.logo_url}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    );
  }
  const initial = (client.name || 'C').trim().charAt(0).toUpperCase();
  // Stable per-client subtle background derived from id/name
  const palette = [
    'bg-[#EEF4FF] text-[#1F3D8A]',
    'bg-[#F4F3FF] text-[#5925DC]',
    'bg-[#ECFDF3] text-[#067647]',
    'bg-[#FEF6EE] for-warn text-[#B54708]',
    'bg-[#FFF1F3] text-[#C01048]',
    'bg-[#F0F9FF] text-[#0B4A6F]',
  ];
  const idx =
    Math.abs(
      [...(client.id || client.name || 'c')].reduce(
        (acc, ch) => acc + ch.charCodeAt(0),
        0,
      ),
    ) % palette.length;
  return (
    <div
      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ring-1 ring-[#E9EEF5] ${palette[idx]}`}
    >
      {initial}
    </div>
  );
}

function ActiveBadge({ status }: { status: string | null }) {
  // Map existing api_status into operational labels
  switch (status) {
    case 'valid':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#ECFDF3] text-[#067647] text-[11.5px] font-medium border border-[#ABEFC6]">
          <CheckCircle className="h-3 w-3" />
          Aktywny
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FFFAEB] text-[#B54708] text-[11.5px] font-medium border border-[#FEDF89]">
          <Clock className="h-3 w-3" />
          Oczekujący
        </span>
      );
    case 'invalid':
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FEF3F2] text-[#B42318] text-[11.5px] font-medium border border-[#FECDCA]">
          <AlertCircle className="h-3 w-3" />
          Nieaktywny
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#F2F4F7] text-[#475467] text-[11.5px] font-medium border border-[#E4E7EC]">
          <Clock className="h-3 w-3" />
          Nieznany
        </span>
      );
  }
}

function TokenHealthBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'valid':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#EFF8FF] text-[#175CD3] text-[11.5px] font-medium border border-[#B2DDFF]">
          <ShieldCheck className="h-3 w-3" />
          API OK
        </span>
      );
    case 'expiring_soon':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FFFAEB] text-[#B54708] text-[11.5px] font-medium border border-[#FEDF89]">
          <AlertCircle className="h-3 w-3" />
          Ostrzeżenia
        </span>
      );
    case 'expired':
    case 'invalid':
      return (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FEF3F2] text-[#B42318] text-[11.5px] font-medium border border-[#FECDCA]">
          <ShieldAlert className="h-3 w-3" />
          API błąd
        </span>
      );
    default:
      return null;
  }
}

function IntegrationBadges({ client }: { client: Client }) {
  const hasMeta = !!client.ad_account_id;
  const hasGoogle = !!client.google_ads_customer_id;

  if (!hasMeta && !hasGoogle) {
    return (
      <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#F2F4F7] text-[#475467] text-[11.5px] font-medium border border-[#E4E7EC]">
        Brak
      </span>
    );
  }

  return (
    <>
      {hasMeta && (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white text-[#344054] text-[11.5px] font-medium border border-[#E4E7EC]">
          <MetaGlyph />
          Meta
        </span>
      )}
      {hasGoogle && (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white text-[#344054] text-[11.5px] font-medium border border-[#E4E7EC]">
          <GoogleGlyph />
          Google
        </span>
      )}
    </>
  );
}

function MetaGlyph() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full"
      style={{ background: 'linear-gradient(135deg, #0064E0 0%, #1877F2 100%)' }}
    />
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11 11 0 0 0 0 9.92l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.61 0 3.06.55 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function getLastActivity(client: Client): Date | null {
  const candidates = [
    client.last_report_sent_at,
    client.last_report_date,
    client.updated_at,
    client.last_token_validation,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return null;

  const ts = candidates
    .map((s) => new Date(s).getTime())
    .filter((n) => !Number.isNaN(n));

  if (ts.length === 0) return null;
  return new Date(Math.max(...ts));
}

function formatActivity(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Dzisiaj, ${time}`;
  if (isYesterday) return `Wczoraj, ${time}`;

  const monthShort = d.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${monthShort}, ${time}`;
}
