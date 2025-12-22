# ⏳ Waiting for Meta API Rate Limit Reset

**Status**: Bad data deleted ✅  
**Current Time**: ~19:00 (7:00 PM)  
**Expected Reset**: ~19:50 - 20:00 (7:50 - 8:00 PM)  
**Wait Time**: ~50-60 minutes

---

## 📊 Current Status

### ✅ Completed
- [x] Deleted 2 bad weekly records from today
- [x] Fixed weekly collection logic (uses Meta API first, not daily_kpi_data)
- [x] Created test script for 1-week collection
- [x] Identified API hanging issue (4 calls × 30s timeout)

### ⏳ Waiting For
- [ ] Meta API rate limit to reset (~1 hour from last attempt)
- [ ] Test collection with 1 week
- [ ] Full 53-week collection if test succeeds

---

## 🔍 What Happened

### Rate Limit Details
Meta API has a rolling rate limit window. When you hit the limit:
- **Reset Time**: Usually 1 hour from when the limit was first exceeded
- **Symptoms**: API returns 429 errors or times out
- **Our Issue**: Made ~8-12 API calls before hitting limit (2 weeks × 4 calls per week)

### Why It Was Hanging
Each API call has a 30-second timeout. When rate limited:
- 4 API calls per week × 30 seconds each = 120 seconds per week
- Collection appeared "hung" but was just waiting for timeouts
- No data was collected during this time (all calls failed)

---

## 🧪 Testing Plan (After ~1 Hour Wait)

### Step 1: Verify Deletion
Run this to confirm bad data is gone:
```bash
# Check deletion was successful
cat scripts/verify-deletion-complete.sql | pbcopy
# Paste and run in Supabase SQL Editor
```

**Expected Result**:
```json
{
  "status": "✅ DELETION VERIFICATION",
  "records_from_today": 0,
  "result": "✅ ALL CLEAN - READY FOR COLLECTION"
}
```

### Step 2: Test 1-Week Collection
```bash
cd /Users/macbook/piotr
npx tsx scripts/test-collection-1week.ts
```

**What to Look For**:
- ✅ **Good**: Completes in <60 seconds with data
- ⚠️ **Rate Limited**: Takes >90 seconds, errors about rate limit
- ❌ **Other Error**: Check logs for specific issue

### Step 3: Verify Test Data
```bash
# Run this SQL query to check the test week data
cat scripts/verify-deletion-complete.sql | pbcopy
```

**Expected**: Should see 1 new week with proper metrics (spend > 0, reservations > 0)

### Step 4: Full Collection (If Test Passes)
```bash
cd /Users/macbook/piotr
export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
npx tsx scripts/recollect-weeks-direct.ts --weeks=53 --client=belmonte
```

**Expected Time**: 
- ~3-5 minutes for 53 weeks (if rate limit is reset)
- Each week takes ~3-5 seconds when API is responsive

---

## ⏰ Timeline

| Time | Action |
|------|--------|
| 18:51 | Last collection attempt (hit rate limit) |
| 19:00 | Bad data deleted, waiting begins |
| **19:50** | **Earliest safe test time** |
| 20:00 | Recommended test time (full hour waited) |
| 20:05 | If test passes, start full collection |
| 20:10 | Full collection should complete (~5 min) |

---

## 🎯 Success Criteria

After full collection, Belmonte should have:
- **53 weeks** of data (or 52, depending on data availability)
- **All Mondays**: Every `summary_date` is a Monday
- **Unique Values**: Each week has different spend/conversion values
- **Proper Conversions**: reservations > 0, booking_step_1 > 0
- **No Duplicates**: No identical values across multiple weeks

---

## 🔧 If Test Fails

### Scenario 1: Still Rate Limited
**Symptoms**: Test takes >90s, timeout errors
**Action**: Wait another 30 minutes and try again

### Scenario 2: Different Error
**Symptoms**: Quick failure with specific error message
**Action**: Share error message for debugging

### Scenario 3: Test Succeeds but Wrong Data
**Symptoms**: Test completes quickly but data looks wrong
**Action**: Check logs for which week was collected and what values were returned

---

## 📝 Verification Queries

After full collection completes, run these:

### Check Total Weeks
```sql
SELECT 
  COUNT(*) as total_weeks,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly';
```

### Check for Duplicates
```sql
SELECT 
  summary_date,
  spend,
  reservations,
  COUNT(*) as count
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
GROUP BY summary_date, spend, reservations
HAVING COUNT(*) > 1;
```

**Expected**: 0 rows (no duplicates)

### Check Value Variety
```sql
SELECT 
  COUNT(DISTINCT ROUND(total_spend::numeric, 2)) as unique_spend_values,
  COUNT(DISTINCT reservations) as unique_reservation_values,
  COUNT(*) as total_weeks
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly';
```

**Expected**: Multiple unique values (not all the same)

---

## 🚀 Ready When You Are

When ~1 hour has passed (around **19:50-20:00**), just let me know and I'll guide you through the test!

Commands ready:
1. ✅ Verify deletion: `verify-deletion-complete.sql`
2. ✅ Test 1 week: `npx tsx scripts/test-collection-1week.ts`
3. ✅ Full collection: `npx tsx scripts/recollect-weeks-direct.ts --weeks=53 --client=belmonte`



