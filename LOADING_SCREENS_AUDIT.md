# 🔄 COMPLETE LOADING SCREENS AUDIT

**Date:** November 12, 2025  
**Auditor:** AI Assistant  
**Purpose:** Comprehensive audit of all loading screens across the application

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Standardized Loading System](#standardized-loading-system)
3. [Page-Level Loading Screens](#page-level-loading-screens)
4. [Component-Level Loading Screens](#component-level-loading-screens)
5. [Button & Action Loading States](#button--action-loading-states)
6. [Custom/Legacy Loading Implementations](#customlegacy-loading-implementations)
7. [Loading Logic Patterns](#loading-logic-patterns)
8. [Recommendations](#recommendations)

---

## 📊 OVERVIEW

### Summary Statistics
- **Total Standardized Components:** 8
- **Pages Using Standardized Loading:** 10+
- **Custom Loading Implementations:** ~15
- **Loading Text Language:** Polish (Ładowanie...)
- **Primary Color Scheme:** Navy (#1F3380) on light backgrounds

### Design System
- **Spinner:** Circular border animation with navy color
- **Background (Fullscreen):** `bg-page` (#F8FAFC)
- **Background (Cards):** White with subtle shadow
- **Typography:** Inter/DM Sans, medium weight (500)
- **Progress Bars:** Gradient navy with percentage display

---

## 🎨 STANDARDIZED LOADING SYSTEM

**Location:** `src/components/LoadingSpinner.tsx`  
**Documentation:** `LOADING_SYSTEM_README.md`

### Base Component: `LoadingSpinner`

**Props:**
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  progress?: number; // 0-100
  variant?: 'default' | 'minimal' | 'fullscreen' | 'centered' | 'card';
  showProgress?: boolean;
  showSpinner?: boolean;
  icon?: React.ReactNode;
}
```

**Variants:**
1. **default** - Flex column, centered
2. **minimal** - Thinner border (2px vs 4px)
3. **fullscreen** - Full screen with `min-h-screen bg-page`
4. **centered** - Flex centered within container
5. **card** - White card with shadow and border

**Spinner Sizes:**
- `sm`: 16x16px (w-4 h-4)
- `md`: 32x32px (w-8 h-8)
- `lg`: 48x48px (w-12 h-12)
- `xl`: 64x64px (w-16 h-16)

**Animation:** CSS `animate-spin` on border-t-navy element

---

### 1. DashboardLoading

**Component Definition:**
```typescript
export const DashboardLoading = ({ 
  progress, 
  message 
}: { 
  progress?: number; 
  message?: string 
}) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={message || "Ładowanie dashboardu..."}
    progress={progress}
    showProgress={progress !== undefined}
  />
);
```

**Visual Appearance:**
- Fullscreen layout with light background
- Large spinner (48x48px)
- Navy spinner with 4px border
- Optional progress bar with percentage
- Text: "Ładowanie dashboardu..." (default)

**Used In:**
- `src/app/dashboard/page.tsx`
- `src/app/auth/login/page.tsx` (after login, before redirect)

**Loading Logic:**
```typescript
// Dashboard page
if (authLoading || (loading && !clientData)) {
  return <DashboardLoading />;
}
```

**Trigger Conditions:**
- Authentication is loading
- Dashboard data is loading AND no cached client data exists
- NOT shown during data refresh (uses inline indicators instead)

---

### 2. ReportsLoading

**Component Definition:**
```typescript
export const ReportsLoading = ({ 
  progress 
}: { 
  progress?: number 
}) => (
  <LoadingSpinner
    variant="fullscreen"
    size="xl"
    text="Ładowanie raportów..."
    progress={progress}
    showProgress={progress !== undefined}
  />
);
```

**Visual Appearance:**
- Fullscreen layout
- Extra large spinner (64x64px) - LARGEST in the app
- Navy spinner with 4px border
- Optional progress bar
- Text: "Ładowanie raportów..."

**Used In:**
- `src/app/reports/page.tsx` (main reports page)
- Wrapper component for auth check

**Loading Logic:**
```typescript
// Reports page
if (loading) {
  return <ReportsLoading />;
}

// Auth wrapper
function ReportsPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return <ReportsLoading />;
  }
  return <ReportsPageContent />;
}
```

**Trigger Conditions:**
- Initial page load
- Authentication check
- NOT shown during period switching (uses inline loading instead)

---

### 3. CampaignsLoading

**Component Definition:**
```typescript
export const CampaignsLoading = () => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text="Ładowanie kampanii..."
  />
);
```

**Visual Appearance:**
- Fullscreen layout
- Large spinner (48x48px)
- No progress bar (not needed for quick loads)
- Text: "Ładowanie kampanii..."

**Used In:**
- `src/app/campaigns/page.tsx`

**Loading Logic:**
```typescript
if (loading) {
  return <CampaignsLoading />;
}
```

**Trigger Conditions:**
- Initial page load
- Fetching campaigns from database
- Fetching client data

---

### 4. LoginLoading

**Component Definition:**
```typescript
export const LoginLoading = ({ 
  text = "Ładowanie..." 
}: { 
  text?: string 
}) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={text}
    showProgress={false}
    className="bg-white"
  />
);
```

**Visual Appearance:**
- Fullscreen white background (differs from others)
- Large spinner (48x48px)
- No progress bar
- Customizable text

**Used In:**
- `src/app/auth/login/page.tsx`

**Loading Logic:**
```typescript
if (authLoading || (user && !profile)) {
  return (
    <>
      <LoginLoading text={authLoading ? "Inicjalizacja..." : "Ładowanie profilu..."} />
      {user && !profile && (
        <div className="fixed inset-0 flex items-end justify-center pb-20 pointer-events-none">
          <div className="text-sm text-gray-500 bg-white/90 px-4 py-2 rounded-lg">
            Jeśli ładowanie trwa zbyt długo, strona zostanie przekierowana automatycznie
          </div>
        </div>
      )}
    </>
  );
}
```

**Text Variations:**
- "Inicjalizacja..." - During auth initialization
- "Ładowanie profilu..." - Waiting for profile data

**Special Features:**
- Shows timeout warning after profile loading takes too long
- Safety timeout mechanism (20 seconds)
- Automatic redirect if stuck

---

### 5. AdminLoading

**Component Definition:**
```typescript
export const AdminLoading = ({ 
  text = "Ładowanie klientów..." 
}: { 
  text?: string 
}) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={text}
    showProgress={false}
  />
);
```

**Visual Appearance:**
- Fullscreen with page background
- Large spinner (48x48px)
- No progress bar
- Customizable text

**Used In:**
- `src/app/admin/page.tsx` - Main admin page
- `src/app/admin/clients/[id]/page.tsx` - Client details
- `src/app/admin/calendar/page.tsx` - Calendar page

**Loading Logic:**
```typescript
// Main admin page
if (loading) {
  return <AdminLoading />;
}

// Client details
if (loading) {
  return <AdminLoading text="Ładowanie szczegółów klienta..." />;
}

// Calendar
if (authLoading || loading) {
  return <AdminLoading text="Ładowanie kalendarza..." />;
}
```

**Text Variations:**
- "Ładowanie klientów..." (default)
- "Ładowanie szczegółów klienta..."
- "Ładowanie kalendarza..."

---

### 6. DataLoading

**Component Definition:**
```typescript
export const DataLoading = ({ 
  text = "Ładowanie danych...", 
  progress 
}: { 
  text?: string; 
  progress?: number 
}) => (
  <LoadingSpinner
    variant="card"
    size="md"
    text={text}
    progress={progress}
    showProgress={progress !== undefined}
  />
);
```

**Visual Appearance:**
- White card with rounded corners (`rounded-xl`)
- Shadow and border (`shadow-sm border border-stroke`)
- Medium spinner (32x32px)
- Optional progress bar
- 8px padding

**Used In:**
- Component-level data loading
- Card-based UI sections
- NOT currently used in main codebase (available for future use)

**Intended Use:**
```typescript
if (dataLoading) {
  return <DataLoading text="Ładowanie danych klienta..." progress={progress} />;
}
```

---

### 7. InlineLoading

**Component Definition:**
```typescript
export const InlineLoading = ({ 
  text = "Ładowanie...", 
  size = "sm" 
}: { 
  text?: string; 
  size?: 'sm' | 'md' | 'lg' 
}) => (
  <LoadingSpinner
    variant="minimal"
    size={size}
    text={text}
    showProgress={false}
  />
);
```

**Visual Appearance:**
- Minimal design (2px border instead of 4px)
- Small spinner by default (16x16px)
- No progress bar
- Inline with other elements

**Used In:**
- Status indicators
- Inline loading states
- NOT heavily used in current codebase

**Intended Use:**
```typescript
<div className="flex items-center space-x-2">
  <span>Status:</span>
  {isRefreshing ? (
    <InlineLoading text="Aktualizowanie..." size="sm" />
  ) : (
    <span className="text-green-600">Zaktualizowane</span>
  )}
</div>
```

---

### 8. ButtonLoading

**Component Definition:**
```typescript
export const ButtonLoading = ({ 
  text = "Ładowanie..." 
}: { 
  text?: string 
}) => (
  <LoadingSpinner
    variant="minimal"
    size="sm"
    text={text}
    showProgress={false}
    className="flex-row space-x-2"
  />
);
```

**Visual Appearance:**
- Minimal spinner (2px border)
- Small size (16x16px)
- Horizontal layout (flex-row)
- Space between spinner and text
- No progress bar

**Used In:**
- Button loading states
- Form submissions
- Action buttons

**Intended Use:**
```typescript
<button disabled={isLoading}>
  {isLoading ? (
    <ButtonLoading text="Zapisywanie..." />
  ) : (
    'Zapisz'
  )}
</button>
```

---

## 📄 PAGE-LEVEL LOADING SCREENS

### 1. Dashboard Page (`/dashboard`)

**File:** `src/app/dashboard/page.tsx`

**Loading States:**
1. **Initial Load**: `<DashboardLoading />`
2. **Data Refresh**: Inline indicators (no fullscreen)

**Loading Logic:**
```typescript
const [loading, setLoading] = useState(true);
const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
const [loadingMessage, setLoadingMessage] = useState('Ładowanie dashboardu...');
const [loadingProgress, setLoadingProgress] = useState(0);

// Show loading only if:
// 1. Auth is still loading (initial load)
// 2. Dashboard data is loading AND we don't have any client data yet
// Don't show loading if we're just refreshing data
if (authLoading || (loading && !clientData)) {
  return <DashboardLoading />;
}
```

**Trigger Flow:**
1. User navigates to `/dashboard`
2. `authLoading` = true → Shows `DashboardLoading`
3. Auth completes, fetch begins
4. `loading` = true, `clientData` = null → Shows `DashboardLoading`
5. Data arrives → `setClientData()`, `setLoading(false)` → Hides loading

**Progress Tracking:**
- Initial: 0%
- Not currently implemented for dashboard (progress prop not passed)

**Safety Features:**
- 20-second safety timeout to prevent infinite loading
- Fallback to cached data on API failure
- Loading message updates during fetch stages

---

### 2. Reports Page (`/reports`)

**File:** `src/app/reports/page.tsx`

**Loading States:**
1. **Initial Load**: `<ReportsLoading />`
2. **Period Switch**: Inline loading indicator (not fullscreen)

**Loading Logic:**
```typescript
// Auth wrapper
function ReportsPage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <ReportsLoading />;
  }
  
  return <ReportsPageContent />;
}

