import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_METRICS_CONFIG, mergeWithDefaults, normalizeConfigForPlatform } from '../../../../lib/default-metrics-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
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

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, google_ads_customer_id, google_ads_enabled')
      .eq('admin_id', user.id)
      .order('name');

    if (clientsError) {
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    const clientIds = (clients || []).map((c) => c.id);

    const { data: configs } = await supabase
      .from('client_dashboard_config')
      .select('*')
      .in('client_id', clientIds);

    const configMap = new Map(
      (configs || []).map((c: any) => [c.client_id, c])
    );

    const defaults = [...DEFAULT_METRICS_CONFIG];

    const result = (clients || []).map((client) => {
      const existing = configMap.get(client.id);

      const metaRaw = existing?.meta_metrics_config;
      const googleRaw = existing?.google_metrics_config;
      const legacyRaw = existing?.metrics_config;

      const metaMetrics = normalizeConfigForPlatform(
        Array.isArray(metaRaw) && metaRaw.length > 0
          ? mergeWithDefaults(metaRaw)
          : Array.isArray(legacyRaw) && legacyRaw.length > 0
            ? mergeWithDefaults(legacyRaw)
            : [...defaults],
        'meta'
      );

      const googleMetrics = normalizeConfigForPlatform(
        Array.isArray(googleRaw) && googleRaw.length > 0
          ? mergeWithDefaults(googleRaw)
          : [...defaults],
        'google'
      );

      return {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          metaConnected: !!client.ad_account_id,
          googleConnected: !!client.google_ads_customer_id,
        },
        config: {
          id: existing?.id ?? null,
          metaMetrics,
          googleMetrics,
          metaEnabled: existing?.meta_enabled ?? true,
          googleEnabled: existing?.google_enabled ?? (client.google_ads_enabled ?? true),
          updatedAt: existing?.updated_at ?? null,
        },
      };
    });

    return NextResponse.json({ clients: result });
  } catch (err) {
    console.error('GET /api/admin/metrics-config error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
