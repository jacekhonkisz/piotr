# 🚨 CRITICAL DATABASE SCHEMA FAILURE

**Date:** October 1, 2025  
**Severity:** 🔴 **CRITICAL SYSTEM FAILURE**  
**Issue:** Complete database schema missing (not just reports tables)  
**Impact:** Entire application non-functional  

---

## ⚡ **WHAT HAPPENED**

The error `relation "clients" does not exist` reveals that your **entire database schema is missing**, not just the reports tables. This means:

- ❌ **No `clients` table** → No client data
- ❌ **No `profiles` table** → No user authentication  
- ❌ **No `campaign_summaries` table** → No reports data
- ❌ **No core application tables** → App completely broken

This is a **complete database schema failure**, not just missing reports functionality.

---

## 🔍 **IMMEDIATE DIAGNOSIS**

**Run this first:** `DATABASE_SCHEMA_DIAGNOSIS.sql`

This will show you:
- ✅ Which tables exist
- ❌ Which tables are missing  
- 🔍 Migration history
- 📋 Specific recommendations

**Expected findings:**
- Most/all tables missing
- No migration history
- Core Supabase tables may be missing

---

## 🎯 **ROOT CAUSE ANALYSIS**

### **Most Likely Causes:**

1. **Database Was Reset/Recreated**
   - Production database was wiped
   - Only base Supabase schema restored
   - Application migrations never re-run

2. **Migration Files Never Deployed**
   - Code has migration files
   - But Supabase never executed them
   - Possibly manual deployment process

3. **Wrong Database Environment**
   - Connected to staging/test database
   - Production database is elsewhere
   - Environment configuration issue

4. **Supabase Project Issues**
   - Project was recreated
   - Migrations not synced
   - Database connection problems

---

## 🛠️ **RECOVERY OPTIONS**

### **Option 1: Complete Schema Recovery** ⭐ **RECOMMENDED**

**If you have migration files in your codebase:**

1. **Find initial schema:**
   - Look for: `supabase/migrations/001_initial_schema.sql`
   - This should contain `clients`, `profiles`, etc.

2. **Run all migrations in order:**
   ```bash
   # If using Supabase CLI
   supabase db reset
   supabase db push
   
   # Or manually run each migration file
   ```

3. **Expected migration files:**
   - `001_initial_schema.sql` (core tables)
   - `002_fix_campaigns_rls.sql`
   - `003_add_token_management.sql`
   - ... (all 50+ migration files)

---

### **Option 2: Manual Schema Creation** ⚠️ **If No Migrations**

**If migration files are missing:**

1. **Create core tables manually:**
   ```sql
   -- Create clients table
   CREATE TABLE clients (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT UNIQUE NOT NULL,
     admin_id UUID REFERENCES auth.users(id),
     meta_access_token TEXT,
     google_ads_enabled BOOLEAN DEFAULT FALSE,
     reporting_frequency TEXT DEFAULT 'monthly',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Create profiles table  
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users(id) PRIMARY KEY,
     role TEXT DEFAULT 'client',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Add RLS policies:**
   ```sql
   ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   
   -- Add policies...
   ```

---

### **Option 3: Database Restore** 🔄 **If Backup Exists**

**If you have a database backup:**

1. **Supabase Dashboard:**
   - Settings → Database → Backups
   - Find backup from before schema loss
   - Restore from backup

2. **Manual backup restore:**
   - Export from backup source
   - Import to current database

---

## 📋 **STEP-BY-STEP RECOVERY**

### **Step 1: Diagnose Current State** (2 min)

Run: `DATABASE_SCHEMA_DIAGNOSIS.sql`

**Look for:**
- Which tables exist
- Migration history
- Auth schema status

---

### **Step 2: Choose Recovery Method** (1 min)

**If migration files exist:** → Option 1 (Complete Schema Recovery)  
**If no migration files:** → Option 2 (Manual Schema Creation)  
**If backup exists:** → Option 3 (Database Restore)

---

### **Step 3: Execute Recovery** (10-30 min)

**For Option 1 (Recommended):**

1. **Check migration files:**
   ```bash
   ls supabase/migrations/
   # Should see: 001_initial_schema.sql, 002_*, etc.
   ```

2. **Run migrations:**
   ```bash
   # Using Supabase CLI
   supabase db reset
   supabase db push
   
   # Or manually in Supabase Dashboard SQL Editor
   # Run each migration file in order
   ```

3. **Verify core tables:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name IN ('clients', 'profiles', 'campaigns', 'reports');
   ```

---

### **Step 4: Create Reports Tables** (5 min)

Once core schema exists, run:
1. `SAFE_01_CREATE_TABLES_ONLY.sql`
2. `SAFE_02_CREATE_INDEXES.sql`  
3. `SAFE_03_CREATE_POLICIES.sql`

