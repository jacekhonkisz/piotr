/* eslint-disable no-console */
/**
 * Final cross-check for the July 2026 monthly report.
 *
 * For every client it lines up the same four numbers from four independent
 * places and flags any disagreement:
 *
 *   api    — Google Ads API / Meta Graph API, queried directly
 *   stored — campaign_summaries rows the reports are supposed to read
 *   pdf    — the PDF production actually renders (parsed from the summary page)
 *   email  — the payload the email template renders from
 *
 * Usage: node scripts/final-compare-report-sources.js
 * Requires /tmp/email-payloads-2026-07.json (produced by the jest harness).
 */
const fs = require('fs');
const { execFileSync } = require('child_process');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PERIOD = { start: '2026-07-01', end: '2026-07-31' };
const PROD = 'https://www.pbmreports.pl';
const EMAIL_PAYLOADS = JSON.parse(fs.readFileSync('/tmp/email-payloads-2026-07.json', 'utf8'));
const JWT = fs.readFileSync('/tmp/piotr_jwt.txt', 'utf8').trim();
const PDF_CONCURRENCY = 2;
/** Relative tolerance for money, plus an absolute floor so rounding to grosz never trips it. */
const REL_TOLERANCE = 0.005;

// --- source: Google Ads API -------------------------------------------------

async function googleApiTotals(customer) {
  const rows = await customer.query(
    `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks
     FROM campaign
     WHERE segments.date BETWEEN '${PERIOD.start}' AND '${PERIOD.end}'`
  );
  return rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.metrics.cost_micros || 0) / 1e6,
      impressions: acc.impressions + Number(r.metrics.impressions || 0),
      clicks: acc.clicks + Number(r.metrics.clicks || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  );
}

// --- source: Meta Graph API -------------------------------------------------

async function metaApiTotals(token, adAccountId) {
  const id = adAccountId.startsWith('act_') ? adAccountId.substring(4) : adAccountId;
  const url =
    `https://graph.facebook.com/v21.0/act_${id}/insights?level=account` +
    `&time_range={"since":"${PERIOD.start}","until":"${PERIOD.end}"}` +
    `&fields=spend,impressions&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) return { error: json.error.message };
  const row = json.data?.[0];
  return {
    spend: parseFloat(row?.spend || '0'),
    impressions: parseInt(row?.impressions || '0', 10),
  };
}

// --- source: the production PDF --------------------------------------------

const NUM_SPACES = /[\s\u00a0\u202f\u2009]/g;

function parseAmount(raw) {
  return parseFloat(raw.replace(NUM_SPACES, '').replace(',', '.'));
}
function parseCount(raw) {
  return parseInt(raw.replace(NUM_SPACES, ''), 10);
}

function parsePdfSummary(text) {
  const flat = text.replace(/\s+/g, ' ');
  const section = (platform) => {
    const re = new RegExp(
      `${platform} Wydaliśmy ([\\d\\s\\u00a0\\u202f,]+?) zł\\. ` +
        `Wygenerowaliśmy ([\\d\\s\\u00a0\\u202f]+?) wyświetleń i ([\\d\\s\\u00a0\\u202f]+?) ` +
        `kliknięć \\(CTR ([\\d.,]+)%\\)\\.(?: Rezerwacje: (\\d+)\\.)?`
    );
    const m = flat.match(re);
    if (!m) return null;
    return {
      spend: parseAmount(m[1]),
      impressions: parseCount(m[2]),
      clicks: parseCount(m[3]),
      reservations: m[5] ? parseInt(m[5], 10) : 0,
    };
  };
  return { google: section('Google Ads'), meta: section('Meta Ads') };
}

async function fetchPdf(clientId, slug) {
  const res = await fetch(`${PROD}/api/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ clientId, dateRange: PERIOD }),
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const pdfPath = `/tmp/final-${slug}.pdf`;
  const txtPath = `/tmp/final-${slug}.txt`;
  fs.writeFileSync(pdfPath, Buffer.from(await res.arrayBuffer()));
  execFileSync('pdftotext', ['-layout', pdfPath, txtPath]);
  return parsePdfSummary(fs.readFileSync(txtPath, 'utf8'));
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    })
  );
  return results;
}

// --- comparison -------------------------------------------------------------

const agrees = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const diff = Math.abs(a - b);
  if (diff < 0.02) return true;
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base > 0 && diff / base <= REL_TOLERANCE;
};

const money = (n) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('pl-PL'));