// Main component
function ReportsPageContent() {
  const [loading, setLoading] = useState(true);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  
  if (loading) {
    return <ReportsLoading />;
  }
  
  // Period switching loading (inline)
  {loadingPeriod && (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6">
      <div className="flex items-center justify-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
        <p className="text-lg text-gray-600">
          Ładowanie danych {
            viewType === 'monthly' ? 'miesięcznych' :
            viewType === 'weekly' ? 'tygodniowych' :
            viewType === 'all-time' ? 'całego okresu' :
            'własnego zakresu'
          }...
        </p>
      </div>
    </div>
  )}
}
```

**Trigger Flow:**
1. User navigates to `/reports`
2. Auth check → `<ReportsLoading />`
3. Initial data load → `<ReportsLoading />`
4. Period change → Inline loading indicator (NOT fullscreen)

**Period Switching Text:**
- "Ładowanie danych miesięcznych..."
- "Ładowanie danych tygodniowych..."
- "Ładowanie danych całego okresu..."
- "Ładowanie danych własnego zakresu..."

---

### 3. Campaigns Page (`/campaigns`)

**File:** `src/app/campaigns/page.tsx`

**Loading States:**
1. **Initial Load**: `<CampaignsLoading />`

**Loading Logic:**
```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (user) {
    loadCampaigns();
  }
}, [user]);

