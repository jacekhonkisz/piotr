# 🚀 GOOGLE ADS FINAL SETUP - STEP BY STEP GUIDE

## 📋 **CURRENT STATUS**
- ✅ **API Integration**: Working perfectly
- ✅ **OAuth Authentication**: Fixed and working
- ✅ **Customer ID**: Correct (789-260-9395)
- ✅ **Campaigns**: Active and getting traffic (499 impressions, 62 clicks, 1 conversion)
- ❌ **Spend Data**: $0.00 (because budgets are $0.00)

## 🎯 **WHAT YOU NEED TO DO (5 MINUTES)**

### **STEP 1: Open Google Ads**
1. Go to: **https://ads.google.com**
2. Log in with your Belmonte Hotel account
3. Make sure you're in the correct account (Customer ID: 789-260-9395)

### **STEP 2: Set Currency to PLN**
1. Click **Settings** (gear icon) in top right
2. Click **Account settings**
3. Find **Currency** field (currently shows "Not set")
4. Click **Edit** button
5. Select **PLN (Polish Złoty)**
6. Click **Save**

⚠️ **WARNING**: Currency cannot be changed once set! Make sure PLN is correct.

### **STEP 3: Set Campaign Budgets**
1. Go to **Campaigns** tab (left sidebar)
2. You'll see your active campaigns:
   - [PBM] GSN | Konferencje w górach
   - [PBM] GSN | Imprezy integracyjne
   - [PBM] GSN | Wigilie Firmowe w górach
   - etc.

3. **For each active campaign** (green status):
   - Click on the campaign name
   - Click **Settings** tab
   - Find **Budget** section
   - Click **Edit** (pencil icon)
   - Set daily budget (recommended: **50-100 PLN/day**)
   - Click **Save**

### **STEP 4: Enable Auto-tagging**
1. Go to **Settings** → **Account settings**
2. Find **Auto-tagging** section
3. Turn **ON** auto-tagging
4. Click **Save**

### **STEP 5: Add Payment Method**
1. Go to **Tools & Settings** → **Billing & payments**
2. Click **Payment methods**
3. Click **Add payment method**
4. Add your credit card or bank account
5. Set as primary payment method

## ⚡ **IMMEDIATE RESULTS AFTER SETUP**

Once you complete these steps, within **15-30 minutes** you'll see:

```bash
# Run this command to see live spend data:
node scripts/current-month-realtime-spend.js
```

**Expected output after setup:**
```
📊 CURRENT MONTH REAL-TIME SPEND ANALYSIS
=========================================

💰 CURRENT MONTH TOTAL SPEND
============================
💵 TOTAL SPEND: 247.50 PLN
👁️  TOTAL IMPRESSIONS: 1,245
🖱️  TOTAL CLICKS: 89
🎯 TOTAL CONVERSIONS: 3
📊 AVERAGE CPC: 2.78 PLN
💰 COST PER CONVERSION: 82.50 PLN

📅 DAILY SPEND BREAKDOWN (Current Month)
========================================
🔴 TODAY: 45.20 PLN | 156 imp | 12 clicks | 1 conv
   Aug 26: 38.90 PLN | 134 imp | 8 clicks | 0 conv
   Aug 25: 52.30 PLN | 178 imp | 15 clicks | 1 conv

🎯 CAMPAIGN SPEND BREAKDOWN (Current Month)
===========================================
   1. 🟢 [PBM] GSN | Konferencje w górach
      💰 Spend: 89.40 PLN | Budget: 50.00 PLN/day
      📊 Traffic: 456 imp, 34 clicks
      🎯 Conversions: 2
      💵 CPC: 2.63 PLN

⚡ TODAY'S REAL-TIME SPEND
==========================
📅 TODAY (2025-08-27) - Live Data:
   💰 Today's Spend: 45.20 PLN
   📊 Today's Traffic: 156 impressions, 12 clicks
   🎯 Today's Conversions: 1
   💵 Daily Budget: 150.00 PLN
   📈 Budget Utilization: 30.1%
```

## 🔄 **REAL-TIME MONITORING COMMANDS**

After setup, use these commands to monitor spend:

### **Current Month Spend:**
```bash
node scripts/current-month-realtime-spend.js
```

### **Live Spend Monitoring (Every 30 minutes):**
```bash
node scripts/realtime-spend-monitor.js
```

### **Historical Spend Analysis:**
```bash
node scripts/fetch-spend-data.js
```

## ⏱️ **TIMELINE**

- **Setup time**: 5 minutes
- **Data flow starts**: 15-30 minutes after setup
- **Full historical data**: Available immediately
- **Real-time updates**: Every 15-30 minutes (same as Meta Ads)

## 🎯 **RECOMMENDED BUDGET SETTINGS**

Based on your current traffic (499 impressions, 62 clicks this month):

### **Conservative Start:**
- **Active campaigns**: 25-50 PLN/day each
- **Total daily budget**: 100-200 PLN
- **Monthly spend**: ~3,000-6,000 PLN

### **Aggressive Growth:**
- **Active campaigns**: 75-100 PLN/day each  
- **Total daily budget**: 300-400 PLN
- **Monthly spend**: ~9,000-12,000 PLN

## 🚨 **CRITICAL NOTES**

1. **Currency**: Cannot be changed once set - choose PLN carefully
2. **Budgets**: Start conservative, increase based on performance
3. **Payment method**: Required for spend to start
4. **Auto-tagging**: Essential for conversion tracking

## ✅ **VERIFICATION CHECKLIST**

After completing setup, verify:
- [ ] Currency shows "PLN" in account settings
- [ ] Campaign budgets show actual PLN amounts (not $0.00)
- [ ] Auto-tagging is enabled
- [ ] Payment method is active
- [ ] Campaigns show "Eligible" status (not "Budget limited")

## 🎉 **SUCCESS INDICATORS**

You'll know it's working when:
- ✅ Real-time spend shows PLN amounts (not $0.00)
- ✅ Daily spend increases throughout the day
- ✅ Budget utilization shows percentages
- ✅ CPC calculations show PLN values
- ✅ Conversion costs show in PLN

## 🆘 **NEED HELP?**

If you encounter issues:
1. Run: `node scripts/check-current-status.js`
2. Check the verification checklist above
3. Ensure all 5 setup steps are completed

**The API integration is 100% ready - just waiting for the account configuration! 🚀**
