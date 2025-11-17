# 🚀 TEMPLATE SYSTEM - DEPLOYMENT GUIDE

## Date: November 17, 2025
## Status: Ready for Production Deployment

---

## ✅ PRE-DEPLOYMENT CHECKLIST

- [x] Code implemented
- [x] Database migration ready
- [x] No linting errors
- [x] Documentation complete
- [x] Testing scenarios defined

---

## 📋 DEPLOYMENT STEPS

### Step 1: Apply Database Migration

**Run the migration to create the `email_templates` table:**

```bash
cd /Users/macbook/piotr

# Option 1: Using Supabase CLI
supabase db push

# Option 2: Run SQL directly in Supabase Dashboard
# Go to: https://supabase.com/dashboard → SQL Editor
# Copy & paste: supabase/migrations/006_email_templates.sql
# Click "Run"
```

**Verify table creation:**

```sql
-- Check if table exists
SELECT COUNT(*) FROM email_templates;

-- Should return: 0 (empty table, ready to use)
```

---

### Step 2: Create Default Main Template

**Insert the default global template:**

```sql
-- Get your admin user ID first
SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com';

-- Insert main template (copy the HTML from generatePolishEmailTemplate function)
INSERT INTO email_templates (
  client_id,
  admin_id,
  template_type,
  template_name,
  html_template,
  text_template,
  is_active
) VALUES (
  NULL,  -- NULL = main/global template
  'YOUR-ADMIN-ID-HERE',  -- Replace with your admin ID
  'monthly_report',
  'Domyślny szablon miesięczny',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podsumowanie miesiąca</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    /* ... rest of your default template HTML ... */
  </style>
</head>
<body>
  <!-- Your default email content -->
</body>
</html>',
  'Dzień dobry,

poniżej przesyłam podsumowanie...',
  true
);
```

**Verify insertion:**

```sql
SELECT 
  id,
  client_id,
  template_type,
  template_name,
  is_active,
  created_at
FROM email_templates
WHERE client_id IS NULL;

-- Should return 1 row (your main template)
```

---

### Step 3: Test the System

#### Test 1: Open Calendar and View Tabs

1. Navigate to `/admin/calendar`
2. Click on any scheduled report
3. Click "Email Preview"
4. **Verify**: You see 3 tabs:
   - 👁️ Podgląd Emaila
   - 📄 Szablon Klienta
   - 📄 Szablon Główny

---

#### Test 2: View Main Template

1. Click "Szablon Główny" tab
2. **Verify**: 
   - Purple theme
   - Warning banner: "🔔 Zmiana wpłynie na WSZYSTKICH klientów!"
   - HTML content visible
   - Purple text in editor

---

#### Test 3: Test Auto-Save (Main Template)

1. In "Szablon Główny" tab
2. Make a small edit (add a space, change a word)
3. Stop typing
4. Wait 2-3 seconds
5. **Verify**: See "✅ Zapisano automatycznie: [timestamp]"
6. Refresh page
7. Click "Szablon Główny" again
8. **Verify**: Your changes are saved

---

#### Test 4: Create Client-Specific Template

1. Click "Szablon Klienta" tab
2. **Verify**: Banner says "ℹ️ Ten klient używa głównego szablonu"
3. **Verify**: No "Dostosowany" badge on tab
4. Make an edit (add custom text for this client)
5. Wait 2-3 seconds
6. **Verify**: See "✅ Zapisano automatycznie"
7. **Verify**: Banner changes to "✅ Ten klient ma dostosowany szablon"
8. **Verify**: "Dostosowany" green badge appears on tab

---

#### Test 5: Test Template Inheritance

