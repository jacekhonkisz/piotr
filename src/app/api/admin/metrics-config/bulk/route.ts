import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MetricConfigItem } from '../../../../../lib/default-metrics-config';

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

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      metaMetrics,
      googleMetrics,
      metaEnabled,
      googleEnabled,
    } = body as {
      metaMetrics?: MetricConfigItem[];
      googleMetrics?: MetricConfigItem[];
      metaEnabled?: boolean;
      googleEnabled?: boolean;
    };

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('admin_id', user.id);

    if (clientsError || !clients?.length) {
      return NextResponse.json({ error: 'No clients found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const rows = clients.map((c) => {
      const row: Record<string, unknown> = {
        client_id: c.id,
        updated_at: now,
      };
      if (Array.isArray(metaMetrics)) {
        row.meta_metrics_config = metaMetrics;
        row.metrics_config = metaMetrics; // backwards compat
      }
      if (Array.isArray(googleMetrics)) row.google_metrics_config = googleMetrics;
      if (typeof metaEnabled === 'boolean')   row.meta_enabled = metaEnabled;
      if (typeof googleEnabled === 'boolean') row.google_enabled = googleEnabled;
      return row;
    });

    const { error: upsertError } = await supabase
      .from('client_dashboard_config')
      .upsert(rows, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('Bulk upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save configs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: clients.length,
    });
  } catch (err) {
    console.error('POST /api/admin/metrics-config/bulk error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
