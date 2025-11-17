# 🔄 LOADING SCREENS QUICK REFERENCE TABLE

**Last Updated:** November 12, 2025

---

## 📊 ALL LOADING SCREENS AT A GLANCE

| # | Component Name | Location | Appearance | Text (Polish) | Logic | Progress Bar |
|---|----------------|----------|------------|---------------|-------|--------------|
| **STANDARDIZED COMPONENTS** |
| 1 | `DashboardLoading` | `LoadingSpinner.tsx` | Fullscreen, navy lg spinner | "Ładowanie dashboardu..." | Auth + data loading | Optional ✅ |
| 2 | `ReportsLoading` | `LoadingSpinner.tsx` | Fullscreen, navy xl spinner | "Ładowanie raportów..." | Initial page load | Optional ✅ |
| 3 | `CampaignsLoading` | `LoadingSpinner.tsx` | Fullscreen, navy lg spinner | "Ładowanie kampanii..." | Initial page load | No ❌ |
| 4 | `LoginLoading` | `LoadingSpinner.tsx` | Fullscreen white, navy lg | "Inicjalizacja..." / "Ładowanie profilu..." | Auth initialization | No ❌ |
| 5 | `AdminLoading` | `LoadingSpinner.tsx` | Fullscreen, navy lg spinner | "Ładowanie klientów..." (customizable) | Admin pages load | No ❌ |
| 6 | `DataLoading` | `LoadingSpinner.tsx` | White card, navy md spinner | "Ładowanie danych..." (customizable) | Component data load | Optional ✅ |
| 7 | `InlineLoading` | `LoadingSpinner.tsx` | Minimal, navy sm spinner | "Ładowanie..." (customizable) | Inline status | No ❌ |
| 8 | `ButtonLoading` | `LoadingSpinner.tsx` | Minimal sm, horizontal | "Ładowanie..." (customizable) | Button states | No ❌ |
| **PAGE IMPLEMENTATIONS** |
| 9 | Dashboard Page | `/dashboard/page.tsx` | Uses DashboardLoading | "Ładowanie dashboardu..." | `if (authLoading || (loading && !clientData))` | No (could add) |
| 10 | Reports Page | `/reports/page.tsx` | Uses ReportsLoading | "Ładowanie raportów..." | Auth wrapper + main load | No (could add) |
| 11 | Reports Period | `/reports/page.tsx` | Custom blue spinner inline | "Ładowanie danych miesięcznych..." | Period switching | No ❌ |
| 12 | Campaigns Page | `/campaigns/page.tsx` | Uses CampaignsLoading | "Ładowanie kampanii..." | Initial load | No ❌ |
| 13 | Admin Main | `/admin/page.tsx` | Uses AdminLoading | "Ładowanie klientów..." | Initial load | No ❌ |
| 14 | Admin Client Details | `/admin/clients/[id]` | Uses AdminLoading | "Ładowanie szczegółów klienta..." | Client data load | No ❌ |
| 15 | Admin Calendar | `/admin/calendar` | Uses AdminLoading | "Ładowanie kalendarza..." | Calendar load | No ❌ |
| 16 | Login Page | `/auth/login` | Uses LoginLoading | "Inicjalizacja..." / "Ładowanie profilu..." | Auth + profile + timeout | No ❌ |
| **COMPONENT IMPLEMENTATIONS** |
| 17 | GoogleAdsTables | `GoogleAdsTables.tsx` | White card, RefreshCw icon | "Ładowanie danych Google Ads..." | `loading || (!hasData && !error)` | No ❌ |
| 18 | GoogleAdsPerformance | `GoogleAdsPerformanceLive.tsx` | Orange RefreshCw spinner | "Ładowanie danych Google Ads..." | Data fetch + shared data | No ❌ |
| 19 | GoogleAdsPerformance (Header) | `GoogleAdsPerformanceLive.tsx` | Small inline spinner | "Ładowanie..." | Waiting for shared data | No ❌ |
| 20 | MetaPerformance | `MetaPerformanceLive.tsx` | Standard spinner | Standard loading | Data fetch | No ❌ |
| 21 | WelcomeSection | `WelcomeSection.tsx` | Skeleton (pulsing placeholders) | No text | `isLoading` prop | No ❌ |
| 22 | AnimatedMetrics | `AnimatedMetricsCharts.tsx` | Skeleton bars (3x) | No text | `isLoading` prop | No ❌ |
| 23 | DataSourceIndicator | `DataSourceIndicator.tsx` | Refresh icon spinner | No text | Refresh action | No ❌ |
| 24 | Status Dot | Multiple files | Green pulsing dot | No text | Active/live status | No ❌ |
| **BUTTON/ACTION STATES** |
| 25 | PDF Generation | `InteractivePDFButton.tsx` | Loader2 icon spinning | "Generowanie raportu..." | PDF generation process | No ❌ |
| 26 | Report Modal | `GenerateReportModal.tsx` | Button text change | "Generowanie..." / "Wysyłanie..." | Report generation + email | No ❌ |
| 27 | Generic Buttons | Various files | Text change | "Zapisywanie..." / "Wysyłanie..." | Form submissions | No ❌ |
| **API/BACKGROUND** |
| 28 | PDF Job Processor | `pdf-job-processor.ts` | Database progress field | No text (backend) | Async PDF generation | Yes ✅ (0-100) |

