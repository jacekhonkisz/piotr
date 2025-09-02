# 🚀 **GOOGLE ADS CONFIGURATION TUTORIAL - BELMONTE HOTEL**

## 📋 **OVERVIEW**
This tutorial will fix the 4 critical configuration issues preventing cost data from appearing in your Google Ads integration.

**Time Required**: 5-10 minutes  
**Difficulty**: Easy  
**Result**: Complete cost data tracking  

---

## 🎯 **STEP 1: ACCESS GOOGLE ADS ACCOUNT**

### 1.1 Open Google Ads
1. **Open your web browser**
2. **Go to**: `https://ads.google.com`
3. **Sign in** with the Google account that has access to Belmonte Hotel's ads

### 1.2 Select Correct Account
1. **Look for account selector** (top-right corner)
2. **Find**: "Belmonte Hotel" or Customer ID "789-260-9395"
3. **Click** to select this account
4. **Verify** you're in the correct account (should show Belmonte campaigns)

---

## ⚙️ **STEP 2: FIX ACCOUNT SETTINGS**

### 2.1 Navigate to Account Settings
1. **Click** the **Settings** icon (⚙️) in the left sidebar
2. **Click** "**Account settings**"
3. You should see "Account information" section

### 2.2 Set Currency (CRITICAL)
1. **Look for**: "Currency" field
2. **If it shows**: "Not set" or is blank
3. **Click**: "Edit" or the pencil icon next to Currency
4. **Select**: Appropriate currency for Belmonte Hotel
   - **PLN** (Polish Złoty) if in Poland
   - **EUR** (Euro) if in Europe
   - **USD** (US Dollar) if preferred
5. **Click**: "Save"

⚠️ **IMPORTANT**: Currency cannot be changed once set, so choose carefully!

### 2.3 Set Timezone (CRITICAL)
1. **Look for**: "Time zone" field
2. **If it shows**: "Not set" or is blank
3. **Click**: "Edit" or the pencil icon next to Time zone
4. **Select**: "Europe/Warsaw" (or appropriate timezone for Belmonte)
5. **Click**: "Save"

### 2.4 Set Account Name (Optional)
1. **Look for**: "Account name" field
2. **If it's blank**:
3. **Click**: "Edit"
4. **Type**: "Belmonte Hotel"
5. **Click**: "Save"

### 2.5 Enable Auto-tagging (Recommended)
1. **Look for**: "Auto-tagging" section
2. **If it shows**: "Disabled"
3. **Click**: "Edit"
4. **Toggle**: "Enable auto-tagging"
5. **Click**: "Save"

---

## 💰 **STEP 3: SET CAMPAIGN BUDGETS**

### 3.1 Navigate to Campaigns
1. **Click** "**Campaigns**" in the left sidebar
2. You should see a list of campaigns

### 3.2 Identify Active Campaigns
**Look for these 5 ENABLED campaigns:**
- `[PBM] GSN | Imprezy integracyjne - wybrane wojewódźtwa`
- `[PBM] GSN | Imprezy integracyjne - cała PL`
- `[PBM] GSN | Konferencje w górach - cała PL`
- `[PBM] GSN | Konferencje w górach`
- `[PBM] GSN | Wigilie Firmowe w górach`

### 3.3 Set Budget for Each Campaign
**For EACH of the 5 active campaigns:**

1. **Click** on the campaign name
2. **Look for**: "Budget" section (usually at the top)
3. **Click**: "Edit budget" or the pencil icon
4. **Set daily budget**:
   - **Start with**: $15-25 per day
   - **For high-performing campaigns**: $25-50 per day
   - **For testing**: $10-15 per day
5. **Click**: "Save"

### 3.4 Recommended Budget Allocation
```
Campaign                                    | Suggested Budget
-------------------------------------------|------------------
Imprezy integracyjne - cała PL            | $25/day
Konferencje w górach - cała PL             | $25/day
Imprezy integracyjne - wybrane woj.        | $20/day
Konferencje w górach                       | $20/day
Wigilie Firmowe w górach                   | $15/day
-------------------------------------------|------------------
TOTAL DAILY BUDGET                         | $105/day
```

