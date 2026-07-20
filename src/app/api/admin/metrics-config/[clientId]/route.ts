import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_METRICS_CONFIG,
  mergeWithDefaults,
  normalizeConfigForPlatform,
  type MetricConfigItem,
} from '../../../../../lib/default-metrics-config';
import {
  normalizeClientConversionMappings,
  type ClientConversionMappings,
} from '../../../../../lib/client-conversion-mappings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = params;

    const { data: client } = await supabase
      .from('clients')
      .select('id, name, ad_account_id, google_ads_customer_id')
      .eq('id', clientId)
      .eq('admin_id', user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: config } = await supabase
      .from('client_dashboard_config')
      .select('*')
      .eq('client_id', clientId)
      .single();

    const defaults = [...DEFAULT_METRICS_CONFIG];

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

    return NextResponse.json({
      client: {
        ...client,
        metaConnected: !!client.ad_account_id,
        googleConnected: !!client.google_ads_customer_id,
      },
      config: {
        id: config?.id ?? null,
        metaMetrics,
        googleMetrics,
        metaEnabled: config?.meta_enabled ?? true,
        googleEnabled: config?.google_enabled ?? true,
        conversionMappings: normalizeClientConversionMappings(config?.conversion_mappings),
        updatedAt: config?.updated_at ?? null,
      },
    });
  } catch (err) {
    console.error('GET /api/admin/metrics-config/[clientId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = params;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('admin_id', user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      metaMetrics,
      googleMetrics,
      metaEnabled,
      googleEnabled,
      conversionMappings,
    } = body as {
      metaMetrics?: MetricConfigItem[];
      googleMetrics?: MetricConfigItem[];
      metaEnabled?: boolean;
      googleEnabled?: boolean;
      conversionMappings?: ClientConversionMappings;
    };

    const upsertPayload: Record<string, unknown> = {
      client_id: clientId,
      updated_at: new Date().toISOString(),
    };

    if (Array.isArray(metaMetrics))   upsertPayload.meta_metrics_config = metaMetrics;
    if (Array.isArray(googleMetrics)) upsertPayload.google_metrics_config = googleMetrics;
    if (typeof metaEnabled === 'boolean')   upsertPayload.meta_enabled = metaEnabled;
    if (typeof googleEnabled === 'boolean') upsertPayload.google_enabled = googleEnabled;
    if (conversionMappings !== undefined) {
      upsertPayload.conversion_mappings =
        normalizeClientConversionMappings(conversionMappings);
    }

    // Keep legacy metrics_config in sync with meta for backwards compat
    if (Array.isArray(metaMetrics)) upsertPayload.metrics_config = metaMetrics;

    const { data, error } = await supabase
      .from('client_dashboard_config')
      .upsert(upsertPayload, { onConflict: 'client_id' })
      .select()
      .single();

    if (error) {
      console.error('Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: {
        id: data.id,
        metaMetrics: normalizeConfigForPlatform(
          mergeWithDefaults(data.meta_metrics_config as MetricConfigItem[]),
          'meta'
        ),
        googleMetrics: normalizeConfigForPlatform(
          mergeWithDefaults(data.google_metrics_config as MetricConfigItem[]),
          'google'
        ),
        metaEnabled: data.meta_enabled,
        googleEnabled: data.google_enabled,
        conversionMappings: normalizeClientConversionMappings(data.conversion_mappings),
        updatedAt: data.updated_at,
      },
    });
  } catch (err) {
    console.error('PUT /api/admin/metrics-config/[clientId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