---

## 🎨 VISUAL APPEARANCE BREAKDOWN

### Spinner Types

| Type | Size | Border | Color | Animation | Where Used |
|------|------|--------|-------|-----------|------------|
| **Standard Large** | 48x48px | 4px | Navy | spin 1s | DashboardLoading, CampaignsLoading, AdminLoading, LoginLoading |
| **Extra Large** | 64x64px | 4px | Navy | spin 1s | ReportsLoading (only) |
| **Medium** | 32x32px | 4px | Navy | spin 1s | DataLoading |
| **Small** | 16x16px | 4px | Navy | spin 1s | InlineLoading, ButtonLoading |
| **Minimal Small** | 16x16px | 2px | Navy/30 | spin 1s | Minimal variants |
| **RefreshCw Icon** | 20x20px | N/A | Navy/Orange | spin 1s | Custom implementations |
| **Blue Custom** | 24x24px | 2px | Blue | spin 1s | Reports period loading |
| **Loader2 Icon** | 20x20px | N/A | White | spin 1s | PDF button |

### Layout Types

| Layout | CSS Classes | Background | Where Used |
|--------|-------------|------------|------------|
| **Fullscreen** | `min-h-screen bg-page flex items-center justify-center` | #F8FAFC | Most page loadings |
| **Fullscreen White** | `min-h-screen bg-white flex items-center justify-center` | White | LoginLoading only |
| **Card** | `bg-white rounded-xl shadow-sm border p-8` | White | DataLoading, GoogleAdsTables |
| **Inline Centered** | `flex items-center justify-center space-x-3` | Transparent | Component loadings |
| **Inline Small** | `flex items-center space-x-1` | Transparent | Status indicators |
| **Skeleton** | `animate-pulse` with gray placeholders | Transparent | WelcomeSection, Metrics |

---

## 📝 TEXT VARIATIONS

### By Context

| Context | Polish Text | English Translation |
|---------|-------------|---------------------|
| **General** |
| Default | "Ładowanie..." | Loading... |
| Data | "Ładowanie danych..." | Loading data... |
| **Pages** |
| Dashboard | "Ładowanie dashboardu..." | Loading dashboard... |
| Reports | "Ładowanie raportów..." | Loading reports... |
| Campaigns | "Ładowanie kampanii..." | Loading campaigns... |
| Clients | "Ładowanie klientów..." | Loading clients... |
| Client Details | "Ładowanie szczegółów klienta..." | Loading client details... |
| Calendar | "Ładowanie kalendarza..." | Loading calendar... |
| Profile | "Ładowanie profilu..." | Loading profile... |
| **Auth** |
| Initialization | "Inicjalizacja..." | Initialization... |
| **Data Sources** |
| Google Ads | "Ładowanie danych Google Ads..." | Loading Google Ads data... |
| Meta | "Ładowanie danych Meta..." | Loading Meta data... |
| Client Data | "Ładowanie danych klienta..." | Loading client data... |
| **Periods** |
| Monthly | "Ładowanie danych miesięcznych..." | Loading monthly data... |
| Weekly | "Ładowanie danych tygodniowych..." | Loading weekly data... |
| All-Time | "Ładowanie danych całego okresu..." | Loading all-time data... |
| Custom Range | "Ładowanie danych własnego zakresu..." | Loading custom range data... |
| **Actions** |
| Saving | "Zapisywanie..." | Saving... |
| Sending | "Wysyłanie..." | Sending... |
| Generating | "Generowanie..." | Generating... |
| Report Gen | "Generowanie raportu..." | Generating report... |
| Updating | "Aktualizowanie..." | Updating... |
| Processing | "Przetwarzanie..." | Processing... |
| Downloading | "Pobieranie..." | Downloading... |

---

## 🔄 LOADING LOGIC PATTERNS

### Pattern Summary

| Pattern | Trigger Logic | Used In | Example |
|---------|---------------|---------|---------|
| **Simple Boolean** | `if (loading) return <Loading />` | Most pages | Dashboard, Campaigns |
| **Auth + Data** | `if (authLoading \|\| (loading && !data))` | Authenticated pages | Dashboard, Reports |
| **Conditional Data** | `if (loading \|\| (!hasData && !error))` | Complex components | GoogleAdsTables |
| **Multiple States** | Different loading for different actions | Reports, Dashboard | `loading`, `refreshing`, `loadingPeriod` |
| **Safety Timeout** | `setTimeout(() => setLoading(false), 20000)` | Critical flows | Dashboard, Login |
| **Progress Track** | Update progress 0-100 during operation | Long operations | PDF generation |
| **Request Dedup** | `if (requestInProgress.current) return` | API components | MetaPerformance, GoogleAdsPerformance |
| **Skeleton** | Show layout placeholders instead of spinner | Known layouts | WelcomeSection, Metrics |

