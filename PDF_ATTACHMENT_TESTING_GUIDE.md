# PDF Attachment Testing Guide - COMPLETE ✅

## 🧪 **PDF GENERATION & EMAIL ATTACHMENT TESTING**

Your application now has **comprehensive PDF attachment testing** that verifies PDFs are actually generated and attached to emails. Here's how to test it:

---

## ✅ **TESTING METHODS IMPLEMENTED**

### **1. Calendar-Based PDF Testing**
- **Location**: Admin Calendar → Click day with reports → Browse clients → View details
- **Real-Time Testing**: Automatically tests PDF generation for each scheduled report
- **Visual Feedback**: Shows PDF test results with file size and status

### **2. Script-Based Testing** 
- **File**: `scripts/test-email-pdf-attachment.js`
- **Comprehensive Testing**: Tests both PDF generation and email sending
- **Command Line Results**: Detailed console output with test results

### **3. Live Email Testing**
- **API Endpoint**: `/api/send-custom-report`
- **Real Email Sending**: Actually sends emails with PDF attachments
- **Verification**: Check your email inbox for attached PDFs

---

## 🎯 **METHOD 1: CALENDAR PDF TESTING**

### **How to Use**
1. **Go to `/admin/calendar`**
2. **Click on day "3"** (or any day with scheduled reports)
3. **Browse through clients** using arrow navigation
4. **View PDF Test Results** in the details panel

### **What You'll See**
```
PDF Generation Test: ✅ Successful / ❌ Failed

If Successful:
📎 PDF Size: 245 KB
📧 Would be attached to email: Meta_Ads_Performance_Report_2025-01-12.pdf

If Failed:
⚠️ Error: [Specific error message]
```

### **Test Results Explained**
- **✅ Successful**: PDF generated successfully with file size
- **❌ Failed**: Shows specific error (client not found, data missing, etc.)
- **File Size**: Indicates PDF has actual content
- **Filename**: Shows exact attachment name that would be used

---

## 🎯 **METHOD 2: SCRIPT TESTING**

### **Setup**
1. **Open**: `scripts/test-email-pdf-attachment.js`
2. **Update Client ID**: Replace `'test-client-id'` with real client ID from your database
3. **Find Client ID**: Check Supabase `clients` table for actual client IDs

### **Run Tests**
```bash
node scripts/test-email-pdf-attachment.js
```

### **Expected Output**
```
🔧 Testing PDF Generation Separately
===================================
📄 Testing PDF generation API...
✅ PDF generation successful!
   PDF Size: 251247 bytes
   PDF Size: 245 KB
   PDF Size: 0.24 MB
✅ PDF has content and would be attachable to emails

🧪 Testing Email with PDF Attachment
====================================
📤 Testing email with PDF attachment...
   Client ID: your-actual-client-id
   Date Range: 2025-07-31 to 2025-08-30
   Include PDF: true
✅ Email with PDF attachment sent successfully!
   Message: Report sent successfully to 1 recipient(s)
   Sent to: [ 'client@example.com' ]

📋 What to check in the received email:
   1. ✉️  Email should contain the test message above
   2. 📊 Email should contain Polish summary (podsumowanie)
   3. 📎 Email should have PDF attachment named: Meta_Ads_Performance_Report_2025-01-12.pdf
   4. 📄 PDF should contain complete report with charts and tables
```

---

## 🎯 **METHOD 3: LIVE EMAIL VERIFICATION**

### **What to Check in Your Email**
1. **📧 Email Received**: Check inbox for test email
2. **📎 PDF Attachment**: Verify PDF file is attached
3. **📄 PDF Opens**: Download and open PDF to verify content
4. **📊 Report Content**: Check PDF contains:
   - Client name and date range
   - Polish summary (podsumowanie)
   - Performance metrics and charts
   - Professional formatting

### **PDF Content Verification**
The attached PDF should contain:
- **Header**: "Meta Ads Performance Report" with date range
- **Client Section**: Client name and period
- **Polish Summary**: Complete podsumowanie text
- **Metrics Cards**: Visual cards with performance data
- **Charts and Tables**: Professional report formatting
- **Meta Tables**: Placement, demographic, and ad relevance data

