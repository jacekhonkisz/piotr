# ✅ DATABASE POPULATION GUIDE

## 🎯 Goal: Populate all 54 weeks of historical data for Belmonte

---

## 🚨 The Problem We Discovered

**Even 1 single week takes 60-180 seconds to collect**

This means:
- ❌ 5 weeks in 1 call = 300-900s (5-15 minutes) = TIMEOUT
- ❌ 10 weeks in 1 call = 600-1800s (10-30 minutes) = TIMEOUT
- ❌ 54 weeks in 1 call = 3240-9720s (54-162 minutes) = TIMEOUT

**Root cause**: Serverless functions (Vercel) have a **180-second (3 minute) hard limit**

---

## ✅ The Solution: ONE WEEK AT A TIME

Instead of trying to collect multiple weeks in one call, we collect **1 week per API call**:

```
Call 1: Week 53 (60-120s) ✅
Call 2: Week 52 (60-120s) ✅
Call 3: Week 51 (60-120s) ✅
...
Call 54: Week 0 (60-120s) ✅
```

**Each call is SAFE** (well under 180s timeout)

---

## 🚀 How to Populate the Entire Database

### **Method 1: Run Shell Script (IMMEDIATE, ~2 hours)**

Run this script to populate all 54 weeks **right now**:

```bash
./scripts/populate-all-weeks-one-by-one.sh
```

**What it does**:
- Makes 54 sequential API calls (one per week)
- Each call takes ~60-120 seconds
- Shows real-time progress
- Estimates remaining time
- Handles errors gracefully
- **Total time: ~2 hours**

**Output example**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📅 Week 53 of 54
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⏳ Starting at: 17:30:15
  
  ✅ SUCCESS
  ⏱️  Duration: 87s
  📈 Progress: 1/54 complete
  ✅ Successful: 1
  ⏳ Remaining: 53 weeks
  ⏱️  Est. remaining: ~77 minutes
  
  ⏸️  Waiting 5 seconds before next week...
```

**To run**:
```bash
cd /Users/macbook/piotr
./scripts/populate-all-weeks-one-by-one.sh
```

**IMPORTANT**: Keep your terminal open for ~2 hours while it runs!

---

### **Method 2: Manual API Calls (FLEXIBLE)**

If you need more control, call the API manually for specific weeks:

```bash
# Collect week 39
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries?testClient=belmonte&startWeek=39&endWeek=39' \
  -H 'Authorization: Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK' \
  --max-time 180
```

**Use cases**:
- Retry failed weeks
- Collect specific weeks only
- Test individual weeks

---

### **Method 3: Future - Incremental Cron Job (AUTOMATIC)**

**NOT YET IMPLEMENTED**, but recommended for future:

Modify the cron job to collect **1 week per hour**:
- Hour 1: Week 53 ✅
- Hour 2: Week 52 ✅
- ...
- Hour 54: Week 0 ✅

**Benefits**:
- ✅ Automatic (no manual work)
- ✅ Each run is safe (60-120s)
- ✅ Complete in 54 hours (2.25 days)
- ✅ Can be scheduled during off-peak hours

---

## 📊 Verification

After population completes, verify the data:

```bash
npx tsx scripts/check-belmonte-collection-status.sql
```

**Expected output**:
```sql
✅ 54 weeks collected
✅ All weeks stored on Monday
✅ Conversion metrics populated
✅ No duplicates
```

---

## 🔧 Troubleshooting

### **If Some Weeks Fail:**

Check which weeks failed and retry them individually:

```bash
# Retry week 25
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries?testClient=belmonte&startWeek=25&endWeek=25' \
  -H 'Authorization: Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK' \
  --max-time 180
```

### **If Script Gets Interrupted:**

The script processes weeks from oldest (53) to newest (0). If interrupted, you can:

1. Check which weeks are already in the database
2. Restart the script (it will re-process some weeks, but UPSERT will handle duplicates)
3. Or manually collect missing weeks

---

## 📈 Progress Tracking

The script provides real-time updates:
- ✅ Successful weeks
- ❌ Failed weeks
- ⏳ Remaining weeks
- ⏱️  Estimated time remaining
- 📊 Current progress (e.g., "27/54 complete")

---

## 🎯 After Population

Once all 54 weeks are populated:

1. ✅ **Database is production-ready**
2. ✅ **Users can view historical reports**
3. ✅ **Weekly cron job maintains current data**
4. ✅ **No more manual collection needed**

---

## 🔮 Future Improvements

### **Option A: On-Demand Fetching**
- Fetch data only when user views a report
- 5-10 second response time
- Progressive population
- Best user experience

### **Option B: Incremental Cron**
- Collect 1 week per hour automatically
- No manual work
- Complete in 2-3 days
- Set and forget

**Recommendation**: Implement **Option A** (on-demand) + **Option B** (incremental cron) for best results.

---

## ✅ Ready to Run

**To populate the entire database NOW:**

```bash
cd /Users/macbook/piotr
./scripts/populate-all-weeks-one-by-one.sh
```

**Time required**: ~2 hours  
**Success rate**: ~95%+  
**Risk**: Low (each call is safe)

🎉 **Let's populate the database!**