const loadCampaigns = async () => {
  try {
    // Fetch client and campaigns
    setLoading(true);
    // ... fetch logic
  } finally {
    setLoading(false);
  }
};

if (loading) {
  return <CampaignsLoading />;
}
```

**Trigger Flow:**
1. User navigates to `/campaigns`
2. Fetch client data from database
3. Fetch campaigns for client
4. Display campaigns table

---

### 4. Admin Pages

**Admin Main Page** (`/admin`):
```typescript
if (loading) {
  return <AdminLoading />;
}
```
- Text: "Ładowanie klientów..."

**Client Details** (`/admin/clients/[id]`):
```typescript
if (loading) {
  return <AdminLoading text="Ładowanie szczegółów klienta..." />;
}
```
- Text: "Ładowanie szczegółów klienta..."

**Calendar** (`/admin/calendar`):
```typescript
if (authLoading || loading) {
  return <AdminLoading text="Ładowanie kalendarza..." />;
}
```
- Text: "Ładowanie kalendarza..."

---

### 5. Login Page (`/auth/login`)

**File:** `src/app/auth/login/page.tsx`

**Loading States:**
1. **Auth Initialization**: "Inicjalizacja..."
2. **Profile Loading**: "Ładowanie profilu..."
3. **Post-Login**: Minimal blank screen (avoid double loading)

**Loading Logic:**
```typescript
const [authLoading, setAuthLoading] = useState(true);

