'use client';

import { createContext, createElement, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import {
  DEFAULT_METRICS_CONFIG,
  mergeWithDefaults,
  normalizeConfigForPlatform,
  getMetricName as _getMetricName,
  isMetricVisible as _isMetricVisible,
  getVisibleMetrics as _getVisibleMetrics,
  type MetricConfigItem,
  type MetricSection,
} from './default-metrics-config';

interface UseMetricsConfigResult {
  config: MetricConfigItem[];
  loading: boolean;
  metaEnabled: boolean;
  googleEnabled: boolean;
  getMetricName: (section: MetricSection, key: string) => string;
  isMetricVisible: (section: MetricSection, key: string) => boolean;
  getVisibleMetrics: (section: MetricSection) => MetricConfigItem[];
  refresh: () => Promise<void>;
}

interface PlatformConfigCache {
  metaMetrics: MetricConfigItem[];
  googleMetrics: MetricConfigItem[];
  metaEnabled: boolean;
  googleEnabled: boolean;
  ts: number;
}

const configCache = new Map<string, PlatformConfigCache>();
// Short TTL keeps renames "instant" without sacrificing perceived performance.
// Cache is also actively invalidated on save events (same-tab + cross-tab + realtime).
const CACHE_TTL = 60 * 1000;

/**
 * Notify every other listener (any tab, any client, anywhere in the app) that
 * `client_dashboard_config` for `clientId` has changed. Dashboards, reports
 * and previews react instantly without waiting for the cache TTL.
 *
 * Call this right after a successful save to /api/admin/metrics-config.
 */
export function notifyMetricsConfigUpdated(clientId: string | null, applyToAll = false) {
  if (typeof window === 'undefined') return;
  const detail = { clientId, applyToAll, ts: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent('metrics-config-updated', { detail }));
  } catch {}
  try {
    // BroadcastChannel propagates instantly across tabs in the same browser session.
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('metrics-config');
      bc.postMessage(detail);
      bc.close();
    }
  } catch {}
  try {
    // localStorage 'storage' event is a fallback for browsers without
    // BroadcastChannel and a no-op in same tab (which is fine — same tab
    // already received the CustomEvent above).
    window.localStorage.setItem('metrics-config-updated', JSON.stringify(detail));
  } catch {}
}

interface MetricsConfigOverrideValue {
  clientId?: string | null;
  platform?: 'meta' | 'google';
  metrics: MetricConfigItem[];
  metaEnabled?: boolean;
  googleEnabled?: boolean;
}

const MetricsConfigOverrideContext = createContext<MetricsConfigOverrideValue | null>(null);

export function MetricsConfigOverrideProvider({
  value,
  children,
}: {
  value: MetricsConfigOverrideValue;
  children: ReactNode;
}) {
  return createElement(MetricsConfigOverrideContext.Provider, { value }, children);
}

