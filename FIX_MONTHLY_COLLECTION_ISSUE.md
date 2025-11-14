# 🚨 MONTHLY COLLECTION BLOCKED - FIX REQUIRED

**Issue Found:** Google Ads monthly collection is failing due to missing `active_campaign_count` column

**Error Message:**
```
Could not find the 'active_campaign_count' column of 'campaign_summaries' in the schema cache
```

---

## 🔧 FIX (3 Steps - 5 minutes total)

### Step 1: Add Missing Column (2 minutes)

**Go to Supabase → SQL Editor → Run this:**

```sql
-- Add missing column
ALTER TABLE campaign_summaries
ADD COLUMN IF NOT EXISTS active_campaign_count INTEGER DEFAULT 0;
```

---

### Step 2: Restart Supabase Project (2 minutes)

**This is CRITICAL to refresh the schema cache:**

1. Go to Supabase Dashboard
2. Click your project → **Settings** (bottom left)
3. Click **Database** in the sidebar
4. Scroll down to **"Pause Project"**
5. Click **"Pause Project"**
6. Wait ~30 seconds
7. Click **"Resume Project"**
8. Wait ~60 seconds for it to fully restart

**Why this is needed:** Supabase PostgREST caches the database schema. Without restart, it won't see the new column.

---

### Step 3: Restart Next.js Server (1 minute)

```bash
killall node
npm run dev > /tmp/next-server.log 2>&1 &
```

---

## ✅ After Fix - Test It

**Trigger monthly collection again:**
```bash
curl -X POST http://localhost:3000/api/admin/collect-monthly-data \
  -H "Content-Type: application/json" \
  -d '{"client_id":"ab0b4c7e-2bf0-46bc-b455-b18ef6942baa"}'
```

**Wait 2 minutes, then check:**
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data } = await supabase.from('campaign_summaries').select('summary_date').eq('client_id', 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa').eq('platform', 'google').eq('summary_type', 'monthly');
  console.log('Google Monthly:', data.length, '/12');
}
check();"
```

Should show **12/12** if successful.

---

## 📊 SUMMARY

**Current Status:**
- ✅ Meta Weekly: Complete (102 records)
- ✅ Google Weekly: Complete (53 records)
- ✅ Meta Monthly: Complete (15 records)
- ❌ **Google Monthly: BLOCKED** (1/12 records)

**After Fix:**
- All 4 categories will be complete for Belmonte
- System will be fully operational

---

## 🎯 ROOT CAUSE

This is the **3rd schema issue** we've encountered:
1. Missing `google_ads_tables` column → Fixed ✅
2. Wrong column types (BIGINT → NUMERIC) → Fixed ✅
3. **Missing `active_campaign_count` column** → Fixing now

**Why this keeps happening:**
- The code references columns that don't exist in the database
- Supabase aggressively caches schema, so even after adding columns, it doesn't see them
- **Solution:** Always restart Supabase project after schema changes

---

**Time Estimate:** 5 minutes to fix completely