---

## 💳 **STEP 4: VERIFY BILLING & PAYMENTS**

### 4.1 Check Billing Status
1. **Click** "**Tools & settings**" (🔧 icon in top menu)
2. **Click** "**Billing**"
3. **Verify**:
   - Payment method is active ✅
   - No outstanding balance ✅
   - Account is not suspended ✅

### 4.2 If There Are Billing Issues
1. **Add/update payment method** if needed
2. **Resolve any outstanding payments**
3. **Contact Google Ads support** if account is suspended

---

## ✅ **STEP 5: VERIFY THE CONFIGURATION**

### 5.1 Wait for Data (Important!)
- **Wait**: 24-48 hours for changes to take effect
- **Cost data**: May take up to 48 hours to appear
- **Be patient**: This is normal for Google Ads

### 5.2 Run Verification Script
**After 24-48 hours**, run this command:
```bash
cd /Users/macbook/piotr
node scripts/check-current-status.js
```

### 5.3 Expected Results
You should see:
- ✅ Currency: SET
- ✅ Timezone: SET  
- ✅ Campaign Budgets: > $0
- ✅ Cost Data: Available (after 24-48 hours)

---

## 🔍 **STEP 6: TEST THE INTEGRATION**

### 6.1 Run Data Extraction
**After configuration is complete:**
```bash
node scripts/extract-real-belmonte-data.js
```

### 6.2 What You Should See
- **Cost data**: Real dollar amounts (not $0.00)
- **CPC values**: Actual cost per click
- **Budget utilization**: Spending tracking
- **Complete metrics**: Full financial reporting

---

## 🚨 **TROUBLESHOOTING**

### If Currency/Timezone Options Are Grayed Out
- **Reason**: Account may already have these set
- **Solution**: Check if they show actual values (not "Not set")
- **Action**: Skip to budget configuration

### If You Can't Find Account Settings
1. **Try**: Settings → Account settings
2. **Or**: Tools & settings → Account settings
3. **Or**: Look for ⚙️ icon in navigation

### If Campaigns Don't Show Budget Options
- **Check**: Campaign status (must be ENABLED)
- **Look for**: "Budget" tab within campaign
- **Try**: Campaign settings → Budget

### If Billing Section Is Restricted
- **Reason**: You may not have billing permissions
- **Solution**: Contact account owner/admin
- **Alternative**: Ask someone with billing access to help

---

## 📞 **NEED HELP?**

### Google Ads Support
- **Phone**: Available in Google Ads interface
- **Chat**: Click "?" icon in Google Ads
- **Email**: Through Google Ads help center

### Common Issues
1. **"Currency already set"**: Check if it shows a value (not blank)
2. **"No billing access"**: Need admin permissions
3. **"Campaigns paused"**: Enable campaigns first, then set budgets

---

## 🎉 **SUCCESS CHECKLIST**

**After completing all steps, you should have:**

- ✅ **Currency**: Set to appropriate currency
- ✅ **Timezone**: Set to correct timezone
- ✅ **Account Name**: "Belmonte Hotel"
- ✅ **Auto-tagging**: Enabled
- ✅ **Campaign Budgets**: $15-25/day per active campaign
- ✅ **Billing**: Active payment method
- ✅ **Cost Data**: Appearing in reports (after 24-48 hours)

**Total Time**: 5-10 minutes of configuration + 24-48 hours for data

**Result**: Complete Google Ads cost tracking and financial reporting! 🚀

---

## 📊 **VERIFICATION COMMANDS**

**Check current status:**
```bash
node scripts/check-current-status.js
```

**Extract complete data:**
```bash
node scripts/extract-real-belmonte-data.js
```

**Verify billing fix:**
```bash
node scripts/verify-billing-fix.js
```

---

**🎯 Once complete, your Google Ads integration will provide full cost data, CPC tracking, budget utilization, and complete financial analytics for Belmonte Hotel!**
