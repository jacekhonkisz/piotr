# 📧 EMAIL SYSTEM QUICK REFERENCE

## 🎯 ONE SERVICE, ONE TEMPLATE

**Service**: `FlexibleEmailService`  
**Template**: Monthly Report (Polish)  
**Location**: `/admin/calendar`

---

## 🚀 QUICK START

### Send Email Manually:
```typescript
import FlexibleEmailService from './lib/flexible-email';

const emailService = FlexibleEmailService.getInstance();

await emailService.sendClientMonthlyReport(
  'client@example.com',
  'client-id-uuid',
  'Client Name',
  'sierpień',  // Polish month
  2025,
  {
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard',
    totalOnlineReservations: 129,
    totalOnlineValue: 594000,
    // ... more data
  },
  pdfBuffer  // optional
);
```

---

## 📋 TEMPLATE FORMAT

```
Subject: Podsumowanie miesiąca - sierpień 2025 | Client Name

Body:
Dzień dobry,

poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.

Szczegółowe raporty za działania znajdą Państwo w panelu klienta - TUTAJ

1. Google Ads
[All metrics: spend, impressions, clicks, CPC, CTR, forms, emails, phones, booking steps, reservations, value, ROAS]

2. Meta Ads  
[All metrics: spend, impressions, link clicks, forms, emails, phones, reservations, value, ROAS]

Podsumowanie ogólne
[YoY comparison, online summary, micro conversions, 20% offline, total value]

Pozdrawiam
Piotr
```

---

## 🗓️ CALENDAR ACCESS

**URL**: `https://yourdomain.com/admin/calendar`

**Features**:
- View all scheduled reports
- Click date to see scheduled emails
- Preview emails (matches actual template)
- Send reports immediately

---

## 🔧 API ENDPOINTS

### Send Report:
```bash
POST /api/send-report
Authorization: Bearer [TOKEN]
Body: {
  "clientId": "uuid",
  "reportId": "uuid",  // optional
  "includePdf": true
}
```

### Send Custom Report:
```bash
POST /api/send-custom-report
Authorization: Bearer [TOKEN]
Body: {
  "clientId": "uuid",
  "dateRange": {
    "start": "2025-08-01",
    "end": "2025-08-31"
  },
  "customMessage": "Optional message"
}
```

### Bulk Send:
```bash
POST /api/admin/send-bulk-reports
# Sends to ALL active clients
```

---

## 🤖 AUTOMATED SCHEDULER

**Trigger**: Daily at 9:00 AM UTC  
**Endpoint**: `/api/automated/send-scheduled-reports`  
**Security**: Requires `x-cron-secret` header

**How it works**:
1. Checks all active clients
2. Filters by `reporting_frequency` and `send_day`
3. Fetches Google + Meta Ads data
4. Calculates metrics
5. Generates PDF
6. Sends using NEW monthly template
7. Logs to `email_scheduler_logs`

---

## 📊 TEMPLATE DATA STRUCTURE

```typescript
interface MonthlyReportData {
  dashboardUrl: string;
  
  googleAds?: {
    spend: number;
    impressions: number;
    clicks: number;
    cpc: number;
    ctr: number;
    formSubmits: number;
    emailClicks: number;
    phoneClicks: number;
    bookingStep1: number;
    bookingStep2: number;
    bookingStep3: number;
    reservations: number;
    reservationValue: number;
    roas: number;
  };
  
  metaAds?: {
    spend: number;
    impressions: number;
    linkClicks: number;
    formSubmits: number;
    emailClicks: number;
    phoneClicks: number;
    reservations: number;
    reservationValue: number;
    roas: number;
  };
  
  yoyComparison?: {
    googleAdsIncrease?: number;
    metaAdsIncrease?: number;
  };
  
  totalOnlineReservations: number;
  totalOnlineValue: number;
  onlineCostPercentage: number;
  totalMicroConversions: number;
  estimatedOfflineReservations: number;
  estimatedOfflineValue: number;
  finalCostPercentage: number;
  totalValue: number;
}
```

---

## 🌍 ENVIRONMENT VARIABLES

```bash
# Required
RESEND_API_KEY=re_xxxxx
EMAIL_FROM_ADDRESS=reports@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Optional (for Gmail fallback)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxxx

# For scheduler
CRON_SECRET=your_secret
```

---

## 🎨 POLISH MONTH NAMES

```typescript
const months = [
  'styczeń',    // January
  'luty',       // February
  'marzec',     // March
  'kwiecień',   // April
  'maj',        // May
  'czerwiec',   // June
  'lipiec',     // July
  'sierpień',   // August
  'wrzesień',   // September
  'październik',// October
  'listopad',   // November
  'grudzień'    // December
];
```

---

## 🔍 TROUBLESHOOTING

### Email not sending?
1. Check `email_logs` table
2. Verify `RESEND_API_KEY` is set
3. Check recipient email is valid
4. Review error message in logs

### Wrong template showing?
- All routes now use `FlexibleEmailService.sendClientMonthlyReport()`
- Old services deleted: EmailService, GmailEmailService
- Clear browser cache if seeing old preview

### Dashboard link not working?
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Link format: `${NEXT_PUBLIC_APP_URL}/dashboard`

---

## 📞 SUPPORT

**Files to check**:
- `src/lib/flexible-email.ts` - Email service
- `src/lib/email-scheduler.ts` - Scheduler logic
- `src/lib/email-template-generator.ts` - Template helper
- `src/app/api/send-report/route.ts` - Manual send API
- `src/app/admin/calendar/page.tsx` - Calendar UI

**Database tables**:
- `email_logs` - Individual email logs
- `email_scheduler_logs` - Scheduled send logs
- `clients` - Client configuration

---

**Last Updated**: November 17, 2025  
**Version**: 1.0 (Consolidated)





