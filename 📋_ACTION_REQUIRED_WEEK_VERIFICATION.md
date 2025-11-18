# 📋 ACTION REQUIRED: Week Number Verification

**Critical Finding:** The week number might be off by 1!

---

## 🎯 WHAT WE DISCOVERED

Your screenshot shows:
- **Dates:** 10.11 - 16.11.2025 (November 10-16)
- **Spend:** 6271,48 zł

But these dates are actually **Week 46**, not Week 47!
- **Week 46:** November 10-16, 2025
- **Week 47:** November 17-23, 2025 (current week, includes today Nov 18)

---

## ❓ QUESTIONS FOR YOU

### 1. What week did you select in the dropdown?
- [ ] Week 47
- [ ] Week 46
- [ ] Other: _____

### 2. Open the reports page and check:
- What does the dropdown show for "current week"?
- What dates does "current week" show?

**Expected:**
- Current week (today is Nov 18) should show: **17.11 - 23.11.2025**

**If you see:**
- Current week showing: **10.11 - 16.11.2025** → Dropdown is off by 1 week ❌

---

## 🔍 HOW TO VERIFY (Browser DevTools)

1. Open reports page
2. Press **F12** (or Cmd+Option+I on Mac)
3. Go to **Network** tab
4. Reload the page
5. Filter by "fetch"
6. Find the request to `/api/fetch-live-data`
7. Click on it → Go to **Payload** or **Request** tab

**Check the request body:**
```json
{
  "dateRange": {
    "start": "2025-11-??",
    "end": "2025-11-??"
  }
}
```

**What dates do you see?**

---

## 📊 DATABASE CHECK (Run in Supabase)

```sql
-- Check what weekly data exists
SELECT 
  period_id,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as summary_date,
  platform,
  ROUND(total_spend::numeric, 2) as total_spend,
  total_impressions,
  total_clicks,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND period_id IN ('2025-W46', '2025-W47')
ORDER BY period_id DESC, platform;
```

**Expected results:**
- 2025-W46: summary_date = 2025-11-10, spend ≈ 6271 zł
- 2025-W47: summary_date = 2025-11-17, spend = ???

**Send me the results!**

---

## 🎯 POSSIBLE OUTCOMES

### Scenario A: Dropdown is Wrong (Most Likely)
**If you selected "Week 47" but see dates Nov 10-16:**
- The dropdown labels are off by 1 week
- Fix needed: Update dropdown generation logic
- Your data is correct, just mislabeled

### Scenario B: You Selected Week 46 (All Good!)
**If you selected "Week 46" and see dates Nov 10-16:**
- Everything is working correctly!
- Week 46 data (6271 zł) is accurate
- Week 47 (current week, Nov 17-23) has different data

### Scenario C: Database Labels are Wrong
**If database shows Week 47 data with Nov 10-16 dates:**
- Collection logic is storing wrong period_id
- Need to fix weekly collection in background-data-collector.ts

---

## 🚀 NEXT STEPS

**1. Answer the questions above**

**2. Run the SQL query and share results**

**3. Check browser DevTools and share:**
- Request URL
- Request payload (dateRange)
- Response debug info (debug.source)

**4. Take a screenshot showing:**
- The dropdown with current selection
- The dates displayed
- Browser DevTools Network tab with the request

---

## 💡 WHY THIS MATTERS

If the dropdown is off by 1 week:
- You're not looking at Week 47 data
- You're looking at Week 46 data
- Our fix works fine, but you're checking the wrong week
- Week 47 (current week) might have completely different numbers

**This would explain why you still see "same amount"** - because you're looking at the same week (Week 46), just labeled as Week 47!

---

**Please provide the information above so we can confirm the root cause!**

