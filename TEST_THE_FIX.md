# 🧪 QUICK TEST GUIDE - Past Period Fix

## ⚡ 30-Second Test

### 1. Restart Server
```bash
npm run dev
```

### 2. Open Reports Page
```
http://localhost:3000/reports
```

### 3. Select October 2025
- Date range: Oct 1 - Oct 31, 2025

### 4. Check Result

**✅ FIXED if you see:**
- **Wydana kwota:** ~20,613 PLN (not 1,000 zł)
- **Kampanie:** 15 campaigns listed
- Response: Fast (< 2 seconds)

**❌ Still broken if:**
- Still shows 1,000 zł
- Still shows 1 campaign
- Indicator still says "cache"

---

## 🔍 Detailed Verification

### Check Server Logs

Look for these messages when loading October 2025:

```
✅ GOOD LOGS:
🔒 STRICT CURRENT MONTH CHECK: {
  result: false,
  note: "PAST MONTH (use database)"
}

🔒 STRICT PERIOD CLASSIFICATION: {
  isPastPeriod: true,
  decision: "💾 DATABASE (past period)"
}

💾 DATABASE_FIRST (past period)
🚀 ✅ DATABASE SUCCESS: Historical data loaded in XXXms
```

```
❌ BAD LOGS (if still broken):
result: true,
note: "CURRENT MONTH (use cache)"
🔄 CACHE (current period)
```

---

## 📊 Expected Values for October 2025

From your database audit, October should show:

```
✅ Total Spend: 20,613.06 PLN
✅ Campaigns: 15
✅ Reservations: 0 (as per data)
✅ Source: database
✅ Load time: < 1 second
```

---

## 🎯 What Changed

### Before Fix:
```
October 2025 → Cache → 1,000 zł (wrong) ❌
```

### After Fix:
```
October 2025 → Database → 20,613 PLN (correct) ✅
```

---

## 🚨 If Still Not Working

### Try These:

1. **Hard Refresh Browser**
   - Mac: Cmd + Shift + R
   - Windows: Ctrl + Shift + R

2. **Clear Browser Cache**
   - Dev Tools → Application → Clear Storage

3. **Check Server Actually Restarted**
   - Stop server (Ctrl + C)
   - Start again: `npm run dev`

4. **Verify Files Were Saved**
   ```bash
   grep -n "STRICT PERIOD CLASSIFICATION" src/lib/standardized-data-fetcher.ts
   # Should find the new code
   ```

5. **Check Database Still Has Data**
   ```sql
   SELECT total_spend FROM campaign_summaries
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
     AND summary_date = '2025-10-01';
   -- Should return: 20613.06
   ```

---

## ✅ Success Criteria

The fix is working when:

- [x] October 2025 shows 20,613 PLN
- [x] Shows 15 campaigns
- [x] Loads in < 2 seconds
- [x] Logs show "DATABASE (past period)"
- [x] All other past months also work correctly

---

## 🎉 After Testing

If everything works:
1. ✅ Test a few more past months (Sept, Aug)
2. ✅ Test current month still works (November)
3. ✅ Ready for production!

If still issues:
1. Share server logs
2. Check browser Network tab
3. Verify database query results

---

**Ready to test? Restart server and try it!** 🚀


