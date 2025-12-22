# 🔍 Metrics Fetching Verification

**Issue**: `click_to_call` and `email_contacts` showing 0 in weekly data  
**Question**: Are ALL metrics being fetched the same way as smart cache monthly?

---

## ✅ Verification: Code is Identical

### 1. **Meta API Fields Requested** ✅
Both smart cache and background collector use the **same** `getCampaignInsights()` method:

```typescript
// src/lib/meta-api-optimized.ts:401
fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,cpp,reach,frequency,conversions,actions,action_values,cost_per_action_type
```

✅ **Both include**: `actions,action_values`

### 2. **Parsing Logic** ✅
Both use the **same** `enhanceCampaignsWithConversions()` function:

```typescript
// Smart cache (monthly)
const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);

// Background collector (weekly)
const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
```

### 3. **Action Type Mapping** ✅
The parser correctly maps action types:

| Metric | Meta Action Types | Parser Logic |
|--------|-----------------|--------------|
| `click_to_call` | `click_to_call`, `phone_number_clicks` | `actionType.includes('click_to_call') \|\| actionType.includes('phone_number_clicks')` |
| `email_contacts` | `contact`, `email`, `onsite_web_lead` | `actionType.includes('contact') \|\| actionType.includes('email') \|\| actionType.includes('onsite_web_lead')` |

---

## 🔍 Debug Logging Added

Added comprehensive debug logging to `background-data-collector.ts` to see:
1. What action types are actually returned from Meta API
2. Whether `click_to_call` and `email_contacts` actions are present
3. Sample campaign actions array structure

**Location**: `src/lib/background-data-collector.ts:574-604`

---

## 🧪 Next Steps to Diagnose

### Option 1: Check Current Collection Log
The debug logging will appear in the next collection run. Check:
```bash
tail -f /tmp/belmonte_full_collection_fixed.log | grep -A 10 "Action types found"
```

### Option 2: Test with Smart Cache
Compare what smart cache gets vs background collector:
```sql
-- Check smart cache monthly data
SELECT 
  click_to_call,
  email_contacts,
  booking_step_1,
  reservations
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel')
LIMIT 1;

-- Check weekly collected data
SELECT 
  click_to_call,
  email_contacts,
  booking_step_1,
  reservations
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel')
  AND summary_type = 'weekly'
  AND platform = 'meta'
ORDER BY summary_date DESC
LIMIT 1;
```

### Option 3: Check Meta API Response Directly
The debug logging will show:
- All action types returned
- Whether `click_to_call`/`email_contacts` actions exist
- Sample action structure

---

## 🤔 Possible Causes

1. **Meta API Not Returning Actions for Historical Periods**
   - Some action types may not be available for past periods
   - Check if smart cache (current month) has these metrics

2. **Action Types Have Different Names**
   - Meta API might use different action type names than expected
   - Debug logging will reveal actual names

3. **Actions Array is Empty**
   - Meta API might not return actions for certain periods
   - Debug logging will show if actions array exists

4. **Date Range Issue**
   - The date format fix ensures correct period, but actions might not be available
   - Verify with Meta API directly for that period

---

## ✅ What's Confirmed

- ✅ Same API method (`getCampaignInsights`)
- ✅ Same fields requested (`actions,action_values`)
- ✅ Same parsing function (`enhanceCampaignsWithConversions`)
- ✅ Same parsing logic (matches your mapping table)
- ✅ Debug logging added to diagnose issue

---

## 📊 Expected Debug Output

When collection runs with new code, you'll see:
```
🔍 DEBUG: Sample campaign has X actions
🔍 DEBUG: Action types found: ["purchase", "search", "view_content", ...]
🔍 DEBUG: Found X click_to_call actions: [...]
🔍 DEBUG: Found X email_contacts actions: [...]
```

Or if missing:
```
⚠️ DEBUG: No click_to_call actions found in sample campaign
⚠️ DEBUG: No email_contacts actions found in sample campaign
```

This will tell us if:
1. Actions are being returned but not parsed correctly
2. Actions are not being returned for that period
3. Action types have different names