export function useMetricsConfig(
  clientId: string | null,
  platform?: 'meta' | 'google'
): UseMetricsConfigResult {
  const override = useContext(MetricsConfigOverrideContext);
  const [config, setConfig] = useState<MetricConfigItem[]>(DEFAULT_METRICS_CONFIG);
  const [metaEnabled, setMetaEnabled] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);
  const effectivePlatform = platform ?? 'meta';
  const hasOverride = Boolean(
    override &&
      (!override.clientId || override.clientId === clientId) &&
      (!override.platform || override.platform === effectivePlatform)
  );

  const overrideConfig = useMemo(() => {
    if (!hasOverride || !override) return null;
    return normalizeConfigForPlatform(mergeWithDefaults(override.metrics), effectivePlatform);
  }, [effectivePlatform, hasOverride, override?.metrics]);

  const effectiveConfig = overrideConfig ?? config;
  const effectiveMetaEnabled = hasOverride ? (override?.metaEnabled ?? true) : metaEnabled;
  const effectiveGoogleEnabled = hasOverride ? (override?.googleEnabled ?? true) : googleEnabled;

  const fetchConfig = useCallback(async () => {
    if (hasOverride) return;
    if (!clientId) return;

    const cached = configCache.get(clientId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      const activeConfig = platform === 'google' ? cached.googleMetrics : cached.metaMetrics;
      setConfig(activeConfig);
      setMetaEnabled(cached.metaEnabled);
      setGoogleEnabled(cached.googleEnabled);
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/metrics-config?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setConfig(DEFAULT_METRICS_CONFIG);
        return;
      }

      const data = await res.json();

      const metaMetrics = normalizeConfigForPlatform(
        data.metaMetrics
          ? mergeWithDefaults(data.metaMetrics)
          : mergeWithDefaults(data.metrics || []),
        'meta'
      );
      const googleMetrics = normalizeConfigForPlatform(
        data.googleMetrics
          ? mergeWithDefaults(data.googleMetrics)
          : [...DEFAULT_METRICS_CONFIG],
        'google'
      );

      const mEnabled = data.metaEnabled ?? true;
      const gEnabled = data.googleEnabled ?? true;

      configCache.set(clientId, {
        metaMetrics,
        googleMetrics,
        metaEnabled: mEnabled,
        googleEnabled: gEnabled,
        ts: Date.now(),
      });

      const activeConfig = platform === 'google' ? googleMetrics : metaMetrics;
      setConfig(activeConfig);
      setMetaEnabled(mEnabled);
      setGoogleEnabled(gEnabled);
    } catch {
      setConfig(DEFAULT_METRICS_CONFIG);
    } finally {
      setLoading(false);
    }
  }, [clientId, platform, hasOverride]);

  useEffect(() => {
    if (!hasOverride) return;
    setLoading(false);
  }, [hasOverride, override?.metrics, override?.metaEnabled, override?.googleEnabled]);

  useEffect(() => {
    if (hasOverride) return;
    const key = `${clientId}::${platform ?? 'meta'}`;
    if (clientId && key !== fetchedRef.current) {
      fetchedRef.current = key;
      fetchConfig();
    }
  }, [clientId, platform, fetchConfig, hasOverride]);

  useEffect(() => {
    if (hasOverride) return;
    if (!clientId) return;

    const refreshConfig = (incomingClientId?: string | null) => {
      // If we received a targeted client id, only refresh when it matches OR
      // when applyToAll has been signalled (incomingClientId === null/undef).
      if (incomingClientId && incomingClientId !== clientId) return;
      configCache.delete(clientId);
      fetchedRef.current = null;
      void fetchConfig();
    };

    const onSameTabEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { clientId?: string | null; applyToAll?: boolean }
        | undefined;
      const target = detail?.applyToAll ? null : detail?.clientId ?? null;
      refreshConfig(target);
    };

    window.addEventListener('metrics-config-updated', onSameTabEvent);

    // Cross-tab via BroadcastChannel (preferred — same browser, all tabs).
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('metrics-config');
        bc.onmessage = (msg) => {
          const detail = msg.data as { clientId?: string | null; applyToAll?: boolean } | undefined;
          const target = detail?.applyToAll ? null : detail?.clientId ?? null;
          refreshConfig(target);
        };
      }
    } catch {}

    // Cross-tab via localStorage 'storage' event (fallback when BroadcastChannel is unavailable).
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'metrics-config-updated' || !event.newValue) return;
      try {
        const detail = JSON.parse(event.newValue) as { clientId?: string | null; applyToAll?: boolean };
        const target = detail?.applyToAll ? null : detail?.clientId ?? null;
        refreshConfig(target);
      } catch {}
    };
    window.addEventListener('storage', onStorage);

    // Refetch when the tab becomes visible again — guarantees renames done in
    // another tab show up immediately when the user comes back to /dashboard.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshConfig(clientId);
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Supabase realtime (requires `client_dashboard_config` in the
    // `supabase_realtime` publication). Belt-and-suspenders for cross-user
    // updates where BroadcastChannel/localStorage cannot reach.
    const channel = supabase
      .channel(`client_dashboard_config:${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_dashboard_config',
          filter: `client_id=eq.${clientId}`,
        },
        () => refreshConfig(clientId)
      )
      .subscribe();

    return () => {
      window.removeEventListener('metrics-config-updated', onSameTabEvent);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (bc) {
        try { bc.close(); } catch {}
      }
      void supabase.removeChannel(channel);
    };
  }, [clientId, fetchConfig, hasOverride]);

  const getMetricName = useCallback(
    (section: MetricSection, key: string) => _getMetricName(effectiveConfig, section, key),
    [effectiveConfig]
  );

  const isMetricVisible = useCallback(
    (section: MetricSection, key: string) => _isMetricVisible(effectiveConfig, section, key),
    [effectiveConfig]
  );

  const getVisibleMetrics = useCallback(
    (section: MetricSection) => _getVisibleMetrics(effectiveConfig, section),
    [effectiveConfig]
  );

  const refresh = useCallback(async () => {
    if (clientId) {
      configCache.delete(clientId);
      fetchedRef.current = null;
      await fetchConfig();
    }
  }, [clientId, fetchConfig]);

  return {
    config: effectiveConfig,
    loading: hasOverride ? false : loading,
    metaEnabled: effectiveMetaEnabled,
    googleEnabled: effectiveGoogleEnabled,
    getMetricName,
    isMetricVisible,
    getVisibleMetrics,
    refresh,
  };
}