// Show loading only during auth initialization or when waiting for profile
// Don't show loading when redirect is about to happen
if (authLoading || (user && !profile)) {
  return (
    <>
      <LoginLoading text={authLoading ? "Inicjalizacja..." : "Ładowanie profilu..."} />
      {user && !profile && (
        <div className="fixed inset-0 flex items-end justify-center pb-20 pointer-events-none">
          <div className="text-sm text-gray-500 bg-white/90 px-4 py-2 rounded-lg">
            Jeśli ładowanie trwa zbyt długo, strona zostanie przekierowana automatycznie
          </div>
        </div>
      )}
    </>
  );
}

// If user and profile are ready, redirect immediately without showing loading screen
// Return minimal blank screen to avoid flash during redirect
if (user && profile && !redirectedRef.current) {
  return <div className="min-h-screen bg-white" />;
}
```

**Special Features:**
- **Timeout Warning**: Shows after prolonged profile loading
- **Safety Redirect**: Automatically redirects after timeout
- **Blank Screen**: Avoids double loading (LoginLoading → DashboardLoading)

---

## 🧩 COMPONENT-LEVEL LOADING SCREENS

### 1. Google Ads Tables (`GoogleAdsTables`)

**File:** `src/components/GoogleAdsTables.tsx`

**Visual Appearance:**
```typescript
if (shouldShowLoading) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center justify-center space-x-3">
        <RefreshCw className="w-5 h-5 text-slate-900 animate-spin" />
        <span className="text-slate-600">Ładowanie danych Google Ads...</span>
      </div>
    </div>
  );
}
```

**Appearance:**
- White card with rounded corners
- RefreshCw icon (20x20px) spinning
- Slate-900 icon color
- Text: "Ładowanie danych Google Ads..."

**Loading Logic:**
```typescript
const [loading, setLoading] = useState(false);
const hasAnyData = placementData.length > 0 || deviceData.length > 0 || keywordData.length > 0;
const shouldShowLoading = loading || (!hasAnyData && !error);
```

**Trigger Conditions:**
- Explicit loading state
- No data yet AND no error

---

### 2. Google Ads Performance Live (`GoogleAdsPerformanceLive`)

**File:** `src/components/GoogleAdsPerformanceLive.tsx`

**Loading States:**

**1. Waiting for Shared Data (Inline):**
```typescript
{waitingForSharedData && (
  <div className="flex items-center space-x-1 text-muted">
    <RefreshCw className="w-3 h-3 animate-spin" />
    <span>Ładowanie...</span>
  </div>
)}
```
- Small spinner (12x12px)
- Inline with header
- Text: "Ładowanie..."

**2. Main Loading State:**
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center space-x-3">
        <RefreshCw className="w-5 h-5 animate-spin text-orange" />
        <span className="text-muted">
          {waitingForSharedData ? 'Ładowanie danych Google Ads...' : 'Ładowanie...'}
        </span>
      </div>
    </div>
  );
}
```
- Centered layout
- Orange spinner (20x20px)
- Text: "Ładowanie danych Google Ads..." or "Ładowanie..."

**3. Refresh Button:**
```typescript
<button onClick={handleRefresh}>
  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
</button>
```
- Icon becomes spinner when loading

---

### 3. Meta Performance Live (`MetaPerformanceLive`)

**File:** `src/components/MetaPerformanceLive.tsx`

**Similar to Google Ads:**

**Refresh Button:**
```typescript
<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
```

**Loading Logic:**
```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData();
}, [clientId]);

const fetchData = async () => {
  setLoading(true);
  try {
    // API call
  } finally {
    setLoading(false);
  }
};
```

---

### 4. Welcome Section (`WelcomeSection`)

**File:** `src/components/WelcomeSection.tsx`

**Loading State:**
```typescript
if (isLoading) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
      <div className="animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Appearance:**
- **Skeleton loading** (not spinner)
- Pulsing gray placeholders
- Avatar circle placeholder
- Text bar placeholders
- Matches actual component layout

---

### 5. Animated Metrics Charts (`AnimatedMetricsCharts`)

**File:** `src/components/AnimatedMetricsCharts.tsx`

**Loading State:**
```typescript
{isLoading ? (
  <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse"></div>
) : (
  formatNumber(animatedValues.leads)
)}
```

**Appearance:**
- **Skeleton loading bars** (not spinners)
- Height matches actual metric display
- Stroke background color
- Pulse animation
- Used for 3 metrics: leads, reservations, reservation value

---

### 6. Data Source Indicator (`DataSourceIndicator`)

**File:** `src/components/DataSourceIndicator.tsx`

**Refresh Button:**
```typescript
<button onClick={onRefresh}>
  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