1. Open calendar for **Client A** (who now has custom template)
2. Open calendar for **Client B** (who doesn't have custom template)
3. **Verify Client A**: Shows custom template in "Szablon Klienta"
4. **Verify Client B**: Shows main template in "Szablon Klienta"
5. Edit main template
6. **Verify**: Client B is affected, Client A is NOT

---

#### Test 6: Reset Client Template

1. Open Client A (who has custom template)
2. Click "Szablon Klienta" tab
3. **Verify**: Button visible "🗑️ Usuń dostosowany szablon"
4. Click button
5. Confirm dialog
6. **Verify**: Badge "Dostosowany" disappears
7. **Verify**: Banner says "ℹ️ Ten klient używa głównego szablonu"
8. **Verify**: HTML now shows main template content

---

### Step 4: Database Verification Queries

**Run these to verify system health:**

```sql
-- 1. Check main template exists
SELECT 
  'Main Template' as type,
  COUNT(*) as count
FROM email_templates
WHERE client_id IS NULL
  AND template_type = 'monthly_report'
  AND is_active = true;
-- Expected: count = 1

-- 2. Check client-specific templates
SELECT 
  'Client Templates' as type,
  COUNT(*) as count
FROM email_templates
WHERE client_id IS NOT NULL
  AND template_type = 'monthly_report'
  AND is_active = true;
-- Expected: count = N (number of customized clients)

-- 3. List all active templates with client names
SELECT 
  et.id,
  CASE 
    WHEN et.client_id IS NULL THEN '🌍 MAIN TEMPLATE (GLOBAL)'
    ELSE CONCAT('👤 ', c.name)
  END as template_for,
  et.template_type,
  LENGTH(et.html_template) as html_size_bytes,
  et.updated_at
FROM email_templates et
LEFT JOIN clients c ON c.id = et.client_id
WHERE et.is_active = true
ORDER BY et.client_id NULLS FIRST;

-- 4. Check which clients use custom templates vs main template
SELECT 
  c.id,
  c.name,
  CASE 
    WHEN et.id IS NOT NULL THEN '✅ Has Custom Template'
    ELSE '📄 Uses Main Template'
  END as template_status
FROM clients c
LEFT JOIN email_templates et 
  ON et.client_id = c.id 
  AND et.template_type = 'monthly_report'
  AND et.is_active = true
WHERE c.api_status = 'valid'
ORDER BY c.name;
```

---

## 🔍 MONITORING

### What to Monitor

#### Auto-Save Logs (Browser Console)

Look for these logs:
```
🔄 Auto-saving template...
✅ Loaded custom template for client: abc-123
✅ Loaded main template
✅ Main template saved (affects all non-customized clients)
✅ Client-specific template saved
```

#### Database Activity

Monitor `email_templates` table:
```sql
-- Check recent template updates
SELECT 
  CASE 
    WHEN client_id IS NULL THEN '🌍 Main Template'
    ELSE '👤 Client Template'
  END as type,
  updated_at,
  admin_id
FROM email_templates
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

---

## 🐛 TROUBLESHOOTING

### Issue 1: "Table does not exist" Error

**Symptom**: Error when opening email preview

**Solution**:
1. Check if migration was applied:
   ```sql
   SELECT * FROM email_templates LIMIT 1;
   ```
2. If error, run migration again:
   ```bash
   supabase db push
   ```

---

### Issue 2: "No template found" Error

**Symptom**: Empty email editor

**Solution**:
1. Check if main template exists:
   ```sql
   SELECT * FROM email_templates WHERE client_id IS NULL;
   ```
2. If empty, insert main template (see Step 2)

---

### Issue 3: Auto-Save Not Working

**Symptom**: No "Zapisano automatycznie" message

**Check**:
1. Open browser console (F12)
2. Look for errors
3. Check if `isEditing` state is true
4. Verify network tab shows POST to Supabase

**Debug**:
```javascript
// Add to console
console.log('isEditing:', isEditing);
console.log('editableHtml length:', editableHtml.length);
```

---

### Issue 4: Permission Denied

**Symptom**: "Permission denied" when saving

**Solution**:
1. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'email_templates';
   ```
2. Verify user is admin:
   ```sql
   SELECT id, email, role FROM profiles 
   WHERE id = auth.uid();
   ```
3. If not admin, update role:
   ```sql
   UPDATE profiles SET role = 'admin' 
   WHERE id = 'YOUR-USER-ID';
   ```

---

## 📊 SUCCESS METRICS

### After 1 Week of Use

**Track these metrics:**

1. **Template Usage**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE client_id IS NULL) as main_template_count,
     COUNT(*) FILTER (WHERE client_id IS NOT NULL) as custom_template_count,
     COUNT(DISTINCT admin_id) as admins_using_system
   FROM email_templates
   WHERE is_active = true;
   ```

2. **Auto-Save Activity**
   ```sql
   SELECT 
     DATE_TRUNC('day', updated_at) as day,
     COUNT(*) as auto_saves
   FROM email_templates
   WHERE updated_at > NOW() - INTERVAL '7 days'
   GROUP BY day
   ORDER BY day;
   ```

3. **Client Customization Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE et.id IS NOT NULL) * 100.0 / COUNT(*) as customization_percentage
   FROM clients c
   LEFT JOIN email_templates et 
     ON et.client_id = c.id 
     AND et.is_active = true
   WHERE c.api_status = 'valid';
   ```

---

## 🎉 ROLLOUT PLAN

### Phase 1: Internal Testing (Day 1-2)
- [ ] Deploy to production
- [ ] Apply migration
- [ ] Create main template
- [ ] Test with 2-3 clients
- [ ] Monitor for errors

### Phase 2: Limited Rollout (Day 3-5)
- [ ] Announce feature to team
- [ ] Train team on 3-tab system
- [ ] Monitor auto-save performance
- [ ] Collect feedback

### Phase 3: Full Rollout (Day 6+)
- [ ] All clients can be customized
- [ ] Main template can be updated globally
- [ ] Monitor metrics weekly
- [ ] Document best practices

---

## 📞 SUPPORT

### If Issues Arise

1. **Check Browser Console** (F12) for errors
2. **Check Supabase Logs** for database errors
3. **Verify RLS Policies** are active
4. **Test with different clients** to isolate issue
5. **Review documentation** (`TEMPLATE_SYSTEM_DOCUMENTATION.md`)

### Contact Points

- **Code Issues**: Review `EmailPreviewModal.tsx`
- **Database Issues**: Check `006_email_templates.sql`
- **Feature Questions**: See `TEMPLATE_SYSTEM_DOCUMENTATION.md`

---

## ✅ DEPLOYMENT COMPLETE CHECKLIST

After deployment, verify:

- [ ] Migration applied successfully
- [ ] Main template inserted
- [ ] 3 tabs visible in UI
- [ ] Auto-save working (2-second delay)
- [ ] Client template creation working
- [ ] Main template editing working
- [ ] Template inheritance working
- [ ] Reset to main template working
- [ ] No console errors
- [ ] RLS policies active
- [ ] Documentation accessible

---

## 🎯 FINAL STATUS

**Deployment Ready**: ✅ **YES**  
**Estimated Deployment Time**: 30 minutes  
**Risk Level**: 🟢 **LOW**  
**Rollback Plan**: Revert migration if major issues

---

**Deployment Guide Prepared By**: Senior Engineer  
**Date**: November 17, 2025  
**Next Action**: Apply database migration and test! 🚀

