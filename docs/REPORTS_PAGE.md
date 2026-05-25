# Client Reports (“Raporty”) — developer handbook

This document describes the **client-facing Reports** experience: routing, layout, UX/UI, data flow, platform differences (Meta vs Google), metrics configuration, PDF export, and how it ties into admin tooling.

> **Companion docs:** Metric visibility and labels are configured in **`/admin/metrics-config`** — see [`METRICS_ADMIN_PAGE.md`](./METRICS_ADMIN_PAGE.md). PDF HTML structure is generated server-side — see [`report-template.md`](./report-template.md) for historical PDF notes; the live generator is `src/app/api/generate-pdf/route.ts`.

---

## Table of contents

1. [Purpose and audience](#1-purpose-and-audience)
2. [Routes, navigation, and access](#2-routes-navigation-and-access)
3. [High-level architecture](#3-high-level-architecture)
4. [Page layout (visual map)](#4-page-layout-visual-map)
5. [Toolbar and global controls](#5-toolbar-and-global-controls)
6. [Core report sections](#6-core-report-sections)
7. [Platform-specific breakdown sections](#7-platform-specific-breakdown-sections)
8. [Data model and fetching](#8-data-model-and-fetching)
9. [Metrics configuration on reports](#9-metrics-configuration-on-reports)
10. [Year-over-year (YoY) comparisons](#10-year-over-year-yoy-comparisons)
11. [PDF export](#11-pdf-export)
12. [State management and loading](#12-state-management-and-loading)
13. [Localization and formatting](#13-localization-and-formatting)
14. [Backend APIs](#14-backend-apis)
15. [File reference](#15-file-reference)
16. [Extension points for developers](#16-extension-points-for-developers)
17. [Known quirks and troubleshooting](#17-known-quirks-and-troubleshooting)

---

## 1. Purpose and audience

### What this page does

The **Raporty** screen is the primary **performance report** for hotel/resort clients. It aggregates advertising data for a selected period and platform, then presents:

- **Summary KPIs** (spend, impressions, clicks, CTR, CPC, optional conversion totals)
- **Online conversion funnel** (booking steps → reservations → value / ROAS)
- **Contact & offline-style metrics** (email, phone, reservations, Belmonte offline estimates)
- **Campaign-level table**
- **Meta-only:** placement rankings + demographic breakdown (tabs)
- **Google-only:** devices, Poland region map, top cities, demographics, keywords, search terms (stacked sections)

Users can switch **monthly / weekly / all-time / custom** ranges, toggle **Meta vs Google** when both are connected, **refresh** live data, and **download a PDF** that mirrors the on-screen layout.

### Who uses it

| Role | Access | Notes |
|------|--------|-------|
| **Client** | `/reports` | Sees own `clients` row via auth |
| **Admin** | `/reports?clientId=…` | `ClientSelector` + “Powrót do Admina” |
| **Dashboard link** | `/dashboard` → “Szczegółowe raporty” | Same data stack as reports |

Language: **Polish** UI copy. Currency: **PLN** (`pl-PL` formatting).

---

## 2. Routes, navigation, and access

| Route | File | Component | Role |
|-------|------|-----------|------|
| **`/reports`** | `src/app/reports/page.tsx` | `ReportsPage` → `ReportsPageContent` | **Main report UI** (this doc) |
| **`/reports/[id]`** | `src/app/reports/[id]/page.tsx` | `IndividualReportPage` | Legacy/stored `reports` rows or `live-data-*` IDs — simpler layout, **not** the rich UI |
| **`/reports/page-optimized.tsx`** | — | `OptimizedReportsPage` | Experimental Meta-only page; **not** the default route |

**Entry points**

- `src/app/dashboard/page.tsx` — navigates to `/reports`
- `src/app/admin/page.tsx` — `/reports?clientId=…`
- `src/app/pdf-preview/page.tsx` — back link to `/reports`

**Auth**

- `useAuth()` from `AuthProvider`; page waits for session + client resolution
- API calls use `Authorization: Bearer <supabase_access_token>`

**Alternate / unused UIs** (do not confuse with production `/reports`)

- `UnifiedReportView`, `MonthlyReportView`, `ClientReport` — older patterns
- `AdsDataToggle` — imported on reports page but **not rendered** (inline Meta/Google toggle is used instead)

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser: /reports (ReportsPageContent)                                    │
│  State: viewType, selectedPeriod, activeAdsProvider, reports{}, …        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
│ WeeklyReport  │     │ MetaAdsTables   │     │ GoogleAdsTables         │
│ View          │     │ (Meta only)     │     │ (Google only)           │
│ KPI+funnel+   │     │ placements +    │     │ devices, map, cities,   │
│ contact+      │     │ demographics    │     │ demographics, keywords│
│ campaigns     │     └────────┬────────┘     └────────────┬────────────┘
└───────┬───────┘              │                           │
        │                      └───────────┬───────────────┘
        │                                  ▼
        │              useMetricsConfig(clientId, platform)
        │                                  │
        ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  fetchReportDataUnified → StandardizedDataFetcher (Meta)                 │
│                        → GoogleAdsStandardizedDataFetcher (Google)       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/fetch-live-data          (Meta campaigns + conversions)       │
│  POST /api/fetch-google-ads-live-data (Google + googleAdsTables blob)    │
│  POST /api/fetch-meta-tables        (placements, demographics)         │
│  POST /api/year-over-year-comparison (YoY badges)                        │
└─────────────────────────────────────────────────────────────────────────┘

PDF path (parallel contract):
  InteractivePDFButton → POST /api/generate-pdf
    → same fetchers + report-metric-contract + Puppeteer HTML
```

**Single source of truth for metric definitions:** `src/lib/report-metric-contract.ts` (used by PDF, email, validators). UI adapters should not invent alternate CTR/CPC/conversion rules.

---

## 4. Page layout (visual map)

Top-to-bottom order on `/reports` (max content width ~1400px in `WeeklyReportView`):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                    │
│  [Client name dropdown]  DEV MODE (dev only)                              │
│  Title: "Raporty" • subtitle: Meta Ads|Google Ads • Miesięczne|…         │
│  Ostatnia aktualizacja • Powrót do Admina / Dashboard                     │
├──────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR                                                                   │
│  [Miesięczny][Tygodniowy][Cały Okres][Własny Zakres]  [Odśwież][PDF]     │
│  ◀ [ maj 2026 ▼ ] ▶                    [ Meta Ads | Google Ads ]         │
│  (optional) Dane na żywo — current month, development only                │
├──────────────────────────────────────────────────────────────────────────┤
│ WeeklyReportView                                                          │
│  ┌─ Report header ─────────────────────────────────────────────────────┐ │
│  │ Raport - Miesiąc / Tydzień • date range • N kampanii                │ │
│  ├─ Podstawowe Metryki (grid of MetricCards) ──────────────────────────┤ │
│  ├─ Konwersje Online (ConversionFunnel) ───────────────────────────────┤ │
│  ├─ Kontakt & Konwersje (+ offline block when configured) ─────────────┤ │
│  └─ Szczegóły Kampanii (HTML table) ───────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ MetaAdsTables OR GoogleAdsTables (sibling, not inside WeeklyReportView)   │
│  Meta: tabbed placements | demographics                                   │
│  Google: devices → regiony → cities → demografia → keywords → terms      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Design system (observed in code)**

| Token | Usage |
|-------|--------|
| Page background | Light gray (`bg-gray-50` / slate surfaces) |
| Cards | White, `border-slate-200`, rounded-lg, subtle shadow on actions |
| Primary actions | `bg-slate-900` / `bg-slate-800` (active tabs, PDF) |
| Active filter pill | `bg-slate-900 text-white` |
| Inactive filter | White + `border-slate-200` |
| Success / live | Green strip (`bg-green-50`, pulsing dot) — **dev + current month only** |
| Typography | Section titles `text-xl font-semibold text-slate-900`; labels uppercase in tables |
| Icons | `lucide-react` (Calendar, RefreshCw, BarChart3, Target, etc.) |
| Motion | `framer-motion` on some cards/tables |

---

## 5. Toolbar and global controls

**Implementation:** `ReportsPageContent` in `src/app/reports/page.tsx` (~3685–3940).

### Time range (`viewType`)

| Value | Polish label | Period selection | Data notes |
|-------|----------------|------------------|------------|
| `monthly` | Miesięczny | `<select>` + chevrons, period id `YYYY-MM` | Default view |
| `weekly` | Tygodniowy | ISO week ids `YYYY-Wnn` | Uses `week-utils` + `date-range-utils` |
| `all-time` | Cały Okres | No period picker | **Last 37 months** (Meta API limit); yellow warning banner |
| `custom` | Własny Zakres | Start/end `<input type="date">` + “Generuj Raport” | Bypasses cache on fetch/PDF |

Handlers: `handleViewTypeChange`, `loadPeriodData`, `loadPeriodDataWithClient`, `generateCustomReport`.

### Period navigation

- `availablePeriods` — list built when client loads
- `selectedPeriod` — key into `reports` state map
- Prev/next buttons skip loading if `reports[periodId]` already cached

### Actions

| Control | Behavior |
|---------|----------|
| **Odśwież** | `handleRefresh()` → `loadPeriodDataWithClient(..., forceFresh: true)` |
| **Pobierz PDF (Meta + Google)** | `InteractivePDFButton` — label is generic; PDF uses **active** platform from client config / request body |
| **Meta Ads / Google Ads** | Shown only if client has **both** credentials; `activeAdsProvider` triggers full reload |

### Header metadata

- Subtitle shows `Meta Ads` or `Google Ads` + period type in Polish
- “Ostatnia aktualizacja” uses `new Date().toLocaleString('pl-PL')` (page load time, not API timestamp)
- Admin: `ClientSelector` in header when `profile.role === 'admin'`

### Development-only

- **DEV MODE** toggle and orange dev PDF button (`generateDevReport`, Ctrl+Shift+D)
- **“Dane na żywo”** green strip: `NODE_ENV === 'development'` **and** current calendar month

---

## 6. Core report sections

**Component:** `src/components/WeeklyReportView.tsx`  
**Config hook:** `useMetricsConfig(clientId, platform)` — sections `report_summary`, `funnel`, `contact`, `campaign_table`.

### 6.1 Report header

- Title derived from `viewType` (e.g. “Raport - Miesiąc”)
- Date range from `report.date_range_start` / `date_range_end`
- Campaign count with Polish pluralization (`polishCampaignNounAfterCount`)

### 6.2 Podstawowe Metryki

**Section key:** `report_summary`

| Metric key | Default label | Format |
|------------|---------------|--------|
| `totalSpend` | Wydatki | PLN |
| `totalImpressions` | Wyświetlenia | compact K/M |
| `totalClicks` | Kliknięcia | compact K/M |
| `averageCtr` | CTR | % |
| `averageCpc` | CPC | PLN |
| `reservations` | Rezerwacje | integer |
| `reservation_value` | Wartość rezerwacji | PLN |
| `total_conversion_value` | Łączna wartość konwersji | PLN |
| `roas` | ROAS | `Nx` |

**UI:** `MetricCard` (same file) — title, value, optional tooltip (`HelpCircle`), optional YoY badge (“rok do roku”) from `useYearOverYearComparison`.

**Aggregation:** Campaign rows summed for spend/impressions/clicks; CTR/CPC derived via `ctrPercentFromStats` / spend÷clicks where applicable.

### 6.3 Konwersje Online

**Component:** `src/components/ConversionFunnel.tsx`  
**Section key:** `funnel`

Visual: 4-step inverted trapezoid funnel + 2 bottom summary cards.

| Step | Meta default label | Google default label |
|------|-------------------|----------------------|
| `booking_step_1` | Wyszukiwania | Booking step 1 |
| `booking_step_2` | Wyświetlenia zawartości | Booking step 2 |
| `booking_step_3` | Zainicjowane przejścia do kasy | Booking step 3 |
| `reservations` | Ilość rezerwacji | (same) |

Bottom cards: `total_conversion_value`, `roas` (labels overridable via metrics config).

**Step-to-step rate:** Each stage shows conversion % from previous step (computed inside `ConversionFunnel`).

**Data priority** (`getConversionMetric` in `WeeklyReportView`):

1. `report.conversionMetrics[metric]` if **> 0**
2. Sum of `campaigns[].metric`
3. Fallback `0`

Icons: ShoppingCart, CreditCard, CheckCircle, Calendar (`lucide-react`).

### 6.4 Kontakt & Konwersje

**Section key:** `contact`

Typical visible metrics:

- `email_contacts`, `click_to_call`
- `reservations`, `cost_per_reservation`
- `total_conversion_value`
- Offline block: `offline_reservations`, `offline_value`, `total_value_with_offline`, `cost_percentage`

**Belmonte / PBM offline model:** `src/lib/offline-reservation-estimate.ts` — `isBelmonteClient`, `getBelmontePotentialOfflineValue`, micro-conversion parts from Meta campaigns only.

### 6.5 Szczegóły Kampanii

**Section key:** `campaign_table`

- HTML `<table>` (not MUI DataGrid here)
- Rows: campaigns with `spend > 0`, sorted by spend descending
- Columns driven by `metricVisible('campaign_table', key)` / `metricLabel(...)`
- Campaign name may show platform/status styling

**Note:** Google breakdown tables render **below** this section in `GoogleAdsTables`, not inside the campaign table.

---

## 7. Platform-specific breakdown sections

Mounted from `ReportsPageContent` **after** `WeeklyReportView`, gated by `activeAdsProvider`.

### 7.1 Meta — `MetaAdsTables.tsx`

**Data:** `POST /api/fetch-meta-tables` or `preloadedTablesData` from parent (avoids duplicate calls when PDF prefetches).

**Tabs**

| Tab | Section keys | Content |
|-----|----------------|---------|
| Najlepsze Miejsca Docelowe | `placement_table` | Ranked placements, top 5 default, expand, CSV export |
| Wyniki Demograficzne | `demographic_breakdown` | Table + `DemographicPieCharts` |

**Placement table UX**

- Rank badges #1–#3 (gold/silver/bronze styling)
- Subtitle: “Pokazano top 5” when collapsed
- “Zobacz więcej (N więcej)” expander
- “Eksportuj CSV” — client-side CSV from visible rows
- Footer: “Źródło danych: • Live API”

**Sorting:** Placements ordered by effectiveness (spend / performance — see component sort logic).

### 7.2 Google — `GoogleAdsTables.tsx`

**Data:** `googleAdsTables` blob from `fetch-google-ads-live-data` (passed as `preloadedTablesData`).

**Stack order** (intentionally no tabs — all sections visible):

1. **Wydajność Urządzeń** — `device_table`
2. **Regiony** — `geographic_map` + `PolandRegionMap`
3. **Najlepiej konwertujące miasta** — city table (`topCitiesByClicks` logic)
4. **Demografia** — `GoogleAdsDemographicPieCharts` (gender + age pies; rows are **either** gender **or** ageRange, never both — avoids double counting)
5. **Słowa kluczowe** — `keyword_table`
6. **Wyszukiwane frazy** — `search_terms_table`

**Regiony (`PolandRegionMap.tsx`)**

- SVG choropleth of Polish voivodeships (`src/lib/poland-voivodeships.ts`)
- Metric dropdown: Wydatki / Kliknięcia / Konwersje / Wartość konwersji
- Top-5 province bars + “Zagranica” + “Nieznana lokalizacja” bucket
- `campaignTotals` prop reconciles geographic_view gaps vs campaign-level KPIs

**CSV export:** Available on several Google tables (same pattern as Meta).

---

## 8. Data model and fetching

### Per-period report object

Stored in `reports: Record<string, WeeklyReport>` on the page:

```ts
interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
  conversionMetrics?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
    reservation_value: number;
    roas: number;
    cost_per_reservation: number;
    conversion_value?: number;
    total_conversion_value?: number;
    offline_reservations?: number;
    offline_value?: number;
    // ...
  };
  // Google only — attached by fetcher:
  googleAdsTables?: { devicePerformance, geographicPerformance, ... };
}
```

**Cache key pattern:** Period id + platform (e.g. monthly `2026-05` + `google`) — see `loadPeriodDataWithClient` for `effectivePlatform` and mismatch guards.

### Fetch entry point

`fetchReportDataUnified` in `src/app/reports/page.tsx`:

| Platform | Library |
|----------|---------|
| Meta | `src/lib/standardized-data-fetcher.ts` |
| Google | `src/lib/google-ads-standardized-data-fetcher.ts` |

**Smart cache vs live**

- Normal navigation: smart cache (DB-backed) with live refresh for current periods
- **Refresh button:** forces fresh fetch (`reason` contains refresh semantics)
- **Custom range:** `bypassAllCache: true` → direct API (`fetch-live-data` / `fetch-google-ads-live-data`)

### Server-side unified pipeline (PDF, email, cron)

| Module | Role |
|--------|------|
| `src/lib/unified-report-fetcher.ts` | `fetchUnifiedReport` — one payload for downstream |
| `src/lib/report-adapters.ts` | Platform adapters → contract shape |
| `src/lib/report-metric-contract.ts` | Canonical metric rules (Meta inline_link_clicks, Google clicks, etc.) |
| `src/lib/report-payload-validator.ts` | Validation before send/generate |

### Meta conversion parsing

Documented in `report-metric-contract.ts` — e.g. `booking_step_1`: `omni_search` > `fb_pixel_search` > `search`; reservations: `omni_purchase` > `fb_pixel_purchase`. Implemented in Meta actions parser (not duplicated in UI).

---

## 9. Metrics configuration on reports

Reports respect **per-client, per-platform** JSON in `client_dashboard_config`:

- `meta_metrics_config` / `google_metrics_config`
- `meta_enabled` / `google_enabled`

**Hook:** `useMetricsConfig(clientId, 'meta' | 'google')`

```ts
getMetricName(section, key)   // customName || default Polish label
isMetricVisible(section, key)
getVisibleMetrics(section)    // ordered visible items
```

**Report-relevant sections** (`src/lib/default-metrics-config.ts`):

| Section | UI area |
|---------|---------|
| `report_summary` | Podstawowe Metryki |
| `funnel` | Konwersje Online |
| `contact` | Kontakt & Konwersje |
| `campaign_table` | Szczegóły Kampanii |
| `placement_table` | Meta placements |
| `demographic_breakdown` | Meta demographics |
| `geographic_map` | Google regiony + cities columns |
| `device_table` | Google devices |
| `keyword_table` | Google keywords |
| `search_terms_table` | Google search terms |

Defaults and merge logic: `DEFAULT_METRICS_CONFIG`, `mergeWithDefaults`, `normalizeConfigForPlatform`.

**Admin preview without save:** `MetricsConfigOverrideProvider` wraps `LiveClientView` / `ClientViewPreview` in metrics admin — not used on live `/reports`.

---

## 10. Year-over-year (YoY) comparisons

**Hook:** `src/lib/hooks/useYearOverYearComparison.ts`  
**API:** `POST /api/year-over-year-comparison`

- Compares current period to **same period previous calendar year**
- Used on `MetricCard` in `report_summary` (e.g. spend % vs last year)
- Passed to `ConversionFunnel` as `previousYear` / `yoyChanges` for funnel steps
- **Disabled** for `viewType === 'custom'` (`formatComparisonChange` returns `undefined`)
- Global dedupe cache (`globalFetchCache`) prevents duplicate API calls across remounts

---

## 11. PDF export

### Client trigger

`src/components/InteractivePDFButton.tsx`

1. Resolve Supabase session token
2. Optionally `POST /api/fetch-meta-tables` (placements/demographics for Meta sections in PDF)
3. `POST /api/generate-pdf` with `{ clientId, dateRange, ... }`
4. For **`viewType === 'custom'`**: passes `campaigns`, `totals`, `client`, `metaTables`, `bypassAllCache: true` so PDF does not read stale cache

### Server generator

`src/app/api/generate-pdf/route.ts` (~6700+ lines)

- Authenticates request
- Fetches data (same policy as UI fetchers)
- Builds HTML sections mirroring UI (Podstawowe Metryki, funnel, Kontakt, campaigns, Meta tables, Google regiony/demografia, etc.)
- Renders with **Puppeteer** + **chromium** → PDF binary
- Returns download with `Content-Disposition`

**Related automation**

- `src/lib/pdf-job-processor.ts` — background jobs
- `src/lib/automated-report-generator.ts` — scheduled/bulk
- `POST /api/send-custom-report` — email attaches PDF
- `src/app/pdf-preview/page.tsx` — HTML preview dev tool

**Label parity:** Funnel step names for Google use `getGoogleAdsFunnelStepLabels()` from `default-metrics-config.ts` so PDF matches UI.

---

## 12. State management and loading

**No Redux/Zustand** on reports. Patterns in `ReportsPageContent`:

| Mechanism | Purpose |
|-----------|---------|
| `useState` | `reports`, `selectedPeriod`, `viewType`, `activeAdsProvider`, `loadingPeriod`, `metaTablesData`, `customDateRange`, errors |
| `useRef` | `loadingRef`, `clientLoadingRef`, `initialDataLoadedRef`, `prevProviderRef` — prevent duplicate loads / races |
| `useEffect` | Auth → client → periods → load; reload on `activeAdsProvider` change |
| Derived | `selectedReport` from `reports` + `viewType` + `selectedPeriod` |
| Progressive UI | `WeeklyReportView` `isLoading` → skeleton cards, zeros instead of blocking entire page |
| Timeout | Loading watchdog (~60s) surfaces error if API hangs |

**Provider switch:** Changing Meta ↔ Google clears incompatible cached periods and reloads current period.

---

## 13. Localization and formatting

| Concern | Implementation |
|---------|----------------|
| Locale | `pl-PL` |
| Currency | `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })` |
| Large numbers | `formatNumber` — K/M suffixes in cards |
| Dates | `toLocaleDateString('pl-PL')`, month names in period select |
| Geography | `formatPolishCityName`, `formatPolishVoivodeshipName` (`polish-geo-display.ts`) |
| Campaign plural | `polishCampaignNounAfterCount` |

---

## 14. Backend APIs

| Endpoint | Method | Used for |
|----------|--------|----------|
| `/api/fetch-live-data` | POST | Meta campaigns, stats, conversions |
| `/api/fetch-google-ads-live-data` | POST | Google campaigns + `googleAdsTables` |
| `/api/fetch-meta-tables` | POST | Placements, demographics, ad relevance |
| `/api/year-over-year-comparison` | POST | YoY badges |
| `/api/generate-pdf` | POST | PDF download |
| `/api/get-report-data-only` | POST | Email JSON payload |
| `/api/reports` | GET/POST | Stored report records (legacy `[id]` page) |
| `/api/generated-reports` | — | Admin generated list |
| `/api/sent-reports/*` | — | Sent PDF archive |

All client calls should send **Bearer** token. Admin-only routes are separate (`/api/admin/...`).

---

## 15. File reference

### Pages

| Path | Description |
|------|-------------|
| `src/app/reports/page.tsx` | Main Raporty UI (~4k lines orchestration) |
| `src/app/reports/[id]/page.tsx` | Stored/live-id detail (legacy) |
| `src/app/dashboard/page.tsx` | Shares fetch patterns; links to reports |

### Core components

| Path | Description |
|------|-------------|
| `src/components/WeeklyReportView.tsx` | KPI, funnel, contact, campaign table |
| `src/components/ConversionFunnel.tsx` | Konwersje Online visualization |
| `src/components/MetaAdsTables.tsx` | Placements + demographics tabs |
| `src/components/GoogleAdsTables.tsx` | Google breakdown stack |
| `src/components/PolandRegionMap.tsx` | Poland SVG map + rankings |
| `src/components/DemographicPieCharts.tsx` | Meta demographic pies |
| `src/components/GoogleAdsDemographicPieCharts.tsx` | Google demographic pies |
| `src/components/InteractivePDFButton.tsx` | PDF download trigger |
| `src/components/ClientSelector.tsx` | Admin client picker |

### Libraries

| Path | Description |
|------|-------------|
| `src/lib/standardized-data-fetcher.ts` | Meta fetch + cache routing |
| `src/lib/google-ads-standardized-data-fetcher.ts` | Google fetch + cache routing |
| `src/lib/unified-report-fetcher.ts` | Server unified payload |
| `src/lib/report-metric-contract.ts` | Canonical metric definitions |
| `src/lib/report-adapters.ts` | Adapters to contract |
| `src/lib/useMetricsConfig.ts` | Client metrics config hook |
| `src/lib/default-metrics-config.ts` | Defaults per section |
| `src/lib/configured-report-columns.ts` | Column visibility helpers |
| `src/lib/date-range-utils.ts` | Month/week boundaries |
| `src/lib/week-utils.ts` | ISO week helpers |
| `src/lib/offline-reservation-estimate.ts` | Belmonte offline estimates |
| `src/lib/poland-voivodeships.ts` | Map SVG paths |
| `src/lib/hooks/useYearOverYearComparison.ts` | YoY hook |

### APIs

| Path | Description |
|------|-------------|
| `src/app/api/generate-pdf/route.ts` | HTML → PDF |
| `src/app/api/fetch-live-data/route.ts` | Meta live/cache |
| `src/app/api/fetch-google-ads-live-data/route.ts` | Google live/cache |
| `src/app/api/fetch-meta-tables/route.ts` | Meta breakdown tables |

### Admin / related

| Path | Description |
|------|-------------|
| `src/app/admin/metrics-config/page.tsx` | Configure what appears on reports |
| `src/components/metrics-config/TemplateReportCustomizer.tsx` | Template editor |
| `src/components/metrics-config/LiveClientView.tsx` | Sample-data layout preview |
| `docs/METRICS_ADMIN_PAGE.md` | Metrics admin handbook |

---

## 16. Extension points for developers

### Add a metric to an existing section

1. Register field in `src/lib/metric-registry.ts` (if new key).
2. Add to `DEFAULT_VISIBLE` for the section in `default-metrics-config.ts`.
3. Render in `WeeklyReportView` / `MetaAdsTables` / `GoogleAdsTables` using `metricVisible` / `metricLabel`.
4. Ensure fetcher populates the field on `campaigns` or `conversionMetrics`.
5. Update `report-metric-contract.ts` + adapter if PDF/email must include it.
6. Add HTML block in `generate-pdf/route.ts` for PDF parity.

### Add a new report section

1. Add `MetricSection` in metric registry.
2. Extend admin `TemplateReportCustomizer` section list.
3. Create UI block in `WeeklyReportView` or platform tables component.
4. Wire PDF section in `generate-pdf/route.ts`.

### Add a new breakdown table (Google)

1. Extend `googleAdsTables` in fetch route.
2. Add section to `default-metrics-config.ts`.
3. Render block in `GoogleAdsTables.tsx` (follow CSV + `useMetricsConfig` patterns).

### Custom client logic

Prefer small helpers (like `offline-reservation-estimate.ts`) over branching inside `WeeklyReportView` when possible.

---

## 17. Known quirks and troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Zeros on first paint then data appears | Progressive loading — expected; check `isLoading` |
| View type mismatch warnings in console | Period id format vs `viewType` — auto-corrected in `loadPeriodDataWithClient` |
| Google funnel shows “Booking step N” | By design; labels from `funnel` section + `platform === 'google'` |
| Meta funnel shows Polish e-commerce labels | `platform === 'meta'` defaults in `ConversionFunnel` labels prop |
| “Dane na żywo” not visible in production | Gated on `NODE_ENV === 'development'` |
| PDF ≠ screen | Custom range must pass `bypassAllCache`; check platform detection in PDF route |
| Duplicate API calls | Use `preloadedTablesData` props; check refs (`loadingRef`) |
| YoY missing | Custom view disabled; or previous year has zero data |
| All-time incomplete history | Meta 37-month API cap — warning banner shown |
| `AdsDataToggle` unused | Dead import on reports page — use inline toggle |
| Email links to `/reports/monthly/...` | Route may not exist — use `/reports` with query params |

**Debug tips**

- Enable dev panel (orange code button) for forced fresh PDF
- Compare `report-metric-contract` validation errors in server logs
- Use `/api/debug-yoy-vs-reports` when investigating YoY discrepancies

---

## Screenshot index (reference)

The following UI regions correspond to the screenshots used when authoring this doc:

1. **Full Meta monthly report** — toolbar, Podstawowe Metryki, funnel, Kontakt, campaign table  
2. **Meta placements** — Najlepsze Miejsca Docelowe tab, top 5, CSV, expand  
3. **Google monthly report** — same core sections with Google funnel labels  
4. **Google geography** — Regiony map, top cities table, Demografia pies  

Assets (workspace): `.cursor/projects/.../assets/Zrzut_ekranu_2026-05-16_*.png`

---

*Last updated: 2026-05-16 — matches codebase at `src/app/reports/page.tsx` and related components.*