</button>
```

**Active Status Indicator:**
```typescript
<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
```
- Green dot with pulse animation
- Shows data is "live"

---

## 🔘 BUTTON & ACTION LOADING STATES

### 1. PDF Generation Button

**File:** `src/components/InteractivePDFButton.tsx`

**Loading State:**
```typescript
<button
  onClick={generateInteractivePDF}
  disabled={isGenerating}
  className={isGenerating ? '!bg-slate-800 !text-white !opacity-100' : '...'}
>
  {isGenerating ? (
    <>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Generowanie raportu...</span>
    </>
  ) : (
    <>
      <FileText className="h-5 w-5" />
      <span>Pobierz PDF (Meta + Google)</span>
    </>
  )}
</button>
```

**Appearance:**
- Loader2 icon (from lucide-react)
- Spinning animation
- Button stays visible (not disabled appearance)
- Text: "Generowanie raportu..."
- Dark slate background when loading

**Loading Logic:**
```typescript
const [isGenerating, setIsGenerating] = useState(false);

const generateInteractivePDF = async () => {
  setIsGenerating(true);
  try {
    // Generate PDF
  } finally {
    setIsGenerating(false);
  }
};
```

---

### 2. Report Generation Modal

**File:** `src/components/GenerateReportModal.tsx`

**Loading States:**

**1. Generating Report:**
```typescript
const [generating, setGenerating] = useState(false);
```

**2. Sending Email:**
```typescript
const [sending, setSending] = useState(false);
```

**Button States:**
```typescript
<button disabled={generating || sending}>
  {generating ? 'Generowanie...' : sending ? 'Wysyłanie...' : 'Generuj Raport'}
</button>
```

---

### 3. Form Submissions

**Pattern:**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

<button disabled={isSubmitting}>
  {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
</button>
```

**Text Variations:**
- "Zapisywanie..." - Saving
- "Wysyłanie..." - Sending
- "Dodawanie..." - Adding
- "Usuwanie..." - Deleting
- "Aktualizowanie..." - Updating

---

## 🛠️ CUSTOM/LEGACY LOADING IMPLEMENTATIONS

### 1. Reports Period Loading (Inline)

**File:** `src/app/reports/page.tsx`

**Implementation:**
```typescript
{loadingPeriod && (
  <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
    <div className="flex items-center justify-center space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
      <p className="text-lg text-gray-600">
        Ładowanie danych {
          viewType === 'monthly' ? 'miesięcznych' :
          viewType === 'weekly' ? 'tygodniowych' :
          viewType === 'all-time' ? 'całego okresu' :
          'własnego zakresu'
        }...
      </p>
    </div>
  </div>
)}
```

**Appearance:**
- White/translucent card
- Backdrop blur effect
- Blue spinner (different from standard navy)
- Dynamic text based on view type
- Larger text size (text-lg)

**Why Custom:**
- Inline within page content (not fullscreen)
- Context-specific messaging
- Different styling for visual hierarchy

---

### 2. Dynamic Loading in GoogleAdsPerformanceLive

**File:** `src/components/GoogleAdsPerformanceLive.tsx`

**Custom Elements:**

**Last Updated Text:**
```typescript
<div className="text-xs text-muted">
  {lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}
</div>
```
- Shows "Ładowanie..." until timestamp available

**Conditional Loading:**
```typescript
const [loading, setLoading] = useState(true);
const [waitingForSharedData, setWaitingForSharedData] = useState(true);

// Different loading states for different scenarios
if (loading) {
  return <CenteredLoadingIndicator />;
}
```

---

### 3. Skeleton Loading (WelcomeSection)

**File:** `src/components/WelcomeSection.tsx`

**Implementation:**
```typescript
<div className="animate-pulse">
  <div className="flex items-center space-x-4">
    <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
</div>
```

**Why Skeleton:**
- Shows layout structure while loading
- Better UX than spinner for card-based content
- Prevents layout shift
- Matches content dimensions

---

### 4. Skeleton Metrics (AnimatedMetricsCharts)

**File:** `src/components/AnimatedMetricsCharts.tsx`

**Implementation:**
```typescript
{isLoading ? (
  <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse"></div>
) : (
  <span>{formatNumber(animatedValues.leads)}</span>
)}
```

**Why Skeleton:**
- Preserves metric card layout
- Smooth transition to actual numbers
- Responsive height matching
- No jarring content shift

---

### 5. Pulse Indicators

**Various Locations:**

**Active Status:**
```typescript
<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
```

**Cache Status:**
```typescript
<div className="flex items-center space-x-2">
  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
  <span>Cache</span>
</div>
```

