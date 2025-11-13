# ⚠️ URGENT: Fix Required Before System Works

**Issue:** September shows 0 campaigns because old records have `platform=NULL`

**Query returns:** `campaign_summaries` WHERE `platform='meta'` → 0 results  
**Actual data:** `campaign_summaries` WHERE `platform IS NULL` → 22 campaigns

---

## 🔧 The Fix (Run in Supabase NOW):

```sql
-- Fix NULL platforms to 'meta'
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
```

---

## ✅ Verify It Worked:

```sql
-- Check September after fix
SELECT 
  summary_date,
  platform,
  jsonb_array_length(campaign_data) as campaigns,
  total_spend
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';
```

**Expected result:**
- platform: 'meta' (not NULL)
- campaigns: 22
- total_spend: 12735.18

---

## 🧪 Test After Fix:

After running the SQL, test the API:

```bash
curl -s 'http://localhost:3000/api/fetch-live-data' -X POST \
  -H "Content-Type: application/json" \
  -d '{"clientId": "8657100a-6e87-422c-97f4-b733754a9ff8", "startDate": "2025-09-01", "endDate": "2025-09-30", "platform": "meta"}' \
  | jq '{campaigns: (.data.campaigns | length), spend: .data.stats.totalSpend}'
```

**Expected:**
```json
{
  "campaigns": 22,
  "spend": 12735.18
}
```

---

**This ONE SQL command will fix EVERYTHING!** 🚀








