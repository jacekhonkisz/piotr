# 🕐 Cron Jobs Guide - Local vs Production

## 🎯 **How Cron Jobs Work in Your Project**

### 📊 **Two Different Systems:**

1. **Production (Vercel)**: Automatic cron jobs via `vercel.json`
2. **Local Development**: Manual testing + optional simulation

---

## 🚀 **Production Cron Jobs (Vercel)**

### **Configuration File: `vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/automated/daily-kpi-collection",
      "schedule": "0 1 * * *"  // Daily at 1 AM UTC
    },
    {
      "path": "/api/automated/refresh-current-month-cache", 
      "schedule": "0 */3 * * *"  // Every 3 hours
    }
  ]
}
```

### **How Vercel Cron Works:**
- ✅ **Automatic**: Runs on deployed apps only
- ✅ **Reliable**: Vercel infrastructure handles execution
- ✅ **UTC Timezone**: All schedules run in UTC
- ✅ **No Setup**: Just deploy and it works
- ❌ **Production Only**: Does NOT run locally

### **Your Current Schedule:**
```
Daily KPI Collection:     0 1 * * *    (Daily at 1:00 AM UTC)
Refresh Month Cache:      0 */3 * * *  (Every 3 hours: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
Refresh Week Cache:       15 */3 * * * (Every 3 hours at :15 minutes)
Send Reports:             0 9 * * *    (Daily at 9:00 AM UTC)
```

---

## 💻 **Local Development Options**

### **Option 1: Manual Testing (Recommended)**
```bash
# Test individual endpoints
curl -X POST http://localhost:3000/api/automated/daily-kpi-collection
curl -X POST http://localhost:3000/api/automated/refresh-current-month-cache

# Use the local cron simulator (NEW!)
node scripts/local-cron-simulator.js --test    # Test all endpoints once
```

### **Option 2: Local Cron Simulator (NEW)**
```bash
# Test all endpoints once
node scripts/local-cron-simulator.js --test

# Run continuously on schedule (like production)
node scripts/local-cron-simulator.js --watch

# Show schedule information
node scripts/local-cron-simulator.js --schedule
```

### **Option 3: System Cron Jobs (Advanced)**
```bash
# Add to your Mac's crontab (only when dev server is running)
crontab -e

# Add lines like:
0 */3 * * * curl -X POST http://localhost:3000/api/automated/refresh-current-month-cache
```

---

## 🔍 **Current Status Analysis**

### **What We Discovered:**

1. **Production Cron Jobs**: ⚠️ **Partially Working**
   - `daily-kpi-collection`: ✅ Working (collected today's data)
   - `refresh-current-month-cache`: ❌ Has errors (404s when calling smart-cache API)

2. **Local Testing**: ✅ **Working**
   - All endpoints respond
   - Can manually trigger any cron job
   - Local simulator script created

### **Why 3-Hour Cache Refresh Isn't Working:**
```
❌ Issue: refresh-current-month-cache gets 404 errors
📍 Problem: Calls smart-cache API endpoint that doesn't exist
🔧 Solution: Fix the API endpoint or update the cron job logic
```

---

## 🛠️ **Testing Your Cron Jobs**

### **Quick Test (5 minutes):**
```bash
# 1. Test daily collection (works)
curl -X POST http://localhost:3000/api/automated/daily-kpi-collection

# 2. Test cache refresh (has errors but runs)  
curl -X POST http://localhost:3000/api/automated/refresh-current-month-cache

# 3. Use new simulator
node scripts/local-cron-simulator.js --test
```

### **Long-term Development:**
```bash
# Start the simulator in background during development
node scripts/local-cron-simulator.js --watch &

# Your dev server
npm run dev

# Cron jobs will run on schedule automatically
```

---

## 📊 **Data Update Flow**

### **Current Working Flow:**
```
🕐 1:00 AM UTC Daily:
├─ daily-kpi-collection runs ✅
├─ Collects Meta API data for yesterday
├─ Stores in daily_kpi_data table
└─ Charts update with new daily data

🕐 Every 3 Hours:
├─ refresh-current-month-cache runs ⚠️
├─ Has errors but doesn't crash
└─ Main totals stay stale (23h old)
```

### **Expected Working Flow:**
```
🕐 1:00 AM UTC Daily:
├─ daily-kpi-collection ✅
└─ Charts get new daily data

🕐 Every 3 Hours (00:00, 03:00, 06:00, etc.):
├─ refresh-current-month-cache ✅ (needs fixing)
└─ Main totals get fresh current month data
```

---

## 🚀 **Quick Start Guide**

### **For Immediate Testing:**
```bash
# 1. Install dependencies (if needed)
npm install node-cron

# 2. Test all cron jobs once
node scripts/local-cron-simulator.js --test

# 3. Check results in database/dashboard
```

### **For Continuous Development:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start cron simulator
node scripts/local-cron-simulator.js --watch

# Now cron jobs run automatically on schedule
```

### **For Production:**
```bash
# Just deploy - cron jobs start automatically
vercel deploy

# Check Vercel dashboard for cron job logs
```

---

## 🎯 **Summary: Cron Jobs Explained**

### **Local Development:**
- ❌ **Vercel cron jobs don't run locally**
- ✅ **Use manual testing**: `curl` commands
- ✅ **Use simulator script**: `node scripts/local-cron-simulator.js`
- ✅ **Set up system cron**: Point to localhost (optional)

### **Production (Deployed):**
- ✅ **Automatic**: Vercel runs jobs from `vercel.json`
- ✅ **Reliable**: Infrastructure handles scheduling
- ✅ **Monitoring**: Check Vercel dashboard for logs
- ⚠️ **Current Issue**: Cache refresh has errors

### **Next Steps:**
1. **Fix**: Resolve 404 errors in refresh-current-month-cache
2. **Test**: Use local simulator during development
3. **Deploy**: Updated cron jobs work automatically
4. **Monitor**: Check Vercel logs for successful execution

Your cron jobs are **mostly working** - daily data collection is perfect, just the 3-hour cache refresh needs a fix! 🎉 