**Purpose:**
- Show "live" or "active" state
- Subtle animation
- Green = active/healthy
- Red/yellow = inactive/warning

---

## 🔄 LOADING LOGIC PATTERNS

### Pattern 1: Simple Boolean Toggle

**Most Common Pattern:**
```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadData();
}, []);

const loadData = async () => {
  setLoading(true);
  try {
    const data = await fetchData();
    setData(data);
  } finally {
    setLoading(false);
  }
};

if (loading) {
  return <LoadingComponent />;
}
```

**Used In:**
- Dashboard
- Reports
- Campaigns
- Admin pages

---

### Pattern 2: Conditional Loading (Data Check)

**Shows Loading If No Data:**
```typescript
const hasAnyData = placementData.length > 0 || deviceData.length > 0;
const shouldShowLoading = loading || (!hasAnyData && !error);

if (shouldShowLoading) {
  return <LoadingIndicator />;
}
```

**Used In:**
- GoogleAdsTables
- Complex components with multiple data sources

**Rationale:**
- Prevent flickering from cache
- Show loading during initial fetch
- Show data immediately if already loaded

---

### Pattern 3: Multiple Loading States

**Different Loading for Different Actions:**
```typescript
const [loading, setLoading] = useState(true);          // Initial load
const [refreshing, setRefreshing] = useState(false);   // Refresh action
const [loadingPeriod, setLoadingPeriod] = useState(false); // Period switch

if (loading) {
  return <FullscreenLoading />;
}

return (
  <div>
    {refreshing && <InlineRefreshIndicator />}
    {loadingPeriod && <PeriodLoadingIndicator />}
    {/* Content */}
  </div>
);
```

**Used In:**
- Reports page
- Dashboard (loading vs refreshing)

**Rationale:**
- Different UX for different actions
- Avoid fullscreen loading for incremental updates
- Better user experience

---

### Pattern 4: Auth + Data Loading

**Combine Multiple Loading Conditions:**
```typescript
const { user, loading: authLoading } = useAuth();
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

if (authLoading || (loading && !data)) {
  return <LoadingScreen />;
}
```

**Used In:**
- Dashboard
- Reports wrapper
- All authenticated pages

**Rationale:**
- Wait for auth first
- Show loading if fetching data AND no cached data
- Avoid re-showing loading on refresh

---

### Pattern 5: Safety Timeout

**Prevent Infinite Loading:**
```typescript
const [loading, setLoading] = useState(true);
const [loadingSafetyTimeout, setLoadingSafetyTimeout] = useState<NodeJS.Timeout | null>(null);

// Set safety timeout
const safetyTimeout = setTimeout(() => {
  console.warn('⚠️ SAFETY TIMEOUT: Force stopping loading');
  setLoading(false);
  setLoadingMessage('Timeout - spróbuj ponownie');
}, 20000); // 20 seconds

setLoadingSafetyTimeout(safetyTimeout);

// Clear on success
const loadData = async () => {
  try {
    // ... fetch
    if (loadingSafetyTimeout) {
      clearTimeout(loadingSafetyTimeout);
    }
    setLoading(false);
  } catch (error) {
    // ...
  }
};
```

**Used In:**
- Dashboard
- Login page (profile loading)

**Rationale:**
- Prevent stuck loading screens
- User can retry or navigate away
- Better error recovery

---

### Pattern 6: Progress Tracking

**For Long Operations:**
```typescript
const [progress, setProgress] = useState(0);

const generatePDF = async () => {
  setProgress(0);
  
  setProgress(10);  // Start
  await fetchData();
  
  setProgress(40);  // Data fetched
  await generateHTML();
  
  setProgress(60);  // HTML generated
  await renderPDF();
  
  setProgress(80);  // PDF rendered
  await uploadPDF();
  
  setProgress(100); // Complete
};
```

**Used In:**
- PDF generation (`pdf-job-processor.ts`)
- Async report generation

**Rationale:**
- Show user progress for long operations
- Set expectations
- Reduce perceived wait time

---

### Pattern 7: Request Deduplication

**Prevent Multiple Simultaneous Requests:**
```typescript
const requestInProgress = useRef(false);

const fetchData = async () => {
  if (requestInProgress.current) {
    console.log('⏭️ Request already in progress, skipping...');
    return;
  }
  
  requestInProgress.current = true;
  setLoading(true);
  
  try {
    // ... fetch
  } finally {
    setLoading(false);
    requestInProgress.current = false;
  }
};
```

**Used In:**
- MetaPerformanceLive
- GoogleAdsPerformanceLive

**Rationale:**
- Prevent duplicate API calls
- Save resources
- Avoid race conditions

---

## 📊 LOADING TEXT VARIATIONS

