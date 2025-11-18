# 🎯 BELMONTE COLLECTION STATUS CHECK

## 🔍 SITUATION

**From Logs:**
- Collection started for 16 clients
- Logs show only "Hotel Lambert" (1st client) being processed
- Logs cut off - likely **TIMEOUT** before reaching Belmonte
- Belmonte is in the client list but not yet processed

## ⚠️ LIKELY ISSUE: 5-MINUTE TIMEOUT

**Timeline Analysis:**
- Started: 13:27:34
- Last log: 13:28:01 (still on Hotel Lambert week 33)
- **Duration so far:** ~27 seconds
- **Problem:** Hotel Lambert has 54 weeks × ~1 second each = **54 seconds per client**
- **16 clients × 54 seconds = ~14 minutes** total (exceeds Vercel's 5-minute limit!)

---

## ✅ ACTION PLAN

### Option 1: Check If It Completed (Unlikely)
Run this SQL in Supabase to see if Belmonte data was collected:

```sql
-- Quick check: Did Belmonte get any weekly data in the last hour?
SELECT COUNT(*) as weeks_collected
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.created_at > NOW() - INTERVAL '1 hour';
```

**Expected:** 0 (collection didn't reach Belmonte before timeout)

---

### Option 2: Trigger Collection ONLY for Belmonte (RECOMMENDED)

Since the full collection times out, let's collect data **only for Belmonte**:

```bash
# Get Belmonte client ID first
curl -X POST 'https://piotr-gamma.vercel.app/api/fetch-live-data' \
  -H 'Content-Type: application/json' \
  -d '{
    "startDate": "2024-11-11",
    "endDate": "2024-11-17",
    "clientIds": ["<BELMONTE_CLIENT_ID>"],
    "forceFresh": true
  }'
```

But we need Belmonte's client ID first.

---

### Option 3: Use Manual Trigger Per Client (BEST FOR TESTING)

Since you need production-ready data for Belmonte specifically:

1. **Get Belmonte ID** from the SQL query above
2. **Trigger collection** for just that client
3. **Verify data** appears correctly in reports

---

## 🚀 IMMEDIATE NEXT STEP

Run the SQL query in `scripts/check-belmonte-collection-status.sql` and tell me:

1. **Belmonte's client ID**
2. **How many weekly summaries** were collected in the last hour (should be 0)
3. **Total weekly summaries** for Belmonte (all time)

Then I'll trigger a focused collection just for Belmonte.


