# 🧪 TEST PLAN: Unified Priority Fix Verification

## 🎯 WHAT WE'RE TESTING

**Claim:** Week 46 Belmonte now shows booking_step_1 = 10 (from daily_kpi_data) instead of 5 (from old stored value)

---

## ⚠️ IMPORTANT UNDERSTANDING

### The Fix Has 2 Parts:

1. **✅ Historical FETCH** (works immediately after deployment)
   - When you VIEW Week 46, it now checks daily_kpi_data FIRST
   - Even if campaign_summaries has wrong value, it will show correct one

2. **⏳ Historical STORAGE** (works on next collection run)
   - When background collection runs (Sunday 3 AM), it stores with new priority
   - Old stored values remain until re-collected

**Result:** Fix works NOW for viewing, but old stored values won't update until next collection.

---

## 📊 TEST STEPS

### Step 1: Check What's in Database (SQL)

Run: `scripts/verify-week46-belmonte.sql`

**Expected Output:**
```
🥇 PRIORITY 1: daily_kpi_data
  booking_step_1_total: 10 (or whatever the real value is)
  
🥈 STORED: campaign_summaries  
  booking_step_1_total: 5 (old value, might be different)

✅ Test Result: Will show if values match or not
```

---

### Step 2: Test Historical Fetch (Browser)

1. **Open Reports Page:**
   ```
   https://piotr-gamma.vercel.app/reports
   ```

2. **Select:**
   - Client: Belmonte Hotel
   - View: Weekly
   - Period: Week 46 (Nov 10-16, 2025 or 2024)

3. **Open Browser Console** (F12)

4. **Look for this log:**
   ```
   ✅ Found X daily KPI records, using as PRIORITY 1 (matching smart cache)
   ✅ Using daily_kpi_data conversion metrics (PRIORITY 1, matching smart cache)
   ```

5. **Check the value shown:**
   - Should match daily_kpi_data value (from Step 1)
   - NOT the campaign_summaries stored value

---

### Step 3: Compare Current vs Historical

1. **Check Current Week:**
   - Select: Current Week (Week 47 or whatever is current)
   - Note: booking_step_1 value

2. **Check Week 46 (Historical):**
   - Select: Week 46
   - Note: booking_step_1 value

3. **If both use daily_kpi_data:**
   - ✅ Values should be consistent
   - ✅ Same calculation method

---

## 🔍 WHAT TO LOOK FOR

### ✅ SUCCESS Indicators:

**In Console Logs:**
```javascript
// For Week 46 (historical)
✅ Found 7 daily KPI records, using as PRIORITY 1 (matching smart cache)
booking_step_1: 10  // From daily_kpi_data

// For Current Week (smart cache)
✅ Using daily_kpi_data (priority 1)
booking_step_1: 10  // Same source, same logic
```

**In UI:**
- Week 46 shows booking_step_1 = 10
- Current week shows booking_step_1 = (whatever daily_kpi_data has)
- Both calculated the SAME way

### ❌ FAILURE Indicators:

**In Console Logs:**
```javascript
// Still using old logic
📊 Using pre-aggregated database columns (no campaign data)
booking_step_1: 5  // Old stored value
```

**In UI:**
- Week 46 shows different value than current week
- Week 46 shows 5 (old), current shows 10 (new)

---

## 🎯 EXPECTED RESULTS

### Scenario A: daily_kpi_data EXISTS for Week 46
```
daily_kpi_data:        booking_step_1 = 10 ✅
campaign_summaries:    booking_step_1 = 5  (ignored)

What you'll see: 10 ✅
Source: PRIORITY 1 (daily_kpi_data)
```

### Scenario B: NO daily_kpi_data for Week 46
```
daily_kpi_data:        (empty)
campaign_summaries:    booking_step_1 = 5 ✅

What you'll see: 5 ✅
Source: PRIORITY 2 (campaign_data) or PRIORITY 3 (DB columns)
```

### Scenario C: NEITHER source has data
```
daily_kpi_data:        (empty)
campaign_summaries:    booking_step_1 = 0

What you'll see: 0 ✅
Source: LAST RESORT (zeros)
```

---

## ⚡ QUICK TEST COMMAND

**Run this SQL to get the expected value:**

```sql
-- This shows what Week 46 SHOULD display after the fix
SELECT 
  COALESCE(
    (SELECT SUM(booking_step_1) 
     FROM daily_kpi_data dkd
     JOIN clients c ON c.id = dkd.client_id
     WHERE c.name ILIKE '%belmonte%'
       AND dkd.date >= '2025-11-10' 
       AND dkd.date <= '2025-11-16'),
    (SELECT booking_step_1
     FROM campaign_summaries cs
     JOIN clients c ON c.id = cs.client_id
     WHERE c.name ILIKE '%belmonte%'
       AND cs.summary_date = '2025-11-10'
       AND cs.summary_type = 'weekly'
       LIMIT 1),
    0
  ) as expected_booking_step_1_value,
  'This is what Week 46 should show in UI' as note;
```

Then compare with what the UI shows for Week 46.

---

## 📝 REPORT BACK

Please share:
1. **SQL Results** (from verify-week46-belmonte.sql)
2. **Console Logs** (when viewing Week 46)
3. **UI Value** (booking_step_1 shown for Week 46)
4. **Match Status** (does it match daily_kpi_data or old stored value?)

Then I can confirm if the fix is working correctly!