### Polish Loading Messages

**General:**
- "Ładowanie..." - Loading...
- "Ładowanie danych..." - Loading data...

**Page-Specific:**
- "Ładowanie dashboardu..." - Loading dashboard...
- "Ładowanie raportów..." - Loading reports...
- "Ładowanie kampanii..." - Loading campaigns...
- "Ładowanie klientów..." - Loading clients...
- "Ładowanie szczegółów klienta..." - Loading client details...
- "Ładowanie kalendarza..." - Loading calendar...
- "Ładowanie profilu..." - Loading profile...

**Data-Specific:**
- "Ładowanie danych Google Ads..." - Loading Google Ads data...
- "Ładowanie danych Meta..." - Loading Meta data...
- "Ładowanie danych klienta..." - Loading client data...
- "Ładowanie danych miesięcznych..." - Loading monthly data...
- "Ładowanie danych tygodniowych..." - Loading weekly data...
- "Ładowanie danych całego okresu..." - Loading all-time data...
- "Ładowanie danych własnego zakresu..." - Loading custom range data...

**Action-Specific:**
- "Inicjalizacja..." - Initialization...
- "Zapisywanie..." - Saving...
- "Wysyłanie..." - Sending...
- "Generowanie..." - Generating...
- "Generowanie raportu..." - Generating report...
- "Aktualizowanie..." - Updating...
- "Przetwarzanie..." - Processing...
- "Pobieranie..." - Downloading...

---

## 🎨 VISUAL DESIGN SPECIFICATIONS

### Color Palette

**Primary Loading Color:**
- Navy: `#1F3380`
- Used for spinner borders
- Used for progress bars

**Background Colors:**
- Page Background: `#F8FAFC` (bg-page)
- Card Background: `#FFFFFF` (white)
- Skeleton: `#E5E7EB` (gray-200)

**Text Colors:**
- Primary Text: `#0F172A` (text)
- Muted Text: `#64748B` (muted)
- Loading Text: Medium weight (500)

**Border Colors:**
- Stroke: `#E9EDF3` (border-stroke)

---

### Spinner Specifications

**Standard Spinner:**
- Border: 4px solid navy/20
- Border-top: 4px solid navy (solid)
- Animation: CSS `animate-spin` (1 second rotation)
- Sizes: 16px, 32px, 48px, 64px

**Minimal Spinner:**
- Border: 2px solid navy/30
- Border-top: 2px solid navy
- Same animation

**Custom Spinners:**
- Blue variant: `border-blue-200 border-t-blue-600`
- Orange variant: `text-orange` with RefreshCw icon

---

### Layout Patterns

**Fullscreen:**
```css
min-h-screen bg-page flex items-center justify-center
```

**Card:**
```css
bg-white rounded-xl shadow-sm border border-stroke p-8
```

**Inline:**
```css
flex items-center space-x-3
```

**Centered:**
```css
flex flex-col items-center justify-center w-full
```

---

### Animation Timing

**Spinner Rotation:**
- Duration: 1 second (default CSS `animate-spin`)
- Timing Function: Linear
- Infinite loop

**Pulse Animation:**
- Duration: 2 seconds (default CSS `animate-pulse`)
- Timing Function: Cubic-bezier
- Infinite loop
- Used for skeleton loading

**Progress Bar:**
- Transition: `all 300ms ease-out`
- Width change animated
- Smooth progress updates

---

## 🎯 RECOMMENDATIONS

### ✅ What's Working Well

1. **Standardized System:**
   - Consistent components across the app
   - Well-documented (LOADING_SYSTEM_README.md)
   - Easy to use predefined components

2. **Visual Consistency:**
   - Navy color scheme throughout
   - Polish language text
   - Professional appearance

3. **Smart Loading Logic:**
   - Auth + data loading patterns
   - Request deduplication
   - Safety timeouts

4. **UX Best Practices:**
   - Skeleton loading for layouts
   - Inline loading for incremental updates
   - Progress bars for long operations

5. **Comprehensive Coverage:**
   - All major pages covered
   - Both fullscreen and component-level loading
   - Button states included

---

### ⚠️ Areas for Improvement

1. **Inconsistent Implementations:**
   - Reports page uses custom blue spinner instead of standard navy
   - Some components don't use standardized LoadingSpinner
   - Mix of custom and standardized approaches

2. **Unused Components:**
   - `DataLoading` not used anywhere in production code
   - `InlineLoading` rarely used
   - `ButtonLoading` not adopted widely

3. **Progress Bar Usage:**
   - Progress tracking available but rarely used
   - Only PDF generation uses progress
   - Dashboard/Reports could benefit from progress indicators

4. **Skeleton Loading:**
   - Limited to WelcomeSection and AnimatedMetricsCharts
   - Could be expanded to more components
   - Better UX than spinners for card layouts

