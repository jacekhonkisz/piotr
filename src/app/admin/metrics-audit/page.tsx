'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, RefreshCw, Database, Radio, Eye } from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import { AdminLoading } from '../../../components/LoadingSpinner';
import AdminNavbar from '../../../components/AdminNavbar';
import { buildMetricsAuditRows, groupAuditRows } from '../../../lib/metrics-audit-compare';

type Platform = 'meta' | 'google';
type RangeMode = 'month' | 'week' | 'custom';

interface ClientItem {
  id: string;
  name: string;
  email: string;
}

function getMonthRange(monthValue: string) {
  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getWeekRange(weekValue: string) {
  const [yearPart, weekPart] = weekValue.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - day + 1);
  const startDate = new Date(week1Monday);
  startDate.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);

  const toIso = (d: Date) => d.toISOString().split('T')[0] || '';
  return { start: toIso(startDate), end: toIso(endDate) };
}

export default function MetricsAuditPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultWeek = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, '0')}`;

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientId, setClientId] = useState('');
  const [platform, setPlatform] = useState<Platform>('meta');
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [monthValue, setMonthValue] = useState(defaultMonth);
  const [weekValue, setWeekValue] = useState(defaultWeek);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [liveData, setLiveData] = useState<any>(null);
  const [storedData, setStoredData] = useState<any>(null);
  const [storedMeta, setStoredMeta] = useState<Record<string, unknown> | null>(null);
  const [showRawLive, setShowRawLive] = useState(false);
  const [showRawStored, setShowRawStored] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [authLoading, profile, router]);

  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('No session token');
        const res = await fetch('/api/clients?page=1&limit=200&sortBy=name&sortOrder=asc', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load clients');
        const payload = await res.json();
        const list = (payload.clients || []).map((c: any) => ({ id: c.id, name: c.name, email: c.email }));
        setClients(list);
        if (list.length > 0) setClientId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading && user && profile?.role === 'admin') fetchClients();
  }, [authLoading, user, profile]);

  const dateRange = useMemo(() => {
    if (rangeMode === 'month') return getMonthRange(monthValue);
    if (rangeMode === 'week') return getWeekRange(weekValue);
    return { start: customStart, end: customEnd };
  }, [rangeMode, monthValue, weekValue, customStart, customEnd]);

  const auditRows = useMemo(() => {
    if (!liveData) return [];
    return buildMetricsAuditRows(platform, liveData, storedData);
  }, [liveData, storedData, platform]);

  const auditGroups = useMemo(() => groupAuditRows(auditRows), [auditRows]);

  const runComparison = async () => {
    if (!clientId || !dateRange.start || !dateRange.end) {
      setError('Choose client and valid date range first.');
      return;
    }
    setRunning(true);
    setError('');
    setLiveData(null);
    setStoredData(null);
    setStoredMeta(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('No session token');

      const liveEndpoint = platform === 'meta' ? '/api/fetch-live-data' : '/api/fetch-google-ads-live-data';
      const liveBody =
        platform === 'meta'
          ? {
              clientId,
              dateRange,
              platform,
              forceFresh: true,
              bypassAllCache: true,
              reason: 'metrics-audit-ui'
            }
          : {
              clientId,
              dateRange,
              forceFresh: true,
              bypassAllCache: true,
              reason: 'metrics-audit-ui'
            };

      const [liveRes, storedRes] = await Promise.all([
        fetch(liveEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(liveBody)
        }),
        fetch('/api/admin/metrics-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ clientId, platform, dateRange })
        })
      ]);

      const livePayload = await liveRes.json();
      const storedPayload = await storedRes.json();

      if (!liveRes.ok) throw new Error(livePayload.error || livePayload.details || 'Live API request failed');
      if (!storedRes.ok) throw new Error(storedPayload.error || 'Stored-data request failed');

      setLiveData(livePayload.data || null);
      setStoredData(storedPayload.data || null);
      setStoredMeta(storedPayload.storedMeta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compare');
    } finally {
      setRunning(false);
    }
  };

  if (loading || authLoading) {
    return <AdminLoading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F9FC] to-[#EEF2F7]">
      <AdminNavbar />
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8 mt-6">
        <div className="bg-white rounded-[18px] border border-[#E9EEF5] p-6">
          <h1 className="text-2xl font-semibold text-[#101828] mb-4">Metrics Audit / Raw Compare</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="border rounded-lg px-3 py-2">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="border rounded-lg px-3 py-2">
              <option value="meta">Meta</option>
              <option value="google">Google</option>
            </select>
            <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)} className="border rounded-lg px-3 py-2">
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="custom">Custom Dates</option>
            </select>
            <button
              onClick={runComparison}
              disabled={running}
              className="bg-[#1F3D8A] text-white rounded-lg px-4 py-2 font-medium hover:bg-[#1A2F6B] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
              Compare
            </button>
          </div>

          <div className="mt-3 flex gap-3 items-center">
            {rangeMode === 'month' && <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} className="border rounded-lg px-3 py-2" />}
            {rangeMode === 'week' && <input type="week" value={weekValue} onChange={(e) => setWeekValue(e.target.value)} className="border rounded-lg px-3 py-2" />}
            {rangeMode === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border rounded-lg px-3 py-2" />
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border rounded-lg px-3 py-2" />
              </>
            )}
            <div className="text-sm text-[#475467] flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {dateRange.start || '---'} to {dateRange.end || '---'}
            </div>
          </div>

          {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>

        {(liveData || storedData) && (
          <div className="mt-6 bg-white rounded-[18px] border border-[#E9EEF5] p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" /> Client metrics — live vs stored summary
            </h2>
            <p className="text-sm text-[#475467] mb-4">
              Same fields as the report metric contract (PDF, email, dashboard): spend, impressions, clicks, CTR, CPC, funnel steps, reservations, value, ROAS,
              plus Σ <code className="text-xs bg-gray-100 px-1 rounded">campaigns[]</code> vs API totals and stored <code className="text-xs bg-gray-100 px-1 rounded">data_source</code>.
              Raw Meta/Google action maps and debug-only rows are not listed here.
            </p>
            {!storedData && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">No stored row for this period/platform — run a fetch/cache refresh first; comparison rows need a stored summary.</div>}
            {storedMeta && (
              <div className="text-sm text-[#344054] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3 space-y-1">
                <div>
                  <span className="font-medium">Stored source:</span>{' '}
                  <code className="text-xs bg-white px-1 rounded border">{String((storedMeta as any).sourceTable ?? '—')}</code>
                  {(storedMeta as any).periodId != null && (
                    <>
                      {' '}
                      <span className="font-medium">period_id:</span>{' '}
                      <code className="text-xs bg-white px-1 rounded border">{String((storedMeta as any).periodId)}</code>
                    </>
                  )}
                </div>
                <div>
                  <span className="font-medium">DB last_updated:</span>{' '}
                  {(storedMeta as any).cacheLastUpdated != null ? String((storedMeta as any).cacheLastUpdated) : '—'}
                  {' · '}
                  <span className="font-medium">cache_data.fetchedAt:</span>{' '}
                  {(storedMeta as any).cacheFetchedAt != null ? String((storedMeta as any).cacheFetchedAt) : '—'}
                  {' · '}
                  <span className="font-medium">Age:</span>{' '}
                  {(storedMeta as any).ageMinutes != null ? `${(storedMeta as any).ageMinutes} min` : '—'}
                </div>
                {(storedMeta as any).interpretation != null && (
                  <p className="text-[#475467] pt-1 border-t border-slate-200 mt-1">{String((storedMeta as any).interpretation)}</p>
                )}
              </div>
            )}
            <div className="space-y-8">
              {[...auditGroups.entries()].map(([group, rows]) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-[#1F3D8A] mb-2">{group}</h3>
                  <div className="overflow-x-auto border border-[#E9EEF5] rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F9FC]">
                        <tr className="text-left border-b border-[#E9EEF5]">
                          <th className="py-2 px-3">Key</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Live</th>
                          <th className="py-2 px-3">Stored</th>
                          <th className="py-2 px-3">Delta</th>
                          <th className="py-2 px-3">Diff %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((m) => {
                          const pct = m.pctDiff;
                          const pctClass =
                            pct === null
                              ? 'text-[#98A2B3]'
                              : pct > 1
                                ? 'text-red-600 font-semibold'
                                : 'text-green-700';
                          return (
                            <tr key={`${group}-${m.key}`} className="border-b border-[#E9EEF5] last:border-b-0">
                              <td className="py-2 px-3 font-mono text-xs text-[#344054]">{m.key}</td>
                              <td className="py-2 px-3 text-[#475467]">{m.label}</td>
                              <td className="py-2 px-3 break-all">{m.live}</td>
                              <td className="py-2 px-3 break-all">{m.stored}</td>
                              <td className="py-2 px-3">{m.delta === null ? '—' : m.delta}</td>
                              <td className={`py-2 px-3 ${pctClass}`}>{pct === null ? '—' : `${pct.toFixed(2)}%`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(liveData || storedData) && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[18px] border border-[#E9EEF5] p-6">
              <button onClick={() => setShowRawLive((v) => !v)} className="flex items-center gap-2 text-sm font-medium">
                <Radio className="h-4 w-4" /> {showRawLive ? 'Hide' : 'Show'} Raw Live API
              </button>
              {showRawLive && <pre className="mt-3 text-xs bg-gray-50 p-3 rounded-lg max-h-[420px] overflow-auto">{JSON.stringify(liveData, null, 2)}</pre>}
            </div>
            <div className="bg-white rounded-[18px] border border-[#E9EEF5] p-6">
              <button onClick={() => setShowRawStored((v) => !v)} className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" /> {showRawStored ? 'Hide' : 'Show'} Raw Stored Data
              </button>
              {showRawStored && <pre className="mt-3 text-xs bg-gray-50 p-3 rounded-lg max-h-[420px] overflow-auto">{JSON.stringify(storedData, null, 2)}</pre>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

