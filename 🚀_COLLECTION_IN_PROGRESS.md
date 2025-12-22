# 🚀 Full 53-Week Collection - In Progress

**Started**: November 18, 2025  
**Status**: ✅ **RUNNING**  
**Process**: Background (`npx tsx scripts/recollect-weeks-controlled.ts --weeks=53`)

---

## 📊 Collection Scope

| Metric | Value |
|--------|-------|
| **Clients** | 16 |
| **Weeks per client** | 53 |
| **Total records** | 848 (16 × 53) |
| **Existing records** | ~232 (will be updated if changed) |
| **Missing records** | ~600 (will be collected) |

---

## 🔧 Fixes Applied Before Collection

✅ **1. Actions Parser Added**
- File: `src/lib/background-data-collector.ts`
- Fix: Added `enhanceCampaignsWithConversions()` to parse Meta API actions array
- Impact: Conversion metrics (reservations, booking_step_1, etc.) will now be populated

✅ **2. Data Source Priority Fixed**
- Changed: Only use daily_kpi_data as FALLBACK (not primary)
- Impact: No more doubled values or wrong metrics

✅ **3. ISO Week Validation**
- All weeks validated as Mondays (ISO 8601 standard)
- Impact: Clean, standardized week dates

---

## ⏱️ Expected Timeline

**Estimated Duration**: 15-20 minutes  
**Records per minute**: ~50-60  
**Progress tracking**: See below

### Progress Stages:
1. **0-25%** (0-212 records): First quarter, slow start
2. **25-50%** (212-424 records): Second quarter
3. **50-75%** (424-636 records): Third quarter
4. **75-100%** (636-848 records): Final quarter

---

## 📈 How to Monitor Progress

### **Option 1: Check Log File**
```bash
tail -f /tmp/collection_nov18.log
```

### **Option 2: Run SQL Progress Query**
```bash
# In Supabase SQL Editor:
scripts/monitor-collection-progress.sql
```

### **Option 3: Quick Count Check**
```sql
SELECT 
  COUNT(*) as weekly_records,
  COUNT(DISTINCT client_id) as clients,
  ROUND(100.0 * COUNT(*) / 832, 1) || '%' as coverage
FROM campaign_summaries
WHERE summary_type = 'weekly' AND platform = 'meta'
  AND summary_date >= CURRENT_DATE - INTERVAL '52 weeks';
```

---

## ✅ What to Verify After Completion

### **1. Check Final Count**
Run: `scripts/monitor-collection-progress.sql`

Expected result:
- Total records: ~800-830 (some weeks may legitimately have no data)
- Coverage: ~95%+
- All 16 clients have data

### **2. Verify Conversion Data**
Run: `scripts/quick-verify-new-data.sql`

Expected result:
- Records created today: ~600
- Conversion rate: >0% (not all zeros!)
- booking_step_1, reservations populated

### **3. Check Data Quality**
Run: `scripts/analyze-data-gaps-detailed.sql`

Expected result:
- No non-Monday weeks
- No duplicate weeks
- Coverage by client >80%

### **4. Test Weekly Reports**
- Go to `/reports` page
- Select "Weekly" timeframe
- Check Belmonte (or any client)
- Verify: Spend, reservations, booking funnel all show real data

---

## 🔍 Current Status Indicators

### **Collection is Working if:**
- ✅ Log shows "Triggering collection..." messages
- ✅ Database record count is increasing
- ✅ `monitor-collection-progress.sql` shows recent activity
- ✅ No error messages in log

### **Collection has Issue if:**
- ❌ Log shows repeated errors
- ❌ Database count stops increasing for >5 minutes
- ❌ All records show 0 conversions
- ❌ Process terminates early

---

## 🚨 Troubleshooting

### **If Collection Stops:**
1. Check log for errors: `tail -100 /tmp/collection_nov18.log`
2. Check if process is still running: `ps aux | grep recollect-weeks`
3. Check database for recent records: `scripts/quick-verify-new-data.sql`
4. Restart if needed: `npx tsx scripts/recollect-weeks-controlled.ts --weeks=53`

### **If Data Still Shows Zeros:**
1. Verify fix was applied: `grep "enhanceCampaignsWithConversions" src/lib/background-data-collector.ts`
2. Check if actions parser is imported: `grep "meta-actions-parser" src/lib/background-data-collector.ts`
3. Review sample record: `scripts/quick-verify-new-data.sql`

---

## 📝 What Happens Next

### **When Collection Completes:**

1. ✅ **Automatic**:
   - All 53 weeks collected for all 16 clients
   - UPSERT logic ensures no duplicates
   - Existing records updated with correct conversion data

2. ⏳ **Manual Verification** (your tasks):
   - Run `scripts/analyze-data-gaps-detailed.sql`
   - Verify coverage ~95%+
   - Check weekly reports show correct data
   - Mark todos as completed

3. ⏳ **Remaining Fixes**:
   - Fix fetch-live-data API (add actions parser)
   - Standardize data source priority across all systems
   - Document ongoing maintenance procedures

---

## 📊 Expected Final State

### **Before Collection:**
```
Weekly Coverage: 27.9% ❌
Records: 232/832
Missing: 600 records
```

### **After Collection:**
```
Weekly Coverage: ~95%+ ✅
Records: ~800+/832
Missing: <50 records (legitimately missing weeks)
```

---

## 🎯 Success Criteria

Collection is **SUCCESSFUL** if:
- ✅ Coverage reaches >90%
- ✅ All 16 clients have weekly data
- ✅ Conversion metrics populated (not all zeros)
- ✅ Weekly reports show accurate data
- ✅ No data quality issues (duplicates, non-Monday dates)

---

## 📞 Next Actions After Success

1. Update `📚_SESSION_SUMMARY_NOV18.md` with completion status
2. Mark remaining todos:
   - ✅ test-single-week
   - ✅ verify-fix
   - ✅ full-recollection
   - ✅ verify-reports
3. Proceed with pending fixes:
   - Fix fetch-live-data API
   - Standardize data source priority
4. Set up automated weekly collection schedule

---

**Status**: 🟢 **COLLECTION RUNNING**  
**Last Updated**: November 18, 2025  
**Log File**: `/tmp/collection_nov18.log`  
**Monitor**: `scripts/monitor-collection-progress.sql`



