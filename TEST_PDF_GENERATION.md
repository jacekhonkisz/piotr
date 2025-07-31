# PDF Generation Test Guide

## 🧪 Testing PDF Generation with Meta API Data

### **Quick Test Steps**

1. **Start the development server** (ignore TypeScript errors for now):
   ```bash
   npm run dev
   ```

2. **Open your browser** and go to: `http://localhost:3000/reports`

3. **Login** with your credentials

4. **Select a month** from the dropdown (e.g., current month)

5. **Click "Generuj PDF"** button

6. **Check the generated PDF** - it should now contain real Meta API data

### **What to Look For**

✅ **Real Data Indicators**:
- Campaign names from your actual Meta Ads campaigns
- Real spend amounts from your campaigns
- Current date ranges (not static "July 2025")
- Actual impressions, clicks, conversions from Meta API

❌ **Demo Data Indicators** (if still showing):
- Campaign names like "Summer Sale Campaign", "Brand Awareness"
- Static spend amounts like 2450.75 zł, 1800.50 zł
- Static date ranges like "July 2025 - July 2025"

### **Expected Results**

**Before (Demo Data)**:
- Campaign names: "Summer Sale Campaign", "Brand Awareness", etc.
- Spend: 2450.75 zł, 1800.50 zł, 3200.25 zł
- Date: "July 2025 - July 2025" (static)

**After (Real Meta API Data)**:
- Campaign names: Your actual Meta Ads campaign names
- Spend: Real amounts from your campaigns
- Date: Current month/year (dynamic)
- Metrics: Real impressions, clicks, conversions

### **Troubleshooting**

If you still see demo data:

1. **Check browser console** for errors
2. **Check server logs** for Meta API errors
3. **Verify Meta API tokens** are valid
4. **Check ad account IDs** are correct

### **Success Indicators**

✅ **PDF contains real data** when:
- Campaign names match your Meta Ads campaigns
- Spend amounts are your actual campaign spend
- Date ranges are current (not static)
- No "demo-campaign" references

### **🎉 Expected Outcome**

Your PDF generation should now:
- ✅ **Fetch real Meta API data** instead of demo data
- ✅ **Show actual campaign performance** from your Meta Ads account
- ✅ **Display current date ranges** dynamically
- ✅ **Match the data** you see on the `/reports` page

The PDF will now be a **true reflection** of your Meta Ads performance data! 🚀 