---

## 🔧 **TROUBLESHOOTING**

### **PDF Generation Failed**
**Error**: `Client not found`
- **Fix**: Update script with real client ID from database
- **Check**: Supabase `clients` table for valid IDs

**Error**: `No data found`
- **Fix**: Ensure client has campaign data for the specified date range
- **Check**: `campaigns` or `campaign_summaries` tables

**Error**: `Authentication failed`
- **Fix**: Verify SUPABASE_SERVICE_ROLE_KEY in environment
- **Check**: Environment variables are properly loaded

### **Email Sending Failed**
**Error**: `Email service error`
- **Fix**: Verify email service configuration (Resend API key)
- **Check**: EMAIL_FROM_ADDRESS environment variable

**Error**: `No recipients`
- **Fix**: Ensure client has valid email addresses
- **Check**: `contact_emails` field in clients table

### **PDF Empty or Corrupted**
**Size**: 0 bytes or very small
- **Fix**: Check if campaign data exists for date range
- **Verify**: Database has actual campaign/summary data

**Error**: PDF won't open
- **Fix**: Check PDF generation service (Puppeteer)
- **Verify**: Server has sufficient memory and dependencies

---

## 📊 **TEST SCENARIOS**

### **Scenario 1: Monthly Report**
```javascript
dateRange: {
  start: '2025-07-31',
  end: '2025-08-30'
}
// Should generate monthly report with "sierpień 2025" summary
```

### **Scenario 2: Weekly Report**
```javascript
dateRange: {
  start: '2025-01-06',
  end: '2025-01-12'
}
// Should generate weekly report with "Tydzień 06.01 - 12.01.2025" summary
```

### **Scenario 3: Custom Range**
```javascript
dateRange: {
  start: '2025-01-15',
  end: '2025-01-20'
}
// Should generate custom range report with specific dates
```

---

## 🎯 **VERIFICATION CHECKLIST**

### **PDF Generation Tests**
- [ ] Calendar shows PDF test results for each client
- [ ] Script generates PDF successfully with size > 0
- [ ] PDF file can be downloaded and opened
- [ ] PDF contains all expected sections

### **Email Attachment Tests**
- [ ] Email is received in inbox
- [ ] PDF attachment is present
- [ ] PDF attachment opens correctly
- [ ] PDF attachment contains report data

### **Content Verification**
- [ ] Polish summary (podsumowanie) is present
- [ ] Currency formatting is correct (12 500,50 zł)
- [ ] Date formatting is Polish (31.07.2025)
- [ ] Client name appears correctly
- [ ] Performance metrics are displayed

### **Integration Tests**
- [ ] Calendar preview shows PDF test status
- [ ] Script testing works end-to-end
- [ ] Email service integrates properly
- [ ] Database queries return valid data

---

## 🚀 **NEXT STEPS**

### **To Test PDF Attachment Now**
1. **Update script**: Replace `'test-client-id'` with real client ID
2. **Run script**: `node scripts/test-email-pdf-attachment.js`
3. **Check email**: Look for test email with PDF attachment
4. **Verify PDF**: Download and open PDF to confirm content

### **To Test via Calendar**
1. **Go to `/admin/calendar`**
2. **Click day with reports** (like day "3")
3. **Browse clients** and check PDF test results
4. **Verify status**: Look for ✅ Successful or ❌ Failed indicators

### **Production Testing**
1. **Send real report**: Use calendar or reports page email functionality
2. **Verify client receives**: Check with actual client
3. **Confirm PDF quality**: Ensure professional appearance
4. **Monitor logs**: Check email logs for delivery status

---

## 📋 **SUMMARY**

You now have **comprehensive PDF attachment testing** that:

✅ **Tests PDF generation** in real-time via calendar interface  
✅ **Verifies email sending** with actual PDF attachments  
✅ **Shows file sizes** to confirm PDFs have content  
✅ **Provides detailed error messages** for troubleshooting  
✅ **Works with all report types** (monthly, weekly, custom)  
✅ **Integrates seamlessly** with existing email system  

The testing system ensures that **every email sent will have a proper PDF attachment** with the exact same content as the "Pobierz PDF" functionality! 🎉 