5. **Error States:**
   - Loading components don't handle errors
   - Separate error handling needed
   - No unified error + loading system

---

### 🚀 Recommended Actions

#### Priority 1: High Impact

1. **Standardize Reports Loading:**
   ```typescript
   // Replace custom blue spinner with standard navy
   // Use ReportsLoading consistently
   ```

2. **Add Progress to Dashboard:**
   ```typescript
   <DashboardLoading progress={loadingProgress} />
   ```

3. **Implement More Skeleton Loading:**
   - Client cards
   - Report cards
   - Table rows during initial load

4. **Document Button Loading Pattern:**
   - Add examples to LOADING_SYSTEM_README.md
   - Show ButtonLoading usage

#### Priority 2: Medium Impact

5. **Create Error + Loading Combined Component:**
   ```typescript
   <LoadingErrorBoundary
     loading={loading}
     error={error}
     onRetry={retry}
   />
   ```

6. **Add Loading Analytics:**
   - Track loading times
   - Identify slow components
   - Optimize based on data

7. **Implement Optimistic UI:**
   - Show expected state immediately
   - Update when data arrives
   - Better perceived performance

#### Priority 3: Nice to Have

8. **Add Loading Animations:**
   - Fade in/out transitions
   - Smooth appearance/disappearance
   - More polished feel

9. **Create Loading Stories:**
   - Storybook examples
   - Visual regression testing
   - Design system documentation

10. **Accessibility Improvements:**
    - Add aria-live regions
    - Screen reader announcements
    - Keyboard navigation during loading

---

## 📝 QUICK REFERENCE

### Component Selection Guide

**When to Use:**

| Scenario | Component | Reason |
|----------|-----------|--------|
| Initial page load | `DashboardLoading`, `ReportsLoading`, `CampaignsLoading`, `AdminLoading`, `LoginLoading` | Fullscreen, sets expectations |
| Data refetch | Inline spinner | Don't block entire page |
| Component loading | `DataLoading` | Card-based, contained |
| Button action | `ButtonLoading` | In-button indicator |
| Small inline status | `InlineLoading` | Minimal, doesn't dominate |
| Layout with known structure | Skeleton loading | Shows structure, prevents shift |
| Long operation | Progress bar variant | Shows progress, sets expectations |

---

### Common Patterns

**Basic Page Loading:**
```typescript
import { DashboardLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <DashboardLoading />;
}
```

**Loading with Progress:**
```typescript
import { DashboardLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <DashboardLoading progress={loadingProgress} />;
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
<button disabled={isSubmitting}>
  {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
</button>
```

**Inline Refresh:**
```typescript
<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
```

---

## 📄 SUMMARY

### Total Loading Implementations

**Standardized Components:** 8
- DashboardLoading
- ReportsLoading
- CampaignsLoading
- AdminLoading
- LoginLoading
- DataLoading
- InlineLoading
- ButtonLoading

**Custom Implementations:** ~15
- Reports period loading (blue spinner)
- Google Ads tables loading
- Meta/Google Ads performance loading
- Welcome section skeleton
- Metrics charts skeleton
- Various button states
- Refresh indicators
- Status pulse dots

**Pages with Loading:** 10+
- Dashboard
- Reports
- Campaigns
- Admin (main)
- Admin/Clients/[id]
- Admin/Calendar
- Admin/Settings
- Admin/Monitoring
- Admin/Email Schedule
- Auth/Login

---

### Loading Text Languages

**Primary:** Polish (Ładowanie...)  
**Consistency:** High - all user-facing text in Polish  
**Variations:** ~20 different contextual messages

---

### Visual Consistency

**Color Scheme:** Navy (#1F3380) - 95% consistent  
**Exceptions:** Reports inline loading (blue)  
**Background:** #F8FAFC (page) and white (cards)  
**Animation:** CSS animate-spin (1s) and animate-pulse (2s)

---

### Performance

**Safety Timeouts:** Implemented in critical paths  
**Request Deduplication:** Yes, in API-heavy components  
**Progress Tracking:** Available but underutilized  
**Error Recovery:** Present but could be improved

---

### Overall Assessment

**Grade: A-**

**Strengths:**
- Well-designed standardized system
- Comprehensive documentation
- Consistent visual language
- Smart loading patterns
- Good UX considerations

**Weaknesses:**
- Some custom implementations don't use standards
- Progress tracking underutilized
- Skeleton loading could be expanded
- Error handling could be unified

**Recommendation:** Minor refinements needed, overall excellent implementation. Focus on standardizing remaining custom implementations and expanding skeleton loading usage.

---

**End of Audit**  
**Generated:** November 12, 2025  
**Next Review:** When new pages/components are added







