# ✅ PBM-Only Phone Fetching Implementation

**Date:** January 2026  
**Requirement:** Use ONLY PBM custom events for phone click fetching  
**Status:** ✅ **IMPLEMENTED**

---

## 📋 Implementation

### **Parser Logic (`src/lib/meta-actions-parser.ts`)**

The parser now uses **ONLY PBM events** for phone clicks when they exist:

```typescript
// ✅ CLICK TO CALL (PHONE)
// 🔧 CRITICAL: Use ONLY PBM custom events for phone clicks
// 
// Requirement: ONLY count PBM custom event (offsite_conversion.custom.1470262077092668)
// - This is the authoritative source for phone clicks
// - Meta also sends standard click_to_call events, but these are duplicates
// - We MUST ignore all standard events to prevent double-counting
// 
// Strategy:
// - Check if PBM event exists in the actions array
// - If PBM exists → ONLY count PBM events, IGNORE all standard events
// - If NO PBM events → count standard events (for non-PBM clients)

// ✅ Check if PBM event exists (actionMap uses lowercase keys)
const hasPBMPhoneEvent = actionMap.has('offsite_conversion.custom.1470262077092668'.toLowerCase());

if (actionType === 'offsite_conversion.custom.1470262077092668') {
  // ✅ PBM phone event - ONLY source for phone clicks
  // This is the authoritative event from PBM tracking
  metrics.click_to_call += value;
}
else if (!hasPBMPhoneEvent) {
  // ✅ Only count standard phone clicks if NO PBM events exist at all
  // This ensures PBM events take absolute priority
  // Standard events are only used for clients that don't have PBM tracking
  if (actionType === 'click_to_call_call_confirm' || 
      (actionType.startsWith('click_to_call_') && !actionType.includes('offsite_conversion')) ||
      actionType.includes('phone_number_clicks')) {
    metrics.click_to_call += value;
  }
}
// ✅ If PBM event exists → completely ignore standard click_to_call events (they are duplicates)
```

---

## 🎯 How It Works

### **Priority Logic:**

1. **First Check:** Does the actions array contain PBM event?
   - `offsite_conversion.custom.1470262077092668` (Havet PBM custom event)

2. **If PBM Event Exists:**
   - ✅ Count ONLY PBM events
   - ❌ Ignore ALL standard `click_to_call_*` events
   - This prevents double-counting (Meta sends both for same phone clicks)

3. **If NO PBM Events:**
   - ✅ Count standard `click_to_call_*` events
   - This is for clients that don't use PBM tracking

---

## 📊 Expected Results

### **For Havet (with PBM events):**
- **Meta API sends:**
  - PBM event: `offsite_conversion.custom.1470262077092668` = 2
  - Standard event: `click_to_call_call_confirm` = 2 (duplicate)
  
- **Parser counts:**
  - ✅ PBM events: 2
  - ❌ Standard events: 0 (ignored)
  - **Total: 2 phones** ✅

### **For Non-PBM Clients:**
- **Meta API sends:**
  - Standard event: `click_to_call_call_confirm` = 5
  
- **Parser counts:**
  - ✅ Standard events: 5
  - **Total: 5 phones** ✅

---

## ✅ Verification

After this change:
1. Clear cache for Havet
2. Fetch fresh data from Meta API
3. Parser will count ONLY PBM events
4. Dashboard should show correct phone count (matching Meta Business Suite)

---

## 🔄 Next Steps

1. **Clear Cache:**
   ```sql
   DELETE FROM current_month_cache 
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND period_id = '2026-01';
   ```

2. **Verify:**
   - Dashboard should show 2 phones (not 12, not 10)
   - Cache should store 2 phones
   - Matches Meta Business Suite

---

**Implementation Date:** January 2026  
**File:** `src/lib/meta-actions-parser.ts` (lines 105-135)  
**Status:** ✅ **ACTIVE**

