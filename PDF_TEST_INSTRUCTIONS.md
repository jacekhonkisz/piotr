# PDF Generation Test Instructions

## 🧪 Testing PDF Generation with Meta API Data

### **Step 1: Verify Development Server is Running**
```bash
npm run dev
```
Make sure the server is running on http://localhost:3000

### **Step 2: Test PDF Generation via Browser**

1. **Open your browser** and go to: `http://localhost:3000/reports`

2. **Login** with your credentials

3. **Select a month** from the dropdown (e.g., current month)

4. **Click "Generuj PDF"** button

5. **Check the generated PDF** - it should now contain:
   - ✅ **Real campaign names** from your Meta Ads account
   - ✅ **Actual spend amounts** from your campaigns  
   - ✅ **Real impressions, clicks, conversions** from Meta API
   - ✅ **Current date ranges** (not static dates)
   - ✅ **Live performance metrics** from your actual campaigns

### **Step 3: Test PDF Generation via API**

You can also test the API directly:

```bash
# Get a client ID and month
curl -X GET "http://localhost:3000/api/download-pdf?reportId=CLIENT_ID-MONTH" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output test-pdf.pdf
```

### **Step 4: Verify Meta API Integration**

The PDF generation now:

1. **Checks database** for existing campaign data
2. **If no data found** → Calls Meta API via `/api/fetch-live-data`
3. **Uses real campaign data** from Meta API
4. **Falls back to demo data** only if API fails

### **Step 5: Expected Results**

✅ **Before (Demo Data)**:
- Campaign names: "Summer Sale Campaign", "Brand Awareness", etc.
- Static spend amounts: 2450.75 zł, 1800.50 zł, etc.
- Static date: "July 2025 - July 2025"

✅ **After (Real Meta API Data)**:
- Campaign names: Your actual Meta Ads campaign names
- Real spend amounts: Actual amounts from your campaigns
- Dynamic dates: Current month/year
- Real metrics: Actual impressions, clicks, conversions

### **Step 6: Troubleshooting**

If you still see demo data:

1. **Check Meta API tokens**:
   ```bash
   node scripts/check-clients.js
   ```

2. **Verify API permissions**:
   - Tokens need `ads_management` or `ads_read` permissions
   - Ad account IDs must be correct

3. **Check server logs**:
   - Look for Meta API errors in the console
   - Verify `/api/fetch-live-data` is working

4. **Test API endpoint directly**:
   - Go to `/reports` page
   - Check browser network tab for API calls
   - Verify real data is being fetched

### **Step 7: Success Indicators**

✅ **PDF contains real data** when:
- Campaign names match your Meta Ads campaigns
- Spend amounts are your actual campaign spend
- Date ranges are current (not static)
- No "demo-campaign" references in the PDF

### **🎉 Expected Outcome**

After this test, your PDF generation should:
- ✅ **Fetch real Meta API data** instead of demo data
- ✅ **Show actual campaign performance** from your Meta Ads account
- ✅ **Display current date ranges** dynamically
- ✅ **Match the data** you see on the `/reports` page

The PDF will now be a **true reflection** of your Meta Ads performance data! 🚀 