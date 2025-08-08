# Executive Summary Cache Clearing Guide

## 🎯 **Overview**

This guide explains how to clear the executive summary cache for development and testing purposes. The cache system stores AI-generated executive summaries to improve performance and reduce API costs, but sometimes you need to clear it to test new generations.

## 🧹 **Methods to Clear Cache**

### **1. Quick Development Script (Recommended)**

```bash
npm run clear-cache
```

This runs the `scripts/clear-cache-dev.js` script which:
- Shows current cache status
- Clears all cached summaries
- Provides confirmation of successful clearing

### **2. Manual Script Execution**

```bash
# Quick clear (no confirmation)
node scripts/clear-cache-dev.js

# Interactive clear (with confirmation)
node scripts/clear-executive-summary-cache.js
```

### **3. API Endpoint (Admin Only)**

```bash
curl -X POST http://localhost:3000/api/executive-summaries/clear-cache \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### **4. Programmatic Clearing**

```typescript
import { ExecutiveSummaryCacheService } from '../lib/executive-summary-cache';

const cacheService = ExecutiveSummaryCacheService.getInstance();
await cacheService.clearAllSummaries();
```

## 📊 **Cache Statistics**

You can check cache status using:

```bash
# Check cache statistics
curl -X GET http://localhost:3000/api/executive-summaries/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🔄 **Testing New Generations**

After clearing the cache:

1. **Go to Reports Page**: Navigate to the reports section
2. **Select a Period**: Choose a date range for testing
3. **Generate PDF**: Click "Generate PDF" to trigger new AI summary generation
4. **Check Cache**: Verify that new summaries are being cached properly

## ⚠️ **Important Notes**

- **Admin Only**: Cache clearing requires admin privileges
- **Development Only**: Only clear cache during development/testing
- **Production**: Never clear cache in production without proper planning
- **Backup**: Consider backing up important summaries before clearing

## 🎯 **When to Clear Cache**

- **Testing AI Generation**: When testing new AI prompt changes
- **Development**: During development of new features
- **Debugging**: When investigating cache-related issues
- **Fresh Start**: When you want to test the full generation flow

## 📝 **Cache Behavior**

After clearing:
- **New Summaries**: Will be generated fresh via AI
- **Caching**: New summaries will be cached automatically
- **Performance**: First generation will be slower (AI call required)
- **Subsequent**: Will be fast (cached retrieval)

## 🔧 **Troubleshooting**

If cache clearing fails:

1. **Check Permissions**: Ensure you have admin access
2. **Database Connection**: Verify Supabase connection
3. **Environment Variables**: Check `.env` file configuration
4. **Logs**: Check console output for error messages

## 🚀 **Next Steps**

After clearing the cache:

1. Test executive summary generation
2. Verify PDF generation works
3. Check that new summaries are cached
4. Monitor performance improvements 