# 🗄️ Database Update Guide for Havet and Belmonte

## 📊 Current Status

**Database State**: 
- ✅ `campaign_summaries` table exists and is properly configured
- ✅ Both Havet and Belmonte have valid Meta API tokens and ad accounts
- ❌ **No data currently stored** for Havet and Belmonte in the smart caching system
- ⚠️ Only jacek has 2 monthly records (incomplete)

**Expected Results After Update**:
- **Havet**: 12 monthly + 52 weekly records = 64 total
- **Belmonte**: 12 monthly + 52 weekly records = 64 total  
- **jacek**: 12 monthly + 52 weekly records = 64 total
- **Total**: 192 records for all clients

## 🚀 How to Update the Database

### **Option 1: Admin Monitoring Page (Recommended)**

1. **Start your Next.js server**:
   ```bash
   npm run dev
   ```

2. **Navigate to admin monitoring**:
   ```
   http://localhost:3000/admin/monitoring
   ```

3. **Click the collection buttons**:
   - **"Run Monthly Collection"** - Collects 12 months of data
   - **"Run Weekly Collection"** - Collects 52 weeks of data

4. **Monitor progress**:
   - Watch the storage statistics update
   - Check the recent logs for collection status
   - Wait for completion (may take 10-20 minutes)

### **Option 2: Direct API Calls (Requires Admin Auth)**

If you prefer to use the API directly:

1. **Set admin credentials in `.env.local`**:
   ```bash
   ADMIN_EMAIL=your-admin-email@example.com
   ADMIN_PASSWORD=your-admin-password
   ```

2. **Run the collection script**:
   ```bash
   node scripts/run-collection-with-auth.js
   ```

### **Option 3: Manual Database Verification**

After collection, verify the data:

```bash
# Check current storage status
node scripts/verify-campaign-summaries-storage.js

# Check specific clients
node scripts/check-clients.js
```

## 📈 What Happens During Collection

### **Monthly Collection Process**:
1. **Fetches data** for last 12 months from Meta API
2. **Calculates totals** for spend, impressions, clicks, conversions
3. **Stores summaries** in `campaign_summaries` table
4. **Includes meta tables** (placement, demographic, ad relevance data)

### **Weekly Collection Process**:
1. **Fetches data** for last 52 weeks from Meta API
2. **Same data structure** as monthly but with weekly granularity
3. **Stores in same table** with `summary_type: 'weekly'`

### **Smart Caching Benefits**:
- **Recent data (last 12 months)**: Loads instantly from database
- **Historical data (beyond 12 months)**: Live-fetched from Meta API
- **Performance improvement**: 39x faster for stored data
- **Better user experience**: Fast loading in reports page

## 🔍 Verification Steps

### **After Collection, You Should See**:

1. **Storage Statistics**:
   - Total summaries: 192+ records
   - Monthly count: 36 records (3 clients × 12 months)
   - Weekly count: 156 records (3 clients × 52 weeks)

2. **Data Distribution**:
   - Havet: 64 records (12 monthly + 52 weekly)
   - Belmonte: 64 records (12 monthly + 52 weekly)
   - jacek: 64 records (12 monthly + 52 weekly)

3. **Date Coverage**:
   - Monthly: August 2024 - July 2025
   - Weekly: August 2024 - July 2025
   - All data within last 12 months

## ⚠️ Important Notes

### **Collection Time**:
- **Monthly**: ~5-10 minutes for all clients
- **Weekly**: ~10-20 minutes for all clients
- **Total**: 15-30 minutes for complete collection

### **API Rate Limits**:
- Meta API has rate limits
- Collection includes delays between requests
- Don't interrupt the process

### **Data Freshness**:
- Monthly data: Valid for 7 days
- Weekly data: Valid for 24 hours
- Current month: Always fetched live (3-hour cache)

## 🎯 Expected Results

### **Before Collection**:
- Reports page: Slow loading (API calls)
- User experience: Waiting for data
- Performance: No caching benefits

### **After Collection**:
- Reports page: Fast loading for recent data
- User experience: Instant access to last 12 months
- Performance: 39x improvement for stored data
- Smart caching: Working as intended

## 🚨 Troubleshooting

### **If Collection Fails**:
1. Check Meta API token validity
2. Verify ad account permissions
3. Check server logs for errors
4. Ensure admin role permissions

### **If Data is Incomplete**:
1. Re-run collection for missing periods
2. Check Meta API response errors
3. Verify client configuration
4. Monitor collection logs

## 📋 Next Steps

1. **Run the collection** using admin monitoring page
2. **Monitor progress** and wait for completion
3. **Verify data** using verification scripts
4. **Test performance** in reports page
5. **Enjoy fast loading** for recent data!

---

**💡 Pro Tip**: The admin monitoring page provides real-time updates on collection progress and storage statistics. Use it to monitor the collection process and verify completion. 