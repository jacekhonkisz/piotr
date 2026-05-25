# Metrics admin area — developer handbook

This document describes the **admin metrics configuration** experience in the product. It is written for developers who need full context on routing, layout, data flow, features, UX/UI patterns, and accessibility.

> **Route naming:** In the codebase and navigation, this area lives at **`/admin/metrics-config`**. There is **no** separate route named `/metrics-admin`; if product or docs refer to “metrics admin”, they mean this page. The top admin nav shows the label **“Metryki”** (see `AdminNavbar`).

---

## Table of contents

1. [Purpose and audience](#1-purpose-and-audience)
2. [Route, navigation, and access control](#2-route-navigation-and-access-control)
3. [High-level architecture](#3-high-level-architecture)
4. [Data model](#4-data-model)
5. [Backend APIs](#5-backend-apis)
6. [Page layout (visual map)](#6-page-layout-visual-map)
7. [Screen regions — detailed UX/UI](#7-screen-regions--detailed-uxui)
8. [Child components](#8-child-components)
9. [User flows and edge cases](#9-user-flows-and-edge-cases)
10. [Live updates and client surfaces](#10-live-updates-and-client-surfaces)
11. [Accessibility (a11y) audit](#11-accessibility-a11y-audit)
12. [File reference](#12-file-reference)
13. [Extension points for developers](#13-extension-points-for-developers)

---

## 1. Purpose and audience

### What this page does

- Lets an **administrator** configure, **per client** and **per advertising platform (Meta vs Google)**:
  - **Visibility** of each metric/dimension row within predefined **sections** (dashboard KPIs, charts, report summary, funnel, contact, campaign table, breakdown tables, etc.).
  - **Display order** within each section (drag-and-drop reorder).
  - **Custom display names** (`customName`), falling back to Polish defaults from the config/registry.
- Lets the admin **enable or disable** whether the client sees **Meta** metrics and/or **Google** metrics at all (`meta_enabled`, `google_enabled` on `client_dashboard_config`).
- Shows **connection status** (Meta/Google account linked vs not) as informational badges; toggles still allow “metrics visible” even if API is disconnected (UX choice — admin may prepare config before connection).
- Opens a **secondary modal** for API-backed discovery: snapshot values, dynamic conversion keys, and bulk “use on Meta / Google” toggles per metric key.
- Optionally shows a **client-facing preview** using **sample numbers** (not live client data) so layout and labels can be validated before save.

### Who uses it

- Users with `profiles.role === 'admin'` only. Others are redirected to `/dashboard`.

---

## 2. Route, navigation, and access control

| Item | Detail |
|------|--------|
| **URL** | `/admin/metrics-config` |
| **Page component** | `src/app/admin/metrics-config/page.tsx` (`MetricsConfigPage`) |
| **Shell** | `'use client'` Next.js App Router client page |
| **Top bar** | `AdminNavbar` — metrics item active when `pathname` includes `/metrics-config` |
| **Auth** | `useAuth()` from `AuthProvider`: waits for `authLoading`, then loads data only if `profile.role === 'admin'` |
| **Non-admin** | `useEffect` redirects to `/dashboard`; render returns `null` if not admin after load |
| **Loading** | Full-page `AdminLoading` while `authLoading \|\| loading` |

### Security model (important)

- **Browser → API:** All fetches use `Authorization: Bearer <supabase_session_access_token>`.
- **API → Supabase:** Admin routes use **service role** server client and verify the JWT user + `profiles.role === 'admin'`.
- **Tenant scope:** List and single-client updates are limited to clients where `clients.admin_id === current_user.id` (see admin metrics-config routes).

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser: /admin/metrics-config (MetricsConfigPage)              │
│  - State: metaMetrics[], googleMetrics[], metaEnabled,           │
│           googleEnabled, activePlatform, selectedClientId, …   │
└───────────────┬─────────────────────────────────────────────────┘
                │ GET /api/admin/metrics-config
                │ PUT /api/admin/metrics-config/:clientId
                │ POST /api/admin/metrics-config/bulk
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase: client_dashboard_config                                │
│  - meta_metrics_config (jsonb)                                    │
│  - google_metrics_config (jsonb)                                  │
│  - metrics_config (legacy; kept in sync with Meta on PUT)         │
│  - meta_enabled, google_enabled                                    │
│  - updated_at                                                     │
└───────────────┬─────────────────────────────────────────────────┘
                │ mergeWithDefaults + normalizeConfigForPlatform
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Client app: dashboard, reports, tables, PDF, email             │
│  - useMetricsConfig(clientId, platform)                           │
│  - Realtime + CustomEvent metrics-config-updated                 │
└─────────────────────────────────────────────────────────────────┘
```

**Source of truth for defaults:** `src/lib/default-metrics-config.ts` (built from `src/lib/metric-registry.ts` for static keys). Saved rows in DB **override** defaults per `section::key`.

---

## 4. Data model

### `MetricConfigItem` (persisted shape)

Defined in `default-metrics-config.ts` (conceptually):

| Field | Role |
|-------|------|
| `key` | Stable identifier, e.g. `totalSpend`, `campaign_name`, `dyn_meta_*` |
| `section` | One of `MetricSection` — groups where the row applies |
| `defaultName` | Polish default label for that section (may differ per section via overrides) |
| `customName` | Admin override; `null` means “use default” |
| `visible` | Whether this row is active for that section |
| `order` | Sort order within the section |
| `format` | `number` \| `currency` \| `percentage` \| `text` |
| `description` | Shown under the key in the admin table |

### `MetricSection` (order on admin page)

From `metrics-config/page.tsx` constant `SECTIONS`:

1. `kpi_cards` — Dashboard top KPI cards  
2. `charts` — Dashboard comparison charts  
3. `funnel` — Report conversion funnel labels/steps  
4. `contact` — Report contact & conversion block  
5. `report_summary` — Report headline metric cards  
6. `campaign_table` — Report campaign table columns  
7. `placement_table` — Meta/Google placement-style breakdowns  
8. `demographic_breakdown` — Demographics UI  
9. `geographic_map` — Google map / geo metrics  
10. `device_table` — Google devices  
11. `keyword_table` — Google keywords  
12. `search_terms_table` — Google search terms  

Human-readable titles and help text: `SECTION_LABELS`, `SECTION_DESCRIPTIONS` in `default-metrics-config.ts`.

### Dynamic keys

- `dyn_meta_*` / `dyn_google_*` — extra conversion-like metrics discovered from APIs; merged into config only if present in saved data (`mergeWithDefaults`).

---

## 5. Backend APIs

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/admin/metrics-config` | List all admin’s clients + merged `metaMetrics` / `googleMetrics` + flags + `updatedAt` |
| `GET` | `/api/admin/metrics-config/[clientId]` | Single client detail (admin UI may refetch after save) |
| `PUT` | `/api/admin/metrics-config/[clientId]` | Upsert one client’s `meta_metrics_config`, `google_metrics_config`, flags; sets `metrics_config = metaMetrics` for legacy |
| `POST` | `/api/admin/metrics-config/bulk` | Same payload applied to **every** client where `admin_id` matches |

**Modal-only discovery (not the main list save):**

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/metrics-config/discovery?clientId=…&mode=current\|last_closed` | Live-ish snapshot for catalog + dynamic keys |

---

## 6. Page layout (visual map)

### Root structure

```
min-h-screen bg-[#F8FAFC]
├── AdminNavbar (sticky top, z-40)
└── max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6
    ├── HEADER ROW (title + global actions)
    ├── SAVE BANNERS (conditional success/error)
    └── flex flex-col lg:flex-row gap-6
        ├── SIDEBAR (lg:w-72) — client list
        └── MAIN (flex-1 min-w-0) — selected client workspace
```

### Responsive behavior

- **`< lg`:** Sidebar stacks above main; client list still usable with `max-h-[60vh] overflow-y-auto`.
- **`≥ lg`:** Two columns; sidebar `sticky top-20` so it stays in view while scrolling long metric sections.

### Brand / color language

- **Primary blue:** `#1F3D8A` — primary buttons, accents, selected client strip.
- **Meta:** blue family (`blue-600` tab, `border-l-blue-500` on section cards when Meta tab active).
- **Google:** emerald family (`emerald-600` tab, `border-l-emerald-500` on section cards when Google tab active).
- **Surfaces:** white cards on `#F8FAFC` page background; light borders `border-gray-200`.

---

## 7. Screen regions — detailed UX/UI

### 7.1 Header row

**Left cluster**

- **Back** `ArrowLeft`: navigates to `/admin` (no `aria-label` on button — a11y gap).
- **Title:** “Konfiguracja metryk” + `Settings` icon `#1F3D8A`.
- **Subtitle:** Explains per-client Meta/Google split.

**Right action cluster** (flex wrap, small gaps)

| Control | Behavior | Disabled when |
|---------|----------|-----------------|
| **Podgląd klienta** | Toggles `showPreview`; label flips to “Ukryj podgląd” | Never |
| **Przywróć domyślne** | `window.confirm` then replaces **active platform’s** metrics array with `[...DEFAULT_METRICS_CONFIG]` (full default set for both sections in that array) | Never |
| **Zastosuj do wszystkich** | `POST /api/admin/metrics-config/bulk` with current `metaMetrics`, `googleMetrics`, flags | `saving \|\| !hasChanges` |
| **Zapisz** | `PUT` selected client | `saving \|\| !hasChanges` |

**Save feedback**

- Success: green banner ~3s.
- Error: red banner ~4s.
- After successful save: `window.dispatchEvent(new CustomEvent('metrics-config-updated', { detail: { clientId, applyToAll } }))` then refetch list.

### 7.2 Client sidebar

- **Card:** `bg-white rounded-xl border shadow-sm sticky top-20`.
- **Header:** “Klienci” + `Users` icon.
- **List:** Each row is a **`<button type="implicit">`** (actually no `type` set — defaults to `submit` if inside form; here it’s fine as not in `<form>`).

**Per-client row content**

- `User` icon + **name** (truncate) + **email** (truncate).
- **Pills:** Meta / Google with dot color — connected vs disconnected.
- **“Zmieniono:”** localized `pl-PL` date from `config.updatedAt` if set.

**Selection behavior**

- `handleClientChange`: if `hasChanges`, **`window.confirm`** before switching; on confirm loads that client’s merged configs from in-memory `clients` state.

**Visual selected state**

- `bg-[#EEF4FF] border-l-2 border-l-[#1F3D8A]` vs `hover:bg-gray-50`.

### 7.3 Main workspace — empty state

If no `selectedClient` (edge: empty client list): centered card “Wybierz klienta” with instructions.

### 7.4 Client header card (white panel)

- **Title:** client name.
- **Dirty indicator:** amber “• Niezapisane zmiany” when `hasChanges`.
- **Button:** “Dane API i wykresy” opens `MetricsConfigurationModal`.
- **Email** line below title.

### 7.5 Platform enable cards (grid 1×2 on small, 2 cols on `sm+`)

Two cards: **Meta Ads** | **Google Ads**.

Each card:

- Brand icon in rounded square; connection line: `PlugZap` + green “Połączono z API” vs `Plug` + gray “Brak połączenia”.
- **Toggle:** `ToggleRight` / `ToggleLeft` — only `title` attribute for tooltip (“Wyłącz Meta” / …). **Not** a native checkbox; **no** `aria-pressed` — a11y gap for screen readers.
- Footer copy switches between “widoczne” / “ukryte” for the client.

**Styling:** thick `border-2` + tinted background when enabled (`blue` / `emerald`).

### 7.6 Platform tabs

Segmented control style: `flex gap-1 bg-white rounded-xl border p-1.5`.

- **Meta tab:** active = `bg-blue-600 text-white`; inactive shows Meta icon in `text-blue-500`.
- **Google tab:** active = `bg-emerald-600 text-white`.
- **Badge “wyłączone”** when `!metaEnabled` / `!googleEnabled` on respective tab.

**Note:** Tab switches **only** `activePlatform`; it does **not** auto-disable editing of the other platform’s array — both arrays remain in memory; save sends both.

### 7.7 Client preview panel (conditional)

When `showPreview`:

- Blue-tinted header explains preview uses **current unsaved** changes.
- Body: `ClientViewPreview` with callbacks that mutate `activeMetrics` and set `hasChanges`.

### 7.8 Section accordion list

For each `section` in `SECTIONS`:

**Collapsed header button** (full width)

- Chevron `ChevronDown` / `ChevronRight`.
- Title = `SECTION_LABELS[section]`.
- Subtitle = `SECTION_DESCRIPTIONS[section]`.
- Right pill: `{visibleCount}/{sectionMetrics.length} widocznych`.

**Card chrome**

- `border-l-4` accent: blue if Meta tab active, emerald if Google tab active.

**Expanded body**

1. **Column header row** (non-interactive labels): drag spacer | Wyświetlana nazwa | Klucz metryki | Widoczna | Akcje  
   - Grid: `grid-cols-[auto_1fr_1fr_auto_auto]` — on very narrow screens horizontal scroll may be needed (no explicit `overflow-x-auto` on this inner grid — potential UX issue).

2. **Rows** (default first **6** per section, expandable):

   - **Drag handle:** `GripVertical` — entire row `draggable`; reorder only within same `section`.
   - **Drop highlight:** `bg-blue-50 border-t-2 border-t-blue-400` on drag-over target.
   - **Hidden rows:** `opacity-60` on the whole row when `!visible`.

   **Name column**

   - View mode: `customName || defaultName` + blue pill “niestandardowa” if custom; second line “Domyślna: …” when custom.
   - Edit mode: text `input` with **Enter** confirm, **Escape** cancel; adjacent check / X micro-buttons.

   **Key column**

   - `<code>` chip with `metric.key`.
   - Description line (muted, truncate).

   **Visibility column**

   - Single button: green `Eye` vs gray `EyeOff` — toggles visibility for that section+key.

   **Actions column**

   - Pencil → `startEditName`.
   - If custom: `RotateCcw` on row resets **only** that row’s `customName` to `null`.

3. **“Pokaż wszystkie”** footer button if more than 6 rows: toggles `showAllRows` set per section; full-width bar colored by active platform (`bg-blue-600` / `bg-emerald-600`).

---

## 8. Child components

### 8.1 `MetricsConfigurationModal`

**Opens from:** “Dane API i wykresy” button.  
**Props:** `open`, `onClose`, `clientId`, `clientName`, `metaMetrics`, `googleMetrics`, setters, `onMarkDirty`, `onSave`, `saving`.

**Behavior summary**

- Fetches `/api/metrics-config/discovery` with `mode` = `current` | `last_closed`.
- Large table of metric keys with Meta/Google numeric columns, usage toggles, per-section checkboxes (nested `<details>`).
- Uses `getRegistryField` to show **metryka** vs **wymiar** badge; filters section checkboxes to registry-supported sections for that key.
- Respects `isMetricSupportedForPlatform` so Google-only dimensions cannot be toggled on for Meta and vice versa.
- **Save** in modal calls parent `onSave` (which runs main page `saveConfig(false)`).

**UX:** Filters for used/unused metrics; platform view `both` | `meta` | `google`; period toggle; error and API-failure banners.

### 8.2 `ClientViewPreview`

**Purpose:** Approximate **client dashboard + report** layout with **hardcoded sample** numbers (`SAMPLE` object) and sample campaign rows — **not** live API data.

**Interactions**

- **Drag** reorder within section → `onReorder`.
- **Double-click** label → inline edit → `onRename`.
- **Eye badge** → `onToggleVisibility`.

**Sections rendered in preview**

- Dashboard: KPI cards, chart cards, `DynamicAnimatedMetricsCharts` when visible chart metrics exist after `filterChartMetricsWithRealData`.
- Report: fake header, report summary cards, funnel cards + `ConversionFunnel` if any funnel metric visible, contact cards, campaign column preview.

**Gap vs main admin table:** Preview `openSections` state only initializes subset keys; breakdown sections from main page (`placement_table`, …) are **not** shown in this preview component as of current code — developers extending breakdowns should align preview if product requires parity.

---

## 9. User flows and edge cases

| Flow | Behavior |
|------|----------|
| First load with clients | Selects first client automatically and hydrates Meta/Google arrays from API response |
| Switch client with dirty state | `confirm` — discard or cancel |
| Reset to defaults | Confirms; only affects **active platform** metrics state (full `DEFAULT_METRICS_CONFIG` assigned to that platform’s setter — note: contains **all** sections, not filtered by platform) |
| Save single | PUT + event + refetch |
| Save bulk | POST to all clients under admin + same |
| Drag row | Only within same `section`; updates `order` indices contiguously |
| Edit name to equal default | Stores `customName: null` |
| Preview while dirty | Preview reads **in-memory** state — can differ from DB until save |

---

## 10. Live updates and client surfaces

When admin saves successfully, the app dispatches:

```ts
window.dispatchEvent(new CustomEvent('metrics-config-updated', { detail: { clientId, applyToAll } }));
```

`useMetricsConfig` (client dashboard/reports) listens and **invalidates cache** + refetches. It also subscribes to Supabase Realtime on `client_dashboard_config` for `client_id=eq.{id}`.

**Cache:** In-memory `Map` per `clientId`, TTL **5 minutes** — realtime/event clears entry before refetch.

---

## 11. Accessibility (a11y) audit

### What is already reasonable

- **Semantic structure:** Main page uses headings (`h1`, `h2`, `h3`) in logical places.
- **Expandable sections:** Section headers are `<button>` elements (good for keyboard activation).
- **Focus rings:** Inline rename `<input>` uses `focus:ring-2` etc.
- **Keyboard in rename:** Enter / Escape supported in main table and in modal-related inputs where implemented.
- **Color + icon:** Visibility toggle uses both color and `Eye` / `EyeOff` icons (not color-only).
- **Truncation:** Long names/emails use `truncate` + `min-w-0` to avoid broken layout (helps zoom users indirectly).

### Gaps and recommended fixes (for dev handoff)

| Area | Issue | Suggested remediation |
|------|--------|-------------------------|
| **Icon-only buttons** | Back, visibility, pencil, reset, toggles often lack accessible **names** exposed to AT | Add `aria-label` (Polish) to every icon-only control; for toggles use `aria-pressed={true/false}` or native `<input type="checkbox" role="switch">` |
| **Platform toggles** | Custom Lucide icons, no role/state | Prefer `<button type="button" aria-pressed={metaEnabled} aria-label="Włącz lub wyłącz metryki Meta dla klienta">` |
| **Client list buttons** | No `aria-current="true"` on selected client | Set on selected row for SR context |
| **Drag-and-drop** | Not announced; not keyboard-operable | Provide “Move up/down” buttons as alternative; `aria-grabbed` deprecated — use live region or instructions |
| **Modal** | Verify `role="dialog"`, `aria-modal`, `aria-labelledby` — **MetricsConfigurationModal** has dialog attributes per code review | Ensure **focus trap** + **focus return** on close; first focusable on open |
| **Tables in section body** | Header row is `<div>` grid, not `<table>` | Consider `<table>` with `<th scope="col">` for SR column navigation |
| **Save buttons** | Disabled state may confuse SR | `aria-disabled` + `title` explaining “Brak zmian” or remove disabled and show toast |
| **Confirm dialogs** | `window.confirm` blocks main thread and is not styled | Replace with accessible in-app modal (`role="alertdialog"`) |
| **Preview** | `EditableLabel` uses `<span>` with `onDoubleClick` — not keyboard discoverable | Add “Edytuj nazwę” button with `aria-label`; expose rename in context menu |
| **Motion** | `ClientViewPreview` / charts may animate | Respect `prefers-reduced-motion` in Framer Motion consumers |
| **Language** | UI Polish | Set `lang="pl"` on `<html>` in root layout if not already |

### WCAG mapping (informal)

- **1.3.1 Info and Relationships:** Improve table semantics and heading levels inside modals.
- **2.1.1 Keyboard:** DnD rows need non-pointer alternative.
- **2.4.7 Focus Visible:** Ensure all interactive elements keep visible focus (some `hover:` only styles).
- **4.1.2 Name, Role, Value:** Icon buttons and custom toggles need roles/labels/pressed states.

---

## 12. File reference

| Path | Responsibility |
|------|------------------|
| `src/app/admin/metrics-config/page.tsx` | Main UI, state, save/reset/drag, preview toggle, modal mount |
| `src/components/AdminNavbar.tsx` | Nav link to `/admin/metrics-config`, active state |
| `src/components/MetricsConfigurationModal.tsx` | Discovery table, API snapshots, dynamic keys, platform rules |
| `src/components/ClientViewPreview.tsx` | Simulated client UI, sample data, preview interactions |
| `src/lib/default-metrics-config.ts` | Sections, defaults, merge, visibility/name helpers |
| `src/lib/metric-registry.ts` | Typed registry: platforms, sections, aggregation hints |
| `src/lib/useMetricsConfig.ts` | Client-side fetch, cache, realtime, `metrics-config-updated` |
| `src/app/api/admin/metrics-config/route.ts` | GET list |
| `src/app/api/admin/metrics-config/[clientId]/route.ts` | GET/PUT one |
| `src/app/api/admin/metrics-config/bulk/route.ts` | POST all clients |
| `src/app/api/metrics-config/route.ts` | Client + admin GET for merged configs |
| `src/app/api/metrics-config/discovery/route.ts` | Discovery snapshots |

---

## 13. Extension points for developers

1. **New section:** Add to `MetricSection` type in `metric-registry.ts` / `default-metrics-config.ts`, extend `SECTIONS` in `metrics-config/page.tsx`, add `SECTION_LABELS` + `SECTION_DESCRIPTIONS`, wire consumer UI (reports, PDF, email).
2. **New metric key:** Add to `REGISTRY_METRICS` with `platforms` + `sections`; ensure snapshot/builders populate key if discovery should show it.
3. **Preview parity:** Update `ClientViewPreview` sections and `SAMPLE` / `ROWS` if preview must reflect new blocks.
4. **Admin-only analytics:** Could log save events or diff configs — not present today.

---

## Document metadata

- **Generated for:** Handoff to developers working on “metrics admin” / **Konfiguracja metryk**.
- **Canonical route:** `/admin/metrics-config`.
- **Related nav label:** “Metryki” in `AdminNavbar`.

If product marketing insists on the slug **`/metrics-admin`**, that would be a **new route** (redirect or alias) — it does not exist in the repository at the time of writing.
