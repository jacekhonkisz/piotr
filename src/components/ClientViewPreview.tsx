'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Target, ArrowUpRight, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import DynamicAnimatedMetricsCharts from './DynamicAnimatedMetricsCharts';
import ConversionFunnel from './ConversionFunnel';
import type { MetricConfigItem, MetricSection } from '../lib/default-metrics-config';
import { filterChartMetricsWithRealData } from '../lib/real-metrics-filter';

const PREVIEW_LIMIT = 6;

interface ClientViewPreviewProps {
  metrics: MetricConfigItem[];
  clientName: string;
  platformLabel?: string;
  onReorder: (section: MetricSection, fromIndex: number, toIndex: number) => void;
  onRename: (section: MetricSection, key: string, newName: string | null) => void;
  onToggleVisibility: (section: MetricSection, key: string) => void;
}

// ── Sample values ────────────────────────────────────────
const SAMPLE: Record<string, number> = {
  totalSpend: 22822.94, totalImpressions: 1504880, totalClicks: 12600, totalConversions: 49,
  averageCtr: 0.86, averageCpc: 1.82, booking_step_1: 1980, booking_step_2: 1340,
  booking_step_3: 642, reservations: 328, reservation_value: 182400, roas: 4.31,
  click_to_call: 119, email_contacts: 76, cost_per_reservation: 129, conversion_value: 182400,
  total_conversion_value: 194200, reach: 892400, frequency: 1.69, cpm: 15.18, cpp: 25.58,
  averageCpa: 465.77, inline_link_clicks: 11200, lead: 234, purchase: 42, purchase_value: 168400,
  ctr: 0.84, cpc: 1.81, conversions: 49,
};
const sv = (k: string) => SAMPLE[k] ?? 0;

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 }).format(n);
const fmtNumber = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : n.toLocaleString('pl-PL');
const fmtVal = (key: string, fmt: string) => {
  const v = sv(key);
  if (fmt === 'currency') return fmtCurrency(v);
  if (fmt === 'percentage') return `${v.toFixed(2)}%`;
  return fmtNumber(v);
};

