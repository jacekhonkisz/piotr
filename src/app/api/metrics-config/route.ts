import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_METRICS_CONFIG,
  mergeWithDefaults,
  normalizeConfigForPlatform,
  type MetricConfigItem,
} from '../../../lib/default-metrics-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get('clientId');
    const platform = request.nextUrl.searchParams.get('platform'); // 'meta' | 'google' | null
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (isAdmin) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('admin_id', user.id)
        .single();

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
    } else {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('email', user.email)
        .single();

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
    }

    const { data: config } = await supabase
      .from('client_dashboard_config')
      .select('metrics_config, meta_metrics_config, google_metrics_config, meta_enabled, google_enabled, updated_at')
      .eq('client_id', clientId)
      .single();

    const defaults = [...DEFAULT_METRICS_CONFIG];

    const metaEnabled = config?.meta_enabled ?? true;
    const googleEnabled = config?.google_enabled ?? true;

    const metaRaw = config?.meta_metrics_config;
    const googleRaw = config?.google_metrics_config;
    const legacyRaw = config?.metrics_config;

    const metaMetrics = normalizeConfigForPlatform(
      Array.isArray(metaRaw) && metaRaw.length > 0
        ? mergeWithDefaults(metaRaw)
        : Array.isArray(legacyRaw) && legacyRaw.length > 0
          ? mergeWithDefaults(legacyRaw as MetricConfigItem[])
          : defaults,
      'meta'
    );

    const googleMetrics = normalizeConfigForPlatform(
      Array.isArray(googleRaw) && googleRaw.length > 0
        ? mergeWithDefaults(googleRaw)
        : [...defaults],
      'google'
    );

    // If platform specified, return only that platform's config
    if (platform === 'meta') {
      return NextResponse.json({ metrics: metaMetrics, metaEnabled, googleEnabled });
    }
    if (platform === 'google') {
      return NextResponse.json({ metrics: googleMetrics, metaEnabled, googleEnabled });
    }

    // Default: return legacy-compatible single config (meta takes priority)
    const metrics = metaMetrics;
    return NextResponse.json({
      metrics,
      metaMetrics,
      googleMetrics,
      metaEnabled,
      googleEnabled,
    });
  } catch (err) {
    console.error('GET /api/metrics-config error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