---

## ⚙️ TECHNICAL SPECIFICATIONS

### Animation Timing

| Animation | Duration | Timing Function | Iterations |
|-----------|----------|-----------------|------------|
| `animate-spin` | 1s | linear | infinite |
| `animate-pulse` | 2s | cubic-bezier(0.4, 0, 0.6, 1) | infinite |
| Progress bar transition | 300ms | ease-out | 1 |

### Color Specifications

| Element | Color | Hex Code | Tailwind Class |
|---------|-------|----------|----------------|
| Primary Spinner | Navy | #1F3380 | `border-t-navy` |
| Spinner Background | Navy 20% | rgba(31, 51, 128, 0.2) | `border-navy/20` |
| Minimal Spinner | Navy 30% | rgba(31, 51, 128, 0.3) | `border-navy/30` |
| Page Background | Light Gray | #F8FAFC | `bg-page` |
| Card Background | White | #FFFFFF | `bg-white` |
| Text Primary | Dark Slate | #0F172A | `text-text` |
| Text Muted | Gray | #64748B | `text-muted` |
| Skeleton | Gray 200 | #E5E7EB | `bg-gray-200` |
| Progress Bar | Navy Gradient | #1F3380 | `bg-gradient-to-r from-navy to-navy/80` |
| Progress BG | Stroke | #E9EDF3 | `bg-stroke` |

---

## 🎯 USAGE DECISION TREE

```
Need Loading State?
├── Full Page Load?
│   ├── Dashboard? → DashboardLoading
│   ├── Reports? → ReportsLoading
│   ├── Campaigns? → CampaignsLoading
│   ├── Admin? → AdminLoading
│   └── Login? → LoginLoading
├── Component/Card?
│   ├── Known Layout? → Skeleton Loading
│   └── Unknown Layout? → DataLoading
├── Button Action?
│   ├── In-Button? → ButtonLoading
│   └── Modal/Form? → Button text change ("Zapisywanie...")
├── Inline Status?
│   ├── Small? → InlineLoading
│   └── Icon? → RefreshCw with animate-spin
├── Long Operation?
│   └── Add progress prop → Loading component + progress
└── Quick Toggle?
    └── Pulse dot (green/red)
```

---

## 📊 STATISTICS

### Implementation Distribution

| Category | Count | Percentage |
|----------|-------|------------|
| Standardized Components | 8 | 29% |
| Page Implementations | 8 | 29% |
| Component Implementations | 8 | 29% |
| Button/Action States | 3 | 11% |
| Background/API | 1 | 2% |
| **TOTAL** | **28** | **100%** |

### By Type

| Type | Count |
|------|-------|
| Fullscreen Loading | 6 |
| Card/Component Loading | 5 |
| Inline Loading | 6 |
| Skeleton Loading | 2 |
| Button States | 3 |
| Icon Spinners | 4 |
| Progress Tracking | 2 |

### Progress Bar Usage

| Has Progress | Count | Percentage |
|--------------|-------|------------|
| Yes (Optional) ✅ | 3 | 11% |
| Yes (Active) ✅ | 1 | 4% |
| No ❌ | 24 | 85% |

---

## 🚀 QUICK IMPLEMENTATION GUIDE

### Copy-Paste Examples

**Full Page Loading:**
```typescript
import { DashboardLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <DashboardLoading />;
}
```

**With Progress:**
```typescript
const [progress, setProgress] = useState(0);

if (loading) {
  return <DashboardLoading progress={progress} />;
}
```

**Component Loading:**
```typescript
import { DataLoading } from '@/components/LoadingSpinner';

if (dataLoading) {
  return <DataLoading text="Ładowanie danych..." />;
}
```

**Button Loading:**
```typescript
<button disabled={saving}>
  {saving ? 'Zapisywanie...' : 'Zapisz'}
</button>
```

**Inline Spinner:**
```typescript
<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
```

**Skeleton Loading:**
```typescript
{loading ? (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
  </div>
) : (
  <div>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
)}
```

---

## ✅ CHECKLIST FOR NEW IMPLEMENTATIONS

When adding a new loading state, ensure:

- [ ] Uses standardized component (if applicable)
- [ ] Polish text used
- [ ] Navy color scheme (#1F3380)
- [ ] Follows existing pattern (see decision tree above)
- [ ] Has safety timeout for critical paths (20s)
- [ ] Prevents request duplication (if API call)
- [ ] Handles auth + data loading correctly
- [ ] Shows skeleton for known layouts
- [ ] Considers progress bar for long operations (>3s)
- [ ] Documented in this file

---

**End of Quick Reference**  
**For detailed information, see:** `LOADING_SCREENS_AUDIT.md`