const ICONS: Record<string, { bg: string; fg: string; Icon: typeof Target }> = {
  totalSpend:            { bg: 'bg-blue-100',    fg: 'text-blue-600',    Icon: Target },
  totalImpressions:      { bg: 'bg-green-100',   fg: 'text-green-600',   Icon: ArrowUpRight },
  totalClicks:           { bg: 'bg-purple-100',  fg: 'text-purple-600',  Icon: Target },
  totalConversions:      { bg: 'bg-amber-100',   fg: 'text-amber-600',   Icon: Target },
  averageCtr:            { bg: 'bg-teal-100',    fg: 'text-teal-600',    Icon: ArrowUpRight },
  averageCpc:            { bg: 'bg-indigo-100',  fg: 'text-indigo-600',  Icon: Target },
  reach:                 { bg: 'bg-emerald-100', fg: 'text-emerald-600', Icon: ArrowUpRight },
  frequency:             { bg: 'bg-orange-100',  fg: 'text-orange-600',  Icon: Target },
  cpm:                   { bg: 'bg-rose-100',    fg: 'text-rose-600',    Icon: Target },
  cpp:                   { bg: 'bg-pink-100',    fg: 'text-pink-600',    Icon: Target },
  reservations:          { bg: 'bg-cyan-100',    fg: 'text-cyan-600',    Icon: Target },
  reservation_value:     { bg: 'bg-sky-100',     fg: 'text-sky-600',     Icon: Target },
  roas:                  { bg: 'bg-lime-100',    fg: 'text-lime-600',    Icon: ArrowUpRight },
  cost_per_reservation:  { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-600', Icon: Target },
  click_to_call:         { bg: 'bg-violet-100',  fg: 'text-violet-600',  Icon: Target },
  email_contacts:        { bg: 'bg-yellow-100',  fg: 'text-yellow-600',  Icon: Target },
  booking_step_1:        { bg: 'bg-blue-50',     fg: 'text-blue-500',    Icon: Target },
  booking_step_2:        { bg: 'bg-blue-50',     fg: 'text-blue-500',    Icon: Target },
  booking_step_3:        { bg: 'bg-blue-50',     fg: 'text-blue-500',    Icon: Target },
  conversion_value:      { bg: 'bg-emerald-100', fg: 'text-emerald-600', Icon: Target },
  total_conversion_value:{ bg: 'bg-emerald-100', fg: 'text-emerald-700', Icon: Target },
  averageCpa:            { bg: 'bg-red-100',     fg: 'text-red-600',     Icon: Target },
  inline_link_clicks:    { bg: 'bg-purple-100',  fg: 'text-purple-500',  Icon: Target },
  lead:                  { bg: 'bg-amber-100',   fg: 'text-amber-500',   Icon: Target },
  purchase:              { bg: 'bg-green-100',   fg: 'text-green-500',   Icon: Target },
  purchase_value:        { bg: 'bg-green-100',   fg: 'text-green-600',   Icon: Target },
};
const DICON = { bg: 'bg-blue-100', fg: 'text-blue-600', Icon: Target };

// ── Editable label ────────────────────────────────────────
function EditableLabel({ value, defaultValue, onCommit }: {
  value: string; defaultValue: string;
  onCommit: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  const open = () => { setDraft(value); setEditing(true); setTimeout(() => ref.current?.select(), 0); };
  const save = () => {
    setEditing(false);
    const t = draft.trim();
    onCommit(!t || t === defaultValue ? null : t);
  };

  return editing ? (
    <input ref={ref} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      className="bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none ring-2 ring-blue-300 text-sm min-w-0 w-full"
      autoFocus
    />
  ) : (
    <span onDoubleClick={open}
      className="cursor-text select-none hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 rounded px-0.5 transition-colors"
      title="Kliknij dwukrotnie, aby zmienić nazwę"
    >{value}</span>
  );
}

// ── Eye badge ─────────────────────────────────────────────
function EyeBadge({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`absolute top-2 right-2 z-20 p-1 rounded-md transition-all
        ${visible ? 'bg-green-100/90 text-green-600 hover:bg-green-200' : 'bg-red-100/90 text-red-500 hover:bg-red-200'}`}
      title={visible ? 'Ukryj' : 'Pokaż'}
    >
      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Drag wrapper ──────────────────────────────────────────
function DragWrap({ section, index, ds, onStart, onEnter, onDrop, onEnd, isHidden, children }: {
  section: MetricSection; index: number;
  ds: { section: MetricSection; index: number } | null;
  onStart: (s: MetricSection, i: number) => void;
  onEnter: (s: MetricSection, i: number) => void;
  onDrop:  (s: MetricSection, i: number) => void;
  onEnd: () => void;
  isHidden?: boolean; children: React.ReactNode;
}) {
  const over = ds?.section === section && ds?.index === index;
  return (
    <div draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onStart(section, index); }}
      onDragOver={(e) => { e.preventDefault(); onEnter(section, index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(section, index); }}
      onDragEnd={onEnd}
      className={`relative group ${over ? 'ring-2 ring-blue-400 ring-offset-1 rounded-xl' : ''} ${isHidden ? 'opacity-40' : ''}`}
      style={{ cursor: 'grab' }}
    >
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none z-10">
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>
      {children}
    </div>
  );
}

// ── Show more / less strip ────────────────────────────────
function ShowMoreStrip({ section, total, open, onToggle }: {
  section: string; total: number; open: boolean; onToggle: () => void;
}) {
  if (total <= PREVIEW_LIMIT) return null;
  const hidden = total - PREVIEW_LIMIT;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
        bg-[#1F3D8A] hover:bg-[#162d66] text-white text-sm font-semibold shadow transition-colors"
    >
      {open
        ? <><ChevronUp className="h-4 w-4" />Zwiń — ukryj {hidden}</>
        : <><ChevronDown className="h-4 w-4" />Pokaż wszystkie +{hidden} więcej</>
      }
    </button>
  );
}

// ── Section header ────────────────────────────────────────
function SectionHead({ title, shown, total }: { title: string; shown: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
        {shown} / {total}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function ClientViewPreview({
  metrics, platformLabel, onReorder, onRename, onToggleVisibility,
}: ClientViewPreviewProps) {
  // Drag state
  const [ds, setDs] = useState<{ section: MetricSection; index: number } | null>(null);
  const from = useRef<{ section: MetricSection; index: number } | null>(null);

  // Per-section expand state — all collapsed by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    kpi_cards: false,
    charts: false,
    funnel: false,
    report_summary: false,
    contact: false,
    campaign_table: false,
  });
  const toggleSection = (k: string) =>
    setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  const onStart = useCallback((s: MetricSection, i: number) => {
    from.current = { section: s, index: i }; setDs({ section: s, index: i });
  }, []);
  const onEnter = useCallback((s: MetricSection, i: number) => {
    if (from.current?.section !== s) return; setDs({ section: s, index: i });
  }, []);
  const onDrop = useCallback((s: MetricSection, to: number) => {
    if (!from.current || from.current.section !== s) return;
    if (from.current.index !== to) onReorder(s, from.current.index, to);
    from.current = null; setDs(null);
  }, [onReorder]);
  const onEnd = useCallback(() => { from.current = null; setDs(null); }, []);

  // Get sorted items for a section
  const sorted = (section: MetricSection) =>
    metrics.filter((m) => m.section === section).sort((a, b) => a.order - b.order);

  // Return sliced or full list depending on open state
  const slice = (section: MetricSection) => {
    const all = sorted(section);
    return openSections[section] ? all : all.slice(0, PREVIEW_LIMIT);
  };

  const lbl = (m: MetricConfigItem) => m.customName || m.defaultName;

  // Pre-compute all sections
  const allKpi      = sorted('kpi_cards');
  const allCharts   = sorted('charts');
  const allFunnel   = sorted('funnel');
  const allReport   = sorted('report_summary');
  const allContact  = sorted('contact');
  const allCampaign = sorted('campaign_table');

  const visFunnel = allFunnel.filter((m) => m.visible);

  const ROWS = [
    { campaign_name: 'Brand Search - Hotel', totalSpend: 9420, totalImpressions: 286540, totalClicks: 5903, reservations: 142, reservation_value: 78200, averageCtr: 2.06, averageCpc: 1.60, totalConversions: 18, frequency: 1.4, reach: 204671, roas: 8.30, cost_per_reservation: 66.34, booking_step_1: 840, booking_step_2: 580, booking_step_3: 310, click_to_call: 52, email_contacts: 31, objective: 'Conversions', conversion_value: 78200, total_conversion_value: 82100, cpm: 32.90, cpp: 46.03, averageCpa: 523.33, inline_link_clicks: 5200, lead: 86, purchase: 15, purchase_value: 62400 },
    { campaign_name: 'Remarketing - Visitors', totalSpend: 5180, totalImpressions: 412300, totalClicks: 2840, reservations: 86, reservation_value: 47400, averageCtr: 0.69, averageCpc: 1.82, totalConversions: 14, frequency: 2.1, reach: 196333, roas: 9.15, cost_per_reservation: 60.23, booking_step_1: 620, booking_step_2: 410, booking_step_3: 180, click_to_call: 38, email_contacts: 24, objective: 'Remarketing', conversion_value: 47400, total_conversion_value: 51200, cpm: 12.56, cpp: 26.38, averageCpa: 370.00, inline_link_clicks: 2500, lead: 72, purchase: 14, purchase_value: 49200 },
    { campaign_name: 'Lookalike - Bookers', totalSpend: 4250, totalImpressions: 384200, totalClicks: 1980, reservations: 58, reservation_value: 32100, averageCtr: 0.52, averageCpc: 2.15, totalConversions: 9, frequency: 1.3, reach: 295538, roas: 7.55, cost_per_reservation: 73.28, booking_step_1: 520, booking_step_2: 350, booking_step_3: 152, click_to_call: 29, email_contacts: 21, objective: 'Prospecting', conversion_value: 32100, total_conversion_value: 34800, cpm: 11.06, cpp: 14.38, averageCpa: 472.22, inline_link_clicks: 1700, lead: 76, purchase: 13, purchase_value: 56800 },
  ];

  // ── Reusable card grid ──
  const cardGrid = (
    section: MetricSection,
    allItems: MetricConfigItem[],
    cols: string,
    renderItem: (cfg: MetricConfigItem, idx: number) => React.ReactNode,
  ) => {
    const items = openSections[section] ? allItems : allItems.slice(0, PREVIEW_LIMIT);
    return (
      <>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-4`}>
          {items.map((cfg, idx) => renderItem(cfg, idx))}
        </div>
        <ShowMoreStrip
          section={section}
          total={allItems.length}
          open={openSections[section]}
          onToggle={() => toggleSection(section)}
        />
      </>
    );
  };

  return (
    <div className="space-y-10">

      {/* ════════ DASHBOARD ════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <div className="h-1 w-8 rounded bg-[#1F3D8A]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#1F3D8A]">
            Dashboard — widok klienta{platformLabel ? ` · ${platformLabel}` : ''}
          </span>
          <span className="text-[10px] text-blue-600/70">
            · Przeciągnij = kolejność · 2×klik = nazwa ·
            <Eye className="inline h-3 w-3 mx-0.5 align-text-bottom" />pokaż/ukryj
          </span>
        </div>

        {/* ── Karty KPI ── */}
        <div className="mb-8">
          <SectionHead title="Karty KPI" shown={slice('kpi_cards').length} total={allKpi.length} />
          {(() => {
            const items = openSections['kpi_cards'] ? allKpi : allKpi.slice(0, PREVIEW_LIMIT);
            const cols = items.length <= 3 ? 'lg:grid-cols-3' : items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
            return (
              <>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-4 sm:gap-5`}>
                  {items.map((cfg, idx) => {
                    const { bg, fg, Icon } = ICONS[cfg.key] ?? DICON;
                    return (
                      <DragWrap key={cfg.key} section="kpi_cards" index={idx} ds={ds}
                        onStart={onStart} onEnter={onEnter} onDrop={onDrop} onEnd={onEnd}
                        isHidden={!cfg.visible}
                      >
                        <EyeBadge visible={cfg.visible} onToggle={() => onToggleVisibility('kpi_cards', cfg.key)} />
                        <div className={`bg-white rounded-2xl p-5 shadow-md border transition-all
                          ${cfg.visible ? 'border-gray-100 hover:shadow-lg' : 'border-dashed border-gray-300'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide pr-6">
                              <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                                onCommit={(n) => onRename('kpi_cards', cfg.key, n)} />
                            </div>
                            <div className={`p-2 ${bg} rounded-lg shrink-0`}>
                              <Icon className={`h-4 w-4 ${fg}`} />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-slate-900 tabular-nums">
                            {fmtVal(cfg.key, cfg.format)}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">Bieżący miesiąc</div>
                        </div>
                      </DragWrap>
                    );
                  })}
                </div>
                <ShowMoreStrip section="kpi_cards" total={allKpi.length} open={openSections['kpi_cards']}
                  onToggle={() => toggleSection('kpi_cards')} />
              </>
            );
          })()}
        </div>

        {/* ── Wykresy porównawcze ── */}
        <div className="mb-8">
          <SectionHead title="Wykresy porównawcze" shown={slice('charts').length} total={allCharts.length} />
          {cardGrid('charts', allCharts, 'lg:grid-cols-3', (cfg, idx) => (
            <DragWrap key={`ch-${cfg.key}`} section="charts" index={idx} ds={ds}
              onStart={onStart} onEnter={onEnter} onDrop={onDrop} onEnd={onEnd} isHidden={!cfg.visible}
            >
              <EyeBadge visible={cfg.visible} onToggle={() => onToggleVisibility('charts', cfg.key)} />
              <div className={`bg-white border rounded-xl p-4 transition-all
                ${cfg.visible ? 'border-slate-200 hover:border-slate-300' : 'border-dashed border-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-2 pr-6">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                      onCommit={(n) => onRename('charts', cfg.key, n)} />
                  </span>
                </div>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{fmtVal(cfg.key, cfg.format)}</p>
                <p className="text-xs text-slate-400 mt-1">Wykres MoM</p>
              </div>
            </DragWrap>
          ))}
        </div>

        {/* Live animated chart — respects visible chart metrics from config */}
        {(() => {
          const visibleCharts = metrics
            .filter((m) => m.section === 'charts' && m.visible)
            .sort((a, b) => a.order - b.order);
          if (!visibleCharts.length) return null;
          const prevSnap = Object.fromEntries(
            visibleCharts.map((m) => [m.key, sv(m.key) * 0.85])
          ) as Record<string, number>;
          const chartUi = filterChartMetricsWithRealData(
            visibleCharts,
            SAMPLE as Record<string, number>,
            prevSnap
          );
          if (!chartUi.length) return null;
          return (
            <DynamicAnimatedMetricsCharts
              chartMetrics={chartUi}
              current={SAMPLE as Record<string, number>}
              previous={prevSnap}
              isLoading={false}
            />
          );
        })()}
      </div>

      {/* ════════ RAPORT ════════ */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <div className="h-1 w-8 rounded bg-[#1F3D8A]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#1F3D8A]">Raport — widok klienta{platformLabel ? ` · ${platformLabel}` : ''}</span>
        </div>

        <div className="border-b pb-5 mb-8" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Raport - Miesiąc</h2>
              <div className="text-sm text-slate-600 mt-1">1 mar 2026 – 31 mar 2026</div>
            </div>
            <div className="text-right">
              <div className="text-lg text-gray-900 font-semibold">16</div>
              <div className="text-sm text-gray-600">kampanii</div>
            </div>
          </div>
        </div>

        {/* ── Podstawowe metryki ── */}
        <section className="mb-10">
          <SectionHead title="Podstawowe Metryki" shown={slice('report_summary').length} total={allReport.length} />
          {cardGrid('report_summary', allReport, 'lg:grid-cols-3', (cfg, idx) => (
            <DragWrap key={`rs-${cfg.key}`} section="report_summary" index={idx} ds={ds}
              onStart={onStart} onEnter={onEnter} onDrop={onDrop} onEnd={onEnd} isHidden={!cfg.visible}
            >
              <EyeBadge visible={cfg.visible} onToggle={() => onToggleVisibility('report_summary', cfg.key)} />
              <div className={`bg-white border rounded-lg p-5 transition-all
                ${cfg.visible ? 'border-slate-200 hover:border-slate-300' : 'border-dashed border-slate-300'}`}
              >
                <div className="pr-6 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                      onCommit={(n) => onRename('report_summary', cfg.key, n)} />
                  </span>
                </div>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums mb-1">{fmtVal(cfg.key, cfg.format)}</p>
                <span className="text-xs text-green-600 font-medium">+12.4%</span>
                <span className="text-xs text-slate-400 ml-1">vs rok do roku</span>
              </div>
            </DragWrap>
          ))}
        </section>

        {/* ── Lejek konwersji ── */}
        <section className="mb-10">
          <SectionHead title="Lejek konwersji" shown={slice('funnel').length} total={allFunnel.length} />
          {cardGrid('funnel', allFunnel, 'lg:grid-cols-3', (cfg, idx) => (
            <DragWrap key={`fn-${cfg.key}`} section="funnel" index={idx} ds={ds}
              onStart={onStart} onEnter={onEnter} onDrop={onDrop} onEnd={onEnd} isHidden={!cfg.visible}
            >
              <EyeBadge visible={cfg.visible} onToggle={() => onToggleVisibility('funnel', cfg.key)} />
              <div className={`bg-white border rounded-lg p-4 transition-all
                ${cfg.visible ? 'border-slate-200' : 'border-dashed border-slate-300'}`}
              >
                <div className="pr-6 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                      onCommit={(n) => onRename('funnel', cfg.key, n)} />
                  </span>
                </div>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{fmtVal(cfg.key, cfg.format)}</p>
              </div>
            </DragWrap>
          ))}
          {visFunnel.length > 0 && (
            <div className="mt-6">
              <ConversionFunnel
                step1={sv('booking_step_1')} step2={sv('booking_step_2')} step3={sv('booking_step_3')}
                reservations={sv('reservations')} reservationValue={sv('reservation_value')}
                conversionValue={sv('conversion_value')} totalConversionValue={sv('total_conversion_value')}
                roas={sv('roas')} platform="meta"
              />
            </div>
          )}
        </section>

        {/* ── Kontakt & Konwersje ── */}
        <section className="mb-10">
          <SectionHead title="Kontakt & Konwersje" shown={slice('contact').length} total={allContact.length} />
          {cardGrid('contact', allContact, 'lg:grid-cols-3', (cfg, idx) => (
            <DragWrap key={`ct-${cfg.key}`} section="contact" index={idx} ds={ds}
              onStart={onStart} onEnter={onEnter} onDrop={onDrop} onEnd={onEnd} isHidden={!cfg.visible}
            >
              <EyeBadge visible={cfg.visible} onToggle={() => onToggleVisibility('contact', cfg.key)} />
              <div className={`bg-white border rounded-lg p-5 transition-all
                ${cfg.visible ? 'border-slate-200 hover:border-slate-300' : 'border-dashed border-slate-300'}`}
              >
                <div className="pr-6 mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                      onCommit={(n) => onRename('contact', cfg.key, n)} />
                  </span>
                </div>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{fmtVal(cfg.key, cfg.format)}</p>
              </div>
            </DragWrap>
          ))}
        </section>

        {/* ── Tabela kampanii ── */}
        <section className="mb-10">
          {(() => {
            const items = openSections['campaign_table'] ? allCampaign : allCampaign.slice(0, PREVIEW_LIMIT);
            return (
              <>
                <SectionHead title="Kampanie (kolumny)" shown={items.length} total={allCampaign.length} />
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <div className="grid border-b border-slate-200 bg-slate-50 min-w-max"
                    style={{ gridTemplateColumns: `repeat(${items.length}, minmax(130px, 1fr))` }}
                  >
                    {items.map((cfg, idx) => (
                      <div key={cfg.key} draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onStart('campaign_table', idx); }}
                        onDragOver={(e) => { e.preventDefault(); onEnter('campaign_table', idx); }}
                        onDrop={(e) => { e.preventDefault(); onDrop('campaign_table', idx); }}
                        onDragEnd={onEnd}
                        className={`px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide
                          cursor-grab active:cursor-grabbing transition-colors flex items-center gap-1
                          ${!cfg.visible ? 'opacity-40' : ''}
                          ${ds?.section === 'campaign_table' && ds.index === idx ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'hover:bg-slate-100'}`}
                      >
                        <EditableLabel value={lbl(cfg)} defaultValue={cfg.defaultName}
                          onCommit={(n) => onRename('campaign_table', cfg.key, n)} />
                        <button onClick={(e) => { e.stopPropagation(); onToggleVisibility('campaign_table', cfg.key); }}
                          className={`ml-auto shrink-0 p-0.5 rounded ${cfg.visible ? 'text-green-500 hover:bg-green-100' : 'text-red-400 hover:bg-red-100'}`}
                        >
                          {cfg.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  {ROWS.map((row, ri) => (
                    <div key={ri} className="grid border-b border-slate-100 last:border-b-0 hover:bg-slate-50 min-w-max"
                      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(130px, 1fr))` }}
                    >
                      {items.map((cfg) => {
                        const val = (row as Record<string, unknown>)[cfg.key];
                        let d = '—';
                        if (val !== undefined) {
                          if (cfg.format === 'currency') d = fmtCurrency(val as number);
                          else if (cfg.format === 'percentage') d = `${(val as number).toFixed(2)}%`;
                          else if (typeof val === 'number') d = val.toLocaleString('pl-PL');
                          else d = String(val);
                        }
                        return (
                          <div key={cfg.key}
                            className={`px-3 py-3 text-sm text-slate-700 tabular-nums truncate ${!cfg.visible ? 'opacity-40' : ''}`}
                          >{d}</div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <ShowMoreStrip section="campaign_table" total={allCampaign.length}
                  open={openSections['campaign_table']} onToggle={() => toggleSection('campaign_table')} />
              </>
            );
          })()}
        </section>
      </div>
    </div>
  );
}
