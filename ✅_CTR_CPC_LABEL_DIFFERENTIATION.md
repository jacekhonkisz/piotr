# ✅ CTR/CPC Label Differentiation - Meta vs Google Ads

## Changes Made

Updated the system to use **different terminology** for CTR and CPC metrics depending on the platform:

### Meta Ads (Facebook & Instagram)
- **CTR**: "Współczynnik kliknięć" or "Współczynnik kliknięć z linku"
- **CPC**: "Koszt kliknięcia" or "Koszt kliknięcia linku"

### Google Ads
- **CTR**: "CTR" (abbreviation)
- **CPC**: "CPC" (abbreviation)

---

## Files Updated

### 1. `src/components/UnifiedReportView.tsx`
**Before:**
- Both Meta and Google campaign tables showed "CTR" and "CPC"

**After:**
- Added `platform` prop to `CampaignTable` component
- Meta campaigns table now shows: **"Współczynnik kliknięć"** and **"Koszt kliknięcia"**
- Google campaigns table now shows: **"CTR"** and **"CPC"**

**Changes:**
```typescript
// Added platform prop to component
const CampaignTable: React.FC<{ 
  //... other props
  platform?: 'meta' | 'google';
}> = ({ campaigns, title, currency, platformColor, platform = 'google' }) => {
  
  // Dynamic labels based on platform
  const ctrLabel = platform === 'meta' ? 'Współczynnik kliknięć' : 'CTR';
  const cpcLabel = platform === 'meta' ? 'Koszt kliknięcia' : 'CPC';
  
  // Used in table headers
  <th className="text-right py-3 px-2">{ctrLabel}</th>
  <th className="text-right py-3 px-2">{cpcLabel}</th>
}
```

---

## Already Correct (No Changes Needed)

### ✅ `src/components/PlatformSeparatedMetrics.tsx`
- Meta section uses: "Współczynnik kliknięć z linku" and "Koszt kliknięcia linku"
- Google section uses: "CTR" and "CPC"
- Combined section uses: "CTR" and "CPC" (appropriate since it's mixed data)

### ✅ `src/components/MetaAdsTables.tsx`
- All Meta-specific tables use full Polish names:
  - "Współczynnik kliknięć z linku"
  - "Koszt kliknięcia linku"

### ✅ `src/components/GoogleAdsExpandableCampaignTable.tsx`
- All Google-specific tables use abbreviations:
  - "CTR"
  - "CPC"

### ✅ `src/components/GoogleAdsTables.tsx`
- All Google-specific breakdowns use abbreviations:
  - "CTR"
  - "CPC"

### ✅ `src/components/WeeklyReportView.tsx`
- Meta sections use: "Współczynnik kliknięć z linku" and "Koszt kliknięcia linku"

---

## Rationale

### Why Different Terminology?

1. **Meta Ads Best Practices:**
   - Meta's own Polish interface uses full descriptive names
   - "Współczynnik kliknięć" is more user-friendly for clients
   - Emphasizes that it's "link clicks" not just any clicks

2. **Google Ads Best Practices:**
   - Google Ads uses universal abbreviations (CTR, CPC, CPM, etc.)
   - Industry-standard terminology that's recognizable globally
   - Shorter labels work better in Google's more data-dense tables

3. **User Expectations:**
   - Clients familiar with Meta Ads Manager see Polish full names
   - Clients familiar with Google Ads see standard abbreviations
   - Each platform's labels match what they see in the native interfaces

---

## Examples

### Meta Ads Campaign Table
```
| Kampania | Wydano | Wyświetlenia | Kliknięcia | Współczynnik kliknięć | Koszt kliknięcia |
|----------|--------|--------------|------------|----------------------|------------------|
| Hotel XYZ | 5,000 zł | 100,000 | 2,000 | 2.00% | 2.50 zł |
```

### Google Ads Campaign Table
```
| Kampania | Wydano | Wyświetlenia | Kliknięcia | CTR | CPC |
|----------|--------|--------------|------------|-----|-----|
| Hotel XYZ | 3,000 zł | 50,000 | 1,500 | 3.00% | 2.00 zł |
```

---

## Impact on Reports

### PDF Reports
The unified PDF reports will now show:
- **Meta Ads section:** Polish full names
- **Google Ads section:** Standard abbreviations

### Email Reports
The email templates already use platform-specific terminology correctly (no changes needed).

### Dashboard
All dashboard views now consistently use:
- Polish full names for Meta Ads metrics
- Standard abbreviations for Google Ads metrics

---

## Status

✅ **All UI components updated and consistent**
✅ **Platform-specific terminology properly implemented**
✅ **No breaking changes - backward compatible**
✅ **Ready for production**

The system now properly differentiates between Meta Ads (Polish full names) and Google Ads (standard abbreviations) for CTR and CPC metrics throughout the entire application!

