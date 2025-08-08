import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';
import { authenticateRequest, canAccessClient } from '../../../lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function monthRange(from: Date, to: Date): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= to) {
    const start = new Date(d);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startIso = start.toISOString().split('T')[0] as string;
    const endIso = end.toISOString().split('T')[0] as string;
    ranges.push({ start: startIso, end: endIso });
    d.setMonth(d.getMonth() + 1);
  }
  return ranges;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.statusCode || 401 });
    }

    const body = await request.json();
    const { clientId, granularity = 'daily' } = body || {};
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

    const { data: client, error: clientErr } = await supabase
      .from('clients').select('*').eq('id', clientId).single();
    if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (!canAccessClient(auth.user, client.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!client.meta_access_token || !client.ad_account_id) {
      return NextResponse.json({ error: 'Client missing Meta credentials' }, { status: 400 });
    }

    const adId = client.ad_account_id.startsWith('act_') ? client.ad_account_id.substring(4) : client.ad_account_id;
    const meta = new MetaAPIService(client.meta_access_token);

    // Determine earliest date: try 36 months back (API limit window)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 36);

    const ranges = monthRange(startDate, endDate);

    const seriesMap = new Map<string, { clicks: number; spend: number; conversions: number; impressions: number }>();

    for (const r of ranges) {
      // daily breakdown for each month
      const daily = await meta.getCampaignInsights(adId, r.start, r.end, granularity === 'daily' ? 1 : granularity === 'weekly' ? 7 : 30);
      for (const row of daily) {
        const date = row.date_start || r.start; // API returns per-day when time_increment=1
        const slot = seriesMap.get(date) || { clicks: 0, spend: 0, conversions: 0, impressions: 0 };
        slot.clicks += Number(row.clicks || 0);
        slot.spend += Number(row.spend || 0);
        slot.conversions += Number(row.conversions || 0);
        slot.impressions += Number(row.impressions || 0);
        seriesMap.set(date, slot);
      }
    }

    const series = Array.from(seriesMap.entries())
      .map(([date, v]) => ({ date, ...v, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = series.reduce((acc, d) => {
      acc.clicks += d.clicks; acc.spend += d.spend; acc.conversions += d.conversions; acc.impressions += d.impressions; return acc;
    }, { clicks: 0, spend: 0, conversions: 0, impressions: 0 });

    return NextResponse.json({ success: true, data: { series, totals, lastUpdated: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch full history' }, { status: 500 });
  }
} 