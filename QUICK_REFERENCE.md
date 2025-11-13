# 🚀 Quick Reference - New Email Template

## ✅ What Was Implemented

**4 Required Components** - All implemented and tested:

1. ✅ `generateClientMonthlyReportTemplate()` - Template generator
2. ✅ `prepareClientMonthlyReportData()` - Data preparation with calculations
3. ✅ `sendClientMonthlyReport()` - Email sender
4. ✅ `getPolishMonthName()` - Polish month names

---

## 📍 File Locations

```
src/lib/flexible-email.ts
├─ sendClientMonthlyReport() (line 1008)
└─ generateClientMonthlyReportTemplate() (line 1086)

src/lib/email-helpers.ts
├─ POLISH_MONTHS (line 8)
├─ getPolishMonthName() (line 25)
└─ prepareClientMonthlyReportData() (line 39)
```

---

## 💻 How to Use

### Basic Usage

```typescript
import FlexibleEmailService from './lib/flexible-email';
import { getPolishMonthName, prepareClientMonthlyReportData } from './lib/email-helpers';

// 1. Get Polish month name
const monthName = getPolishMonthName(8); // "sierpień"

// 2. Prepare data (automatic calculations)
const reportData = prepareClientMonthlyReportData(
  'client-id',
  'Client Name',
  8,        // month number
  2025,     // year
  googleAdsData,
  metaAdsData,
  previousYearData  // optional for YoY
);

// 3. Send email
const emailService = FlexibleEmailService.getInstance();
const result = await emailService.sendClientMonthlyReport(
  'client@example.com',
  'client-id',
  'Client Name',
  monthName,
  2025,
  reportData,
  pdfBuffer  // optional
);

console.log(result.success ? 'Sent!' : 'Failed');
```

---

## 📊 Data Structure

### Input: Google Ads Data
```typescript
{
  spend: number,
  impressions: number,
  clicks: number,
  cpc: number,
  ctr: number,
  formSubmits: number,
  emailClicks: number,
  phoneClicks: number,
  bookingStep1: number,
  bookingStep2: number,
  bookingStep3: number,
  reservations: number,
  reservationValue: number
}
```

### Input: Meta Ads Data
```typescript
{
  spend: number,
  impressions: number,
  linkClicks: number,
  formSubmits: number,
  emailClicks: number,
  phoneClicks: number,
  reservations: number,
  reservationValue: number
}
```

### Output: Report Data
```typescript
{
  dashboardUrl: string,
  googleAds: {
    // ... all fields + roas
  },
  metaAds: {
    // ... all fields + roas
  },
  totalOnlineReservations: number,
  totalOnlineValue: number,
  onlineCostPercentage: number,
  totalMicroConversions: number,
  estimatedOfflineReservations: number,
  estimatedOfflineValue: number,
  finalCostPercentage: number,
  totalValue: number,
  yoyComparison?: {
    googleAdsIncrease?: number,
    metaAdsIncrease?: number
  }
}
```

---

## 🧮 What Gets Calculated

`prepareClientMonthlyReportData()` automatically calculates:

- ✅ Total spend (Google + Meta)
- ✅ Total online reservations
- ✅ Total online value
- ✅ Online cost percentage
- ✅ ROAS for both platforms
- ✅ Micro conversions (forms + emails + phones)
- ✅ Offline reservations estimate (20% of micro)
- ✅ Average reservation value
- ✅ Estimated offline value
- ✅ Final cost percentage (with offline)
- ✅ Total value (online + offline)
- ✅ Year-over-year comparison (if previous year data provided)
- ✅ Dashboard URL

**You just provide the raw data, everything else is calculated!**

---

## 📧 Email Template Sections

The generated email includes:

1. **Subject**: `Podsumowanie miesiąca - sierpień 2025 | Client Name`
2. **Greeting**: "Dzień dobry,"
3. **Introduction**: Brief text + dashboard link + PDF notice
4. **Google Ads**: 14 metrics displayed
5. **Meta Ads**: 9 metrics displayed
6. **Summary**: 
   - Year-over-year comparison (if available)
   - Online reservations and cost
   - Micro conversions
   - 20% offline estimate
   - Total value in green box
7. **Closing**: "W razie pytań proszę o kontakt."
8. **Signature**: "Pozdrawiam, Piotr"

---

## ✅ Test Results

Tested with your example data:

