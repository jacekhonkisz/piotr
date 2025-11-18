# 📊 BATCH SIZE ANALYSIS FOR SINGLE CLIENT (BELMONTE)

## 🎯 Goal: Complete collection for 54 weeks without timeout

---

## Current Attempt: Batch Size = 5

### **Configuration**:
- Weeks per batch: 5
- Total batches: 11 (54 ÷ 5)
- Processing: Parallel (Promise.all)

### **Expected Time**:
```
11 batches × 4-5s per batch = 44-55 seconds
+ Database overhead: ~10s
+ Network latency: ~10s
= ~65-75 seconds total
```

### **Result**: ❌ **Times out at 120 seconds**

### **Why?**
Not the math - it's the **PARALLELISM**:
- 5 parallel API calls → Meta rate limit triggered
- 5 parallel DB writes → Connection pool exhausted
- 5 parallel `daily_kpi_data` queries → DB congestion

---

## Solution 1: Reduce Batch Size (But Keep One API Call)

### **Batch Size = 2 (Minimal Parallelism)**

**Configuration**:
- Weeks per batch: 2 (only 2 parallel operations)
- Total batches: 27 (54 ÷ 2)
- Processing: Parallel (Promise.all with 2)

**Expected Time**:
```
27 batches × 3-4s per batch = 81-108 seconds
+ Database overhead: ~15s
+ Network latency: ~15s
= ~110-140 seconds total
```

**Result**: ⚠️ **Might still timeout** (close to 180s limit)

---

### **Batch Size = 1 (Sequential)**

**Configuration**:
- Weeks per batch: 1 (no parallelism)
- Total batches: 54
- Processing: Sequential (one at a time)

**Expected Time**:
```
54 weeks × 2-3s per week = 108-162 seconds
+ Database overhead: ~10s
+ Network latency: ~10s
= ~130-180 seconds total
```

**Result**: ⚠️ **Will barely fit** (right at timeout edge)

**Issues**:
- Very fragile (any slowdown = timeout)
- Defeats the purpose of optimization
- Still all in ONE serverless call

---

## Solution 2: Split Into MULTIPLE API Calls

### **Multiple Small Batches (Recommended)**

**Configuration**:
- Weeks per call: 3-5 weeks
- Weeks per batch: 1 (sequential within each call)
- Total API calls: 11-18 separate requests

**Per Call Time**:
```
3-5 weeks × 2-3s per week = 6-15 seconds per call ✅
+ Overhead: ~5s
= ~10-20 seconds per call
```

**Total Time**:
```
If calling sequentially: 18 × 15s = 270 seconds (4.5 min)
If calling in parallel (5 at a time): 4 batches × 20s = 80 seconds
```

**Result**: ✅ **Each individual call completes successfully**

**How to implement**:
```bash
# Call 1: Weeks 0-4
curl '/api/collect-weekly-summaries?testClient=belmonte&startWeek=0&endWeek=4'

# Call 2: Weeks 5-9
curl '/api/collect-weekly-summaries?testClient=belmonte&startWeek=5&endWeek=9'

# ... etc (11 calls total)
```

---

## Solution 3: On-Demand Fetching (BEST)

### **Fetch Only What's Needed, When Needed**

**Configuration**:
- User opens Week 39 report
- System checks: "Do we have Week 39 in DB?"
- If NO: Fetch Week 39 ONLY (one API call, 5-10s)
- If YES: Return cached data (instant)

**Per Request Time**:
```
1 week × 3s (API) + 2s (DB) + 2s (processing) = ~7 seconds ✅
```

**Benefits**:
- ✅ Always completes successfully
- ✅ Only fetches what's viewed
- ✅ Better user experience (progressive loading)
- ✅ No timeout risk

**Implementation**:
```typescript
// src/app/api/reports/weekly/[period]/route.ts
export async function GET(request, { params }) {
  const { period } = params; // e.g., "2025-W39"
  
  // Check database
  const cached = await getWeekFromDatabase(period);
  if (cached) return cached;
  
  // Fetch from Meta API (ONE week only)
  const freshData = await fetchWeekFromMetaAPI(period); // 5-10s
  
  // Store in database
  await storeWeekInDatabase(freshData);
  
  return freshData;
}
```

---

## 📊 Comparison Table

| Approach | Batches Needed | Time Per Call | Success Rate | User Experience |
|----------|----------------|---------------|--------------|-----------------|
| **Current (Batch=5)** | 11 | 120s+ | ❌ 0% | Timeout, no data |
| **Batch=2** | 27 | 110-140s | ⚠️ 50% | Sometimes works |
| **Batch=1** | 54 | 130-180s | ⚠️ 60% | Barely works |
| **Multiple Calls (5 weeks each)** | 11 calls × 5 weeks | 10-20s each | ✅ 95% | Eventually complete |
| **On-Demand** | 1 per week viewed | 5-10s | ✅ 100% | Instant, progressive |

---

## 🎯 ANSWER: How Many Batches?

### **For ONE Serverless Function Call:**
- **Minimum batches needed**: 54 (batch size = 1, sequential)
- **Time required**: 130-180 seconds
- **Success rate**: ~60% (too fragile)

### **For RELIABLE Collection:**
- **Split into**: 11-18 separate API calls
- **Each call**: 3-5 weeks (sequential)
- **Time per call**: 10-20 seconds ✅
- **Success rate**: 95%+

### **BEST APPROACH:**
- **Don't batch at all!**
- **Fetch on-demand**: 1 week at a time when user views it
- **Time per request**: 5-10 seconds
- **Success rate**: 100%

---

## 🚀 Recommendation

**Stop trying to collect all 54 weeks at once!**

1. **Current week**: Smart cache (already working) ✅
2. **Historical weeks**: On-demand fetch (when user opens report)
3. **Background backfill**: Cron job collects 1 week/hour (optional)

This gives you:
- ✅ Fast user experience (5-10s response)
- ✅ No timeout issues
- ✅ Works within serverless constraints
- ✅ Only fetch what's actually needed

**Answer to your question:**
- **Theoretically**: 54 batches (batch size = 1) might work
- **Practically**: Even that's too risky for serverless
- **Reality**: Need to split into **11+ separate API calls** OR use **on-demand fetching**

