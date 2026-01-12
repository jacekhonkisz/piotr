# Re-collect All Google Ads Weeks - Guide

## 🎯 Goal
Re-collect ALL past weeks for ALL Google Ads clients to ensure:
- ✅ All data is fresh from API
- ✅ All booking steps are properly populated
- ✅ All weeks have correct values

## 📊 Current Status

Based on your audit:
- **Sandra SPA Karpacz**: 59 weeks with spend but NO booking steps (ALL need re-collection)
- **Młyn Klekotki**: 32 weeks with spend but NO booking steps
- **Belmonte Hotel**: 35 weeks with spend but NO booking steps + 24 zero spend weeks
- **Nickel Resort**: 33 zero spend weeks (might be correct, but worth checking)
- **Hotel Tobaco**: 26 zero spend weeks

## 🔄 Re-collection Script

### Run Full Re-collection
```bash
npx tsx scripts/recollect-all-google-ads-weeks.ts
```

**What it does:**
- ✅ Gets ALL existing weekly records for each client
- ✅ Re-collects each week from Google Ads API
- ✅ Updates with fresh data including booking steps
- ✅ Shows before/after comparison
- ✅ Handles errors gracefully

**Time:** ~10-20 minutes per client (depending on number of weeks)

## 📈 Expected Results

After re-collection:
- ✅ **Sandra SPA**: All 59 weeks should have booking steps
- ✅ **Młyn Klekotki**: 32 weeks should have booking steps
- ✅ **Belmonte**: 35 weeks should have booking steps
- ✅ **Zero spend weeks**: Will be verified (if truly 0, they'll stay 0)

## 🔍 Monitoring

After running, check results:
```bash
npx tsx scripts/monitor-google-ads-weekly-collection.ts
```

Or run SQL:
```sql
-- Check weeks with spend but no steps (should be 0 after re-collection)
SELECT 
  c.name,
  COUNT(*) FILTER (WHERE cs.total_spend > 0 AND cs.booking_step_1 = 0) as weeks_missing_steps
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
GROUP BY c.id, c.name
ORDER BY weeks_missing_steps DESC;
```

## ⚠️ Notes

- **Zero spend weeks**: If a week truly has no activity, it will remain at 0 (this is correct)
- **Rate limits**: Script includes delays to avoid Google Ads API rate limits
- **Progress**: Shows detailed progress for each week
- **Errors**: Continues even if some weeks fail

## 🚀 Quick Start

```bash
# Run the re-collection
npx tsx scripts/recollect-all-google-ads-weeks.ts

# Monitor progress (in another terminal)
npx tsx scripts/monitor-google-ads-weekly-collection.ts
```

