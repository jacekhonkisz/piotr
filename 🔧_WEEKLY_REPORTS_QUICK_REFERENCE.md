# 🔧 WEEKLY REPORTS SYSTEM - QUICK REFERENCE

**Last Updated:** November 18, 2025

---

## 🚀 QUICK COMMANDS

### Check for duplicates/issues:
```bash
npx tsx scripts/check-weekly-duplicates.ts
```

### Clean up bad data (Supabase SQL Editor):
```sql
-- File: scripts/remove-non-monday-weeks.sql
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;
```

### Trigger data collection:
```bash
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET'
```

### View recent weeks (Supabase SQL Editor):
```sql
SELECT 
  summary_date,
  platform,
  TO_CHAR(summary_date, 'Dy') as day_of_week,
  total_spend,
  reservations,
  booking_step_1
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
  AND summary_type = 'weekly'
ORDER BY summary_date DESC
LIMIT 20;
```

---

## 📊 CURRENT STATUS (Nov 18, 2025)

```
Total Weekly Records: 158
✅ Duplicates: 0
❌ Non-Monday Weeks: 59 (37%)
⚠️  Empty Data: 29 (18%)

Status: 🟡 FUNCTIONAL WITH DATA QUALITY ISSUES
```

---

## 🎯 COLLECTION ENDPOINTS

### ✅ USE THIS:
```
/api/automated/incremental-weekly-collection
Schedule: Every Monday 2 AM
Performance: < 2 minutes
Logic: Collects only missing weeks
```

### ❌ DON'T USE THESE:
```
/api/automated/collect-weekly-summaries    (timeouts)
/api/background/collect-weekly             (duplicate)
/api/optimized/weekly-collection           (unclear purpose)
```

---

## 🗄️ DATABASE SCHEMA

```sql
campaign_summaries (
  id UUID PRIMARY KEY,
  client_id UUID,
  summary_type TEXT,           -- 'weekly' | 'monthly'
  summary_date DATE,            -- MUST BE MONDAY for weekly!
  platform TEXT,                -- 'meta' | 'google'
  
  total_spend DECIMAL,
  total_clicks BIGINT,
  reservations BIGINT,
  booking_step_1 BIGINT,
  
  campaign_data JSONB,
  
  UNIQUE(client_id, summary_type, summary_date, platform)
)
```

---

## 🐛 KNOWN ISSUES

### 1. Google Ads Wrong Week Dates
- **Issue:** 83% of Google Ads weeks don't start on Monday
- **Impact:** Week-over-week comparisons broken
- **Fix:** Add `getMondayOfWeek()` helper to collection code

### 2. Empty Data Records
- **Issue:** 29 weeks have $0 spend
- **Possible Cause:** Legitimate (no campaigns) OR collection failure
- **Action:** Investigate client's Google Ads usage

---

## 🛠️ FIX CODE SNIPPET

```typescript
// Add to src/lib/background-data-collector.ts

/**
 * Get Monday of ISO week
 */
private getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Use it:
const weekStart = this.getMondayOfWeek(new Date());
```

---

## 📚 DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `✅_WEEKLY_REPORTS_EXECUTIVE_SUMMARY.md` | Start here! TL;DR overview |
| `📊_WEEKLY_REPORTS_SYSTEM_LOGIC_AND_AUDIT.md` | Complete system documentation |
| `🔍_WEEKLY_REPORTS_AUDIT_RESULTS.md` | Detailed audit + fix instructions |
| `🔧_WEEKLY_REPORTS_QUICK_REFERENCE.md` | This file - quick commands |

---

## 🧪 SCRIPTS

| Script | Purpose | How to Run |
|--------|---------|------------|
| `scripts/check-weekly-duplicates.ts` | Audit data quality | `npx tsx scripts/check-weekly-duplicates.ts` |
| `scripts/remove-non-monday-weeks.sql` | Delete bad records | Run in Supabase SQL Editor |
| `scripts/fix-duplicate-weeks.sql` | Remove duplicates | Run in Supabase SQL Editor |
| `scripts/audit-belmonte-weekly-quality.sql` | Quality check | Run in Supabase SQL Editor |

---

## 🎯 ACTION CHECKLIST

### Today:
- [ ] Run audit: `npx tsx scripts/check-weekly-duplicates.ts`
- [ ] Clean database: Run `scripts/remove-non-monday-weeks.sql`
- [ ] Re-collect: Trigger incremental collection

### This Week:
- [ ] Add `getMondayOfWeek()` helper
- [ ] Fix Google Ads collection code
- [ ] Add validation
- [ ] Test thoroughly

### This Month:
- [ ] Remove legacy endpoints
- [ ] Add monitoring
- [ ] Document best practices

---

## 🔍 USEFUL QUERIES

### Check for duplicates:
```sql
SELECT 
  summary_date,
  platform,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
GROUP BY summary_date, platform
HAVING COUNT(*) > 1;
```

### Check for non-Monday weeks:
```sql
SELECT 
  summary_date,
  platform,
  EXTRACT(DOW FROM summary_date) as day_of_week,
  TO_CHAR(summary_date, 'Dy') as day_name
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1
ORDER BY summary_date DESC;
```

### Check for empty data:
```sql
SELECT 
  summary_date,
  platform,
  total_spend,
  reservations,
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_array_length(campaign_data::jsonb) = 0 THEN 'EMPTY'
    ELSE 'OK'
  END as campaign_data_status
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
  AND (total_spend = 0 OR reservations = 0)
ORDER BY summary_date DESC;
```

---

## ❓ QUICK FAQ

**Q: How do I check for issues?**  
A: `npx tsx scripts/check-weekly-duplicates.ts`

**Q: How do I fix non-Monday weeks?**  
A: Run `scripts/remove-non-monday-weeks.sql` in Supabase

**Q: How do I trigger collection?**  
A: POST to `/api/automated/incremental-weekly-collection`

**Q: Which endpoint should I use?**  
A: `/api/automated/incremental-weekly-collection` (only this one!)

**Q: Do I have duplicates?**  
A: No! ✅ Zero duplicates found

---

## 🎓 QUICK CONCEPTS

### ISO Week:
- Starts on Monday
- Ends on Sunday
- 7 days total
- Used globally for business reporting

### Data Priority:
1. **daily_kpi_data** (highest) - Manual uploads
2. **Meta/Google API** - Real-time data
3. **smart_cache** - Cached responses
4. **campaign_summaries** - Historical records

### Collection Types:
- **Incremental** (recommended) - Only missing weeks
- **Full** (deprecated) - All 53 weeks (timeouts!)
- **Manual** - On-demand via API call

---

## 📞 NEED HELP?

1. Check documentation files above
2. Run audit script for current status
3. Review audit results document for fix instructions
4. All code examples are copy-paste ready!

---

**Status:** 🟡 System functional, data quality improvements recommended  
**Last Audit:** November 18, 2025  
**Next Action:** Run cleanup script + fix Google Ads code