---

### **Step 5: Restore Data** (10-60 min)

**If you have data backups:**
- Restore client data
- Restore user profiles
- Restore any existing reports

**If no data backups:**
- Recreate clients manually
- Users will need to re-register
- Historical data is lost

---

## 🚨 **URGENT ACTIONS NEEDED**

### **Immediate (Next 30 minutes):**

1. **Run diagnosis:** `DATABASE_SCHEMA_DIAGNOSIS.sql`
2. **Check migration files:** `ls supabase/migrations/`
3. **Choose recovery method** based on findings
4. **Execute recovery** (Option 1 if migrations exist)

### **This Hour:**

5. **Verify core functionality** works
6. **Create reports tables** (safe scripts)
7. **Test user login** and basic features
8. **Notify team** of the issue

### **Today:**

9. **Restore/recreate data** as possible
10. **Set up monitoring** to prevent recurrence
11. **Document incident** for team
12. **Enable backups** if not already

---

## 📊 **SEVERITY ASSESSMENT**

| Component | Status | Impact |
|-----------|--------|--------|
| **User Authentication** | ❌ Broken | Users can't login |
| **Client Management** | ❌ Broken | No client data |
| **Reports System** | ❌ Broken | No historical data |
| **Core Application** | ❌ Broken | App non-functional |
| **Database Schema** | ❌ Missing | Complete failure |

**Overall:** 🔴 **CRITICAL - Complete System Outage**

---

## 🆘 **EMERGENCY CONTACTS**

**If you need immediate help:**

1. **Check Supabase Status:** https://status.supabase.com
2. **Supabase Support:** Dashboard → Support
3. **Team Lead:** Notify immediately
4. **Database Admin:** If you have one

---

## 📝 **INCIDENT RESPONSE**

### **Communication:**

**To Users:**
- "We're experiencing technical difficulties"
- "Working to restore service ASAP"
- "Updates will be provided hourly"

**To Team:**
- "Complete database schema failure"
- "Recovery in progress"
- "ETA: 1-2 hours"

**To Management:**
- "Critical system outage"
- "Root cause: Database schema missing"
- "Recovery plan: Execute migrations"
- "Prevention: Set up monitoring"

---

## 🔄 **PREVENTION (After Recovery)**

### **Immediate:**

1. **Enable Supabase Backups:**
   - Daily automated backups
   - 30-day retention
   - Point-in-time recovery

2. **Set Up Schema Monitoring:**
   - Daily checks for missing tables
   - Alerts if schema changes
   - Migration verification

### **Long-term:**

3. **Automated Deployment:**
   - CI/CD pipeline for migrations
   - Staging environment testing
   - Production deployment automation

4. **Disaster Recovery Plan:**
   - Documented recovery procedures
   - Regular backup testing
   - Team training on procedures

---

## 📞 **NEXT STEPS**

1. **Run:** `DATABASE_SCHEMA_DIAGNOSIS.sql` **RIGHT NOW**
2. **Share output** with team/support
3. **Choose recovery method** based on findings
4. **Execute recovery** immediately
5. **Test core functionality** after recovery
6. **Set up monitoring** to prevent recurrence

---

## ⏱️ **ESTIMATED TIMELINE**

| Task | Duration | Priority |
|------|----------|----------|
| **Diagnosis** | 5 min | 🔴 Critical |
| **Choose method** | 5 min | 🔴 Critical |
| **Schema recovery** | 15-45 min | 🔴 Critical |
| **Data restoration** | 30-120 min | 🟡 High |
| **Testing** | 15 min | 🟡 High |
| **Monitoring setup** | 30 min | 🟢 Medium |

**Total Recovery Time:** 1.5-3.5 hours  
**Critical Path:** Schema recovery (15-45 min)

---

## 🎯 **SUCCESS CRITERIA**

Recovery is complete when:

- ✅ `clients` table exists and has data
- ✅ `profiles` table exists and has data  
- ✅ Users can login successfully
- ✅ Basic application functionality works
- ✅ Reports tables created (campaign_summaries, etc.)
- ✅ No critical errors in logs
- ✅ Monitoring system in place

---

**PRIORITY:** 🔴 **CRITICAL - START IMMEDIATELY**

This is a complete system outage. Your application is non-functional until the database schema is restored.

**First action:** Run `DATABASE_SCHEMA_DIAGNOSIS.sql` to understand the full scope of the problem.

---

**Document:** DATABASE_SCHEMA_RECOVERY_GUIDE.md  
**Status:** 🔴 Critical - Immediate Action Required  
**Estimated Recovery:** 1.5-3.5 hours  
**Next Step:** Run diagnosis script










