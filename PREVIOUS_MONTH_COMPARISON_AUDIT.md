# Previous Month Comparison Audit

## 🔍 Issue Found
The AnimatedMetricsCharts component is displaying "vs 0 poprzedni miesiąc" for all three conversion metrics:
- Pozyskane leady (booking_step_1)
- Rezerwacje (reservations)
- Wartość rezerwacji (reservation_value)

## 📍 Root Cause
In `src/app/dashboard/page.tsx` (lines 1521-1538), the AnimatedMetricsCharts component is receiving **hardcoded zero values** for previous month data:

```typescript
<AnimatedMetricsCharts
  leads={{
    current: clientData.conversionMetrics.booking_step_1,
    previous: 0,  // ❌ HARDCODED
    change: 0     // ❌ HARDCODED
  }}
  reservations={{
    current: clientData.conversionMetrics.reservations,
    previous: 0,  // ❌ HARDCODED
    change: 0     // ❌ HARDCODED
  }}
  reservationValue={{
    current: clientData.conversionMetrics.reservation_value,
    previous: 0,  // ❌ HARDCODED
    change: 0     // ❌ HARDCODED
  }}
  isLoading={loading}
/>
```

## ✅ Solution

### Data Source
The `campaign_summaries` table has conversion metrics columns (added in migration 033):
- `booking_step_1`
- `reservations`
- `reservation_value`
- Plus other metrics like `click_to_call`, `email_contacts`, `booking_step_2`, `roas`, `cost_per_reservation`

### Implementation Plan
1. **Add State**: Create `previousMonthConversionMetrics` state in DashboardPage
2. **Fetch Function**: Add `fetchPreviousMonthConversionMetrics()` function that queries `campaign_summaries` table for the previous month's data
3. **Calculate Change**: Compute percentage change between current and previous month
4. **Update Props**: Pass real data to AnimatedMetricsCharts component

### Query Structure
```typescript
const { data, error } = await supabase
  .from('campaign_summaries')
  .select('booking_step_1, reservations, reservation_value')
  .eq('client_id', clientId)
  .eq('summary_type', 'monthly')
  .eq('platform', activeAdsProvider) // 'meta' or 'google'
  .eq('summary_date', previousMonthStr)
  .single();
```

### Change Calculation
```typescript
const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};
```

## 📊 Expected Result
After fix, AnimatedMetricsCharts will display:
- **Current month value** (already working)
- **Previous month value** (from campaign_summaries)
- **Percentage change** (calculated from difference)
- **Progress bar** (based on current vs previous)

Example:
```
Pozyskane leady
205
vs 180 poprzedni miesiąc +▲
[Progress bar showing 114% of previous]
```

## 🎯 Files to Modify
- `src/app/dashboard/page.tsx` - Add state, fetch function, and update AnimatedMetricsCharts props



