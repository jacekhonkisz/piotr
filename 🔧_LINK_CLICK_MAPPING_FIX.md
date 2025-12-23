# 🔧 META FUNNEL MAPPING FIX - LINK CLICKS vs SEARCHES

**Date:** December 23, 2025  
**Issue:** Funnel Step 1 was using `omni_search` (1,684) instead of `link_click` (3,904)

---

## ❌ INCORRECT MAPPING (Before)

| Step | Meta Action | Label | Dec 2025 Count |
|------|-------------|-------|----------------|
| Step 1 | `omni_search` | "Krok 1 w BE" | 1,684 |
| Step 2 | `omni_view_content` | "Krok 2 w BE" | 173 |
| Step 3 | `omni_initiated_checkout` | "Krok 3 w BE" | 52 |
| Reservations | `omni_purchase` | "Ilość rezerwacji" | 7 |

**Problem:** Meta Business Suite shows **3,904 "Kliknięcia linku"** but app showed only 1,684 for Step 1.

---

## ✅ CORRECT MAPPING (After Fix)

| Step | Meta Action | Label | Dec 2025 Count |
|------|-------------|-------|----------------|
| **Step 1** | **`link_click`** | **"Kliknięcia linku"** | **3,904** ✅ |
| **Step 2** | `omni_view_content` | "Wyświetlenia zawartości" | ? |
| **Step 3** | `omni_initiated_checkout` | "Zainicjowane przejścia do kasy" | ? |
| **Reservations** | `omni_purchase` | "Ilość rezerwacji" | 7 |

---

## 🔄 CHANGES MADE

### 1. Updated Meta Actions Parser

**File:** `src/lib/meta-actions-parser.ts` (line 127-139)

```typescript
// OLD - INCORRECT
if (actionType === 'omni_search') {
  metrics.booking_step_1 = value;
}

// NEW - CORRECT
if (actionType === 'link_click') {
  metrics.booking_step_1 = value;
}
```

### 2. Updated Funnel Labels

**File:** `src/components/ConversionFunnel.tsx` (line 100-120)

```typescript
// OLD
label: "Krok 1 w BE"      // Generic label
label: "Krok 2 w BE"
label: "Krok 3 w BE"

// NEW - Matches Meta Business Suite
label: "Kliknięcia linku"                    // Step 1
label: "Wyświetlenia zawartości"             // Step 2
label: "Zainicjowane przejścia do kasy"      // Step 3
```

---

## 🎯 CORRECT FUNNEL FLOW

The funnel now matches what Meta tracks:

```
1. 👆 Kliknięcia linku (link_click)
   ↓ User clicks ad → visits website
   
2. 👁️ Wyświetlenia zawartości (omni_view_content)
   ↓ User views room/offer details
   
3. 🛒 Zainicjowane przejścia do kasy (omni_initiated_checkout)
   ↓ User starts booking process
   
4. ✅ Zakupy w witrynie (omni_purchase)
   = Completed reservation
```

---

## ⚡ NEXT STEPS

### 1. Restart Dev Server

The code changes are already applied. Restart the dev server:

```bash
cd /Users/macbook/piotr
# Kill existing server
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start new server
npm run dev
```

### 2. Re-collect Current Month Data

Force refresh December 2025 data with correct mapping:

```bash
# Trigger smart cache refresh
cd /Users/macbook/piotr
npx tsx -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearCache() {
  const { data: havet } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%havet%')
    .single();
    
  if (havet) {
    await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', havet.id);
    console.log('✅ Cleared cache - will refresh on next page load');
  }
}

clearCache();
"
```

### 3. Re-collect Historical Data

Run the background collector to update all historical months:

```bash
cd /Users/macbook/piotr
npx tsx scripts/collect-all-monthly-data.ts
```

---

## 📊 EXPECTED RESULTS

After re-collecting, December 2025 should show:

| Metric | Before | After |
|--------|--------|-------|
| Kliknięcia linku (Step 1) | 1,684 ❌ | **3,904** ✅ |
| Wyświetlenia zawartości (Step 2) | 173 | **~300-500** (estimate) |
| Zainicjowane przejścia do kasy (Step 3) | 52 | **~50-100** (estimate) |
| Zakupy w witrynie | 7 | **7** (unchanged) |

---

## ✅ VERIFICATION

1. **Browser:** Hard refresh (Cmd+Shift+R) and check funnel shows:
   - "Kliknięcia linku" instead of "Krok 1 w BE"
   - Value of 3,904 instead of 1,684

2. **Database:** Check updated values:
   ```sql
   SELECT booking_step_1, booking_step_2, booking_step_3
   FROM campaign_summaries
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND summary_date = '2025-12-01'
     AND platform = 'meta';
   ```

---

**Status:** ✅ Fix applied - parser now uses `link_click` for Step 1 to match Meta Business Suite.