```
Input:
  Google: 37,131.43 zł, 88 reservations
  Meta: 18,156.19 zł, 40 reservations

Output:
  ✅ Total online reservations: 128
  ✅ Micro conversions: 551
  ✅ Offline estimate: 110 (20%)
  ✅ Total value: 1,097,692.67 zł
  ✅ Online cost: 9.37%
  ✅ Final cost: 5.04%

All calculations: ✅ CORRECT
```

---

## 🎨 Polish Formatting

All numbers are automatically formatted in Polish:

```
Numbers:      1 270 977 (space separators)
Decimals:     37 131,43 (comma for decimals)
Currency:     37 131,43 zł
Percentages:  2,34%
Months:       sierpień, styczeń, etc.
```

---

## 🔧 API Methods

### sendClientMonthlyReport()

```typescript
await emailService.sendClientMonthlyReport(
  recipient: string,        // "client@example.com"
  clientId: string,         // "client-id"
  clientName: string,       // "Belmonte Hotel"
  monthName: string,        // "sierpień"
  year: number,            // 2025
  reportData: object,      // from prepareClientMonthlyReportData()
  pdfBuffer?: Buffer,      // optional PDF attachment
  provider?: EmailProvider // optional, defaults to Resend
)

Returns:
{
  success: boolean,
  messageId?: string,
  error?: string,
  provider: string
}
```

### prepareClientMonthlyReportData()

```typescript
prepareClientMonthlyReportData(
  clientId: string,
  clientName: string,
  monthNumber: number,        // 1-12
  year: number,
  googleAdsData?: object,     // optional
  metaAdsData?: object,       // optional
  previousYearData?: object   // optional for YoY
)

Returns: Complete report data object
```

### getPolishMonthName()

```typescript
getPolishMonthName(monthNumber: number) // 1-12

Returns: string // "styczeń", "luty", etc.
```

---

## 📝 Example: Full Flow

```typescript
// Step 1: Get data from your database/API
const client = await getClient('client-id');
const googleAds = await getGoogleAdsData(client.id, 8, 2025);
const metaAds = await getMetaAdsData(client.id, 8, 2025);

// Step 2: Get month name
const monthName = getPolishMonthName(8); // "sierpień"

// Step 3: Prepare all data (calculates everything)
const reportData = prepareClientMonthlyReportData(
  client.id,
  client.name,
  8,
  2025,
  googleAds,
  metaAds
);

// Step 4: Generate PDF (your existing function)
const pdfBuffer = await generateMonthlyReportPDF(reportData);

// Step 5: Send email
const emailService = FlexibleEmailService.getInstance();
const result = await emailService.sendClientMonthlyReport(
  client.email,
  client.id,
  client.name,
  monthName,
  2025,
  reportData,
  pdfBuffer
);

// Step 6: Handle result
if (result.success) {
  console.log(`✅ Email sent! ID: ${result.messageId}`);
  await logEmailSent(client.id, result.messageId);
} else {
  console.error(`❌ Failed: ${result.error}`);
  await logEmailError(client.id, result.error);
}
```

---

## ⚡ Quick Tips

1. **Month Number**: Use 1-12, not 0-11
2. **Polish Months**: Use `getPolishMonthName()`, don't hardcode
3. **Data Prep**: Always use `prepareClientMonthlyReportData()` for calculations
4. **Optional Sections**: Google Ads and Meta Ads are optional (conditional rendering)
5. **YoY Comparison**: Only shown if previous year data is provided
6. **PDF Attachment**: Optional, pass `undefined` if no PDF

---

## 🐛 Troubleshooting

**Q: Email not sent?**
- Check Resend API key in `.env`
- Check `result.error` for details

**Q: Calculations wrong?**
- Verify input data structure matches expected format
- Check that reservationValue is in correct currency

**Q: Polish formatting not working?**
- All formatting is automatic with `toLocaleString('pl-PL')`
- No action needed

**Q: Missing sections in email?**
- Google Ads and Meta Ads only show if data provided
- YoY comparison only shows if previous year data provided

---

## ✅ Status

**Implementation**: ✅ Complete  
**Testing**: ✅ Verified  
**Documentation**: ✅ Complete  
**Production**: ✅ Ready  

**You're all set! Start sending professional monthly reports!** 🎉

---

## 📚 Full Documentation

For more details, see:
- `FINAL_AUDIT_COMPLETE.md` - Complete audit
- `VERIFICATION_SUMMARY.md` - Detailed verification
- `EMAIL_SYSTEM_FLOW.md` - Visual diagrams
- `✅_ALL_VERIFIED_WORKING.md` - Verification confirmation