(async () => {
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key,value')
    .like('key', 'google_ads%');
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const googleApi = new GoogleAdsApi({
    client_id: settings.google_ads_client_id,
    client_secret: settings.google_ads_client_secret,
    developer_token: settings.google_ads_developer_token,
  });
  const managerId = String(settings.google_ads_manager_customer_id).replace(/-/g, '');

  const { data: clients } = await supabase
    .from('clients')
    .select('id,name,google_ads_customer_id,ad_account_id,meta_access_token,system_user_token')
    .order('name');

  console.log(`Generating ${clients.length} PDFs from production (concurrency ${PDF_CONCURRENCY})...`);
  const pdfs = await mapLimit(clients, PDF_CONCURRENCY, async (c, i) => {
    const slug = String(i).padStart(2, '0');
    const started = Date.now();
    const parsed = await fetchPdf(c.id, slug);
    console.log(`  [${i + 1}/${clients.length}] ${c.name} — ${Math.round((Date.now() - started) / 1000)}s`);
    return parsed;
  });

  const findings = [];
  const rows = [];

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const pdf = pdfs[i] || {};
    const email = EMAIL_PAYLOADS[c.name] || {};

    // ---- Google
    let gApi = null;
    if (c.google_ads_customer_id) {
      try {
        const customer = googleApi.Customer({
          customer_id: c.google_ads_customer_id.replace(/-/g, ''),
          refresh_token: settings.google_ads_manager_refresh_token,
          login_customer_id: managerId,
        });
        gApi = await googleApiTotals(customer);
      } catch (e) {
        findings.push(`${c.name}: Google API query failed — ${e.message}`);
      }
    }

    const { data: gStoredRow } = await supabase
      .from('campaign_summaries')
      .select('total_spend,total_impressions,total_clicks')
      .eq('client_id', c.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', PERIOD.start)
      .maybeSingle();
    const gStored = gStoredRow
      ? {
          spend: gStoredRow.total_spend,
          impressions: gStoredRow.total_impressions,
          clicks: gStoredRow.total_clicks,
        }
      : null;

    // ---- Meta
    const metaToken = c.system_user_token || c.meta_access_token;
    let mApi = null;
    if (c.ad_account_id && metaToken) {
      const r = await metaApiTotals(metaToken, c.ad_account_id);
      if (r.error) findings.push(`${c.name}: Meta API query failed — ${r.error}`);
      else mApi = r;
    }

    const { data: mStoredRow } = await supabase
      .from('campaign_summaries')
      .select('total_spend,total_impressions,total_clicks')
      .eq('client_id', c.id)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .eq('summary_date', PERIOD.start)
      .maybeSingle();
    const mStored = mStoredRow
      ? {
          spend: mStoredRow.total_spend,
          impressions: mStoredRow.total_impressions,
          clicks: mStoredRow.total_clicks,
        }
      : null;

    const check = (platform, metric, api, stored, pdfVal, emailVal) => {
      const pairs = [
        ['api vs stored', api, stored],
        ['stored vs pdf', stored, pdfVal],
        ['stored vs email', stored, emailVal],
      ];
      for (const [label, a, b] of pairs) {
        if (a === null || a === undefined || b === null || b === undefined) continue;
        if (!agrees(a, b)) {
          findings.push(
            `${c.name} · ${platform} ${metric} · ${label}: ${money(a)} vs ${money(b)}`
          );
        }
      }
    };

    check('Google', 'spend', gApi?.spend, gStored?.spend, pdf.google?.spend, email.google?.spend);
    check('Google', 'impressions', gApi?.impressions, gStored?.impressions, pdf.google?.impressions, email.google?.impressions);
    check('Google', 'clicks', gApi?.clicks, gStored?.clicks, pdf.google?.clicks, email.google?.clicks);
    // Meta account insights report all clicks; the report uses link clicks, so
    // only spend and impressions are comparable against the API.
    check('Meta', 'spend', mApi?.spend, mStored?.spend, pdf.meta?.spend, email.meta?.spend);
    check('Meta', 'impressions', mApi?.impressions, mStored?.impressions, pdf.meta?.impressions, email.meta?.impressions);
    check('Meta', 'clicks', null, mStored?.clicks, pdf.meta?.clicks, email.meta?.clicks);

    if (Array.isArray(email.missingPlatforms) && email.missingPlatforms.length > 0) {
      findings.push(`${c.name}: email build reports missing platforms — ${email.missingPlatforms.join(', ')}`);
    }
    if (c.google_ads_customer_id && !pdf.google) {
      findings.push(`${c.name}: PDF has no Google Ads section`);
    }
    if (c.google_ads_customer_id && !email.google) {
      findings.push(`${c.name}: email payload has no Google Ads block`);
    }

    rows.push({
      client: c.name,
      google: { api: gApi, stored: gStored, pdf: pdf.google || null, email: email.google || null },
      meta: { api: mApi, stored: mStored, pdf: pdf.meta || null, email: email.meta || null },
    });
  }

  console.log('\n================ GOOGLE ADS — July 2026 spend (zł) ================');
  console.log(['client', 'api', 'stored', 'pdf', 'email'].join(' | '));
  for (const r of rows) {
    console.log(
      [
        r.client,
        money(r.google.api?.spend),
        money(r.google.stored?.spend),
        money(r.google.pdf?.spend),
        money(r.google.email?.spend),
      ].join(' | ')
    );
  }

  console.log('\n================ GOOGLE ADS — clicks ================');
  console.log(['client', 'api', 'stored', 'pdf', 'email'].join(' | '));
  for (const r of rows) {
    console.log(
      [
        r.client,
        count(r.google.api?.clicks),
        count(r.google.stored?.clicks),
        count(r.google.pdf?.clicks),
        count(r.google.email?.clicks),
      ].join(' | ')
    );
  }

  console.log('\n================ META ADS — July 2026 spend (zł) ================');
  console.log(['client', 'api', 'stored', 'pdf', 'email'].join(' | '));
  for (const r of rows) {
    console.log(
      [
        r.client,
        money(r.meta.api?.spend),
        money(r.meta.stored?.spend),
        money(r.meta.pdf?.spend),
        money(r.meta.email?.spend),
      ].join(' | ')
    );
  }

  console.log('\n================ FINDINGS ================');
  if (findings.length === 0) {
    console.log('None — api, stored, pdf and email agree for every client.');
  } else {
    findings.forEach((f) => console.log(' - ' + f));
  }

  fs.writeFileSync('/tmp/final-compare-2026-07.json', JSON.stringify({ rows, findings }, null, 2));
  console.log('\nWrote /tmp/final-compare-2026-07.json');
})();
