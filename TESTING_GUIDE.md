# 🧪 Testing Guide - Automated Email System

## 🎯 How to Test the Integration

### Test 1: Verify Data Fetching Works

**Test that Google Ads and Meta Ads data can be fetched for a client:**

```typescript
// test-data-fetch.ts
import 'dotenv/config';
import { GoogleAdsStandardizedDataFetcher } from './src/lib/google-ads-standardized-data-fetcher';
import { StandardizedDataFetcher } from './src/lib/standardized-data-fetcher';

async function testDataFetch() {
  const clientId = 'YOUR_CLIENT_ID';
  const period = {
    start: '2025-10-01',
    end: '2025-10-31'
  };

  console.log('Testing Google Ads fetch...');
  const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
    clientId,
    dateRange: period,
    reason: 'test'
  });
  console.log('Google Ads success:', googleResult.success);
  console.log('Google Ads data:', googleResult.data?.stats);

  console.log('\nTesting Meta Ads fetch...');
  const metaResult = await StandardizedDataFetcher.fetchData({
    clientId,
    dateRange: period,
    platform: 'meta',
    reason: 'test'
  });
  console.log('Meta Ads success:', metaResult.success);
  console.log('Meta Ads data:', metaResult.data?.stats);
}

testDataFetch();
```

**Run**:
```bash
npx tsx test-data-fetch.ts
```

**Expected Output**:
```
Testing Google Ads fetch...
Google Ads success: true
Google Ads data: { totalSpend: 12345, totalImpressions: 678910, ... }

Testing Meta Ads fetch...
Meta Ads success: true
Meta Ads data: { totalSpend: 5678, totalImpressions: 234567, ... }
```

---

### Test 2: Verify Period Calculation

**Test that periods are calculated correctly:**

```typescript
// test-period-calc.ts
import { EmailScheduler } from './src/lib/email-scheduler';

const scheduler = new EmailScheduler();

// Mock client
const monthlyClient = {
  id: 'test',
  name: 'Test Client',
  reporting_frequency: 'monthly' as const,
  send_day: 5
};

const weeklyClient = {
  id: 'test',
  name: 'Test Client',
  reporting_frequency: 'weekly' as const,
  send_day: 2  // Tuesday
};

console.log('Today:', new Date().toISOString().split('T')[0]);
console.log('\nMonthly period:', (scheduler as any).getReportPeriod(monthlyClient));
console.log('Weekly period:', (scheduler as any).getReportPeriod(weeklyClient));
```

**Expected Output**:
```
Today: 2025-11-05

Monthly period: { start: '2025-10-01', end: '2025-10-31' }
Weekly period: { start: '2025-10-28', end: '2025-11-03' }
```

---

### Test 3: Verify Metric Calculations

**Test that all calculations work correctly:**

```typescript
// test-calculations.ts
import 'dotenv/config';
import { prepareClientMonthlyReportData } from './src/lib/email-helpers';

const googleAdsData = {
  spend: 10000,
  impressions: 500000,
  clicks: 5000,
  cpc: 2.0,
  ctr: 1.0,
  formSubmits: 10,
  emailClicks: 20,
  phoneClicks: 30,
  bookingStep1: 100,
  bookingStep2: 50,
  bookingStep3: 25,
  reservations: 20,
  reservationValue: 100000
};

const metaAdsData = {
  spend: 5000,
  impressions: 300000,
  linkClicks: 3000,
  formSubmits: 5,
  emailClicks: 10,
  phoneClicks: 15,
  reservations: 10,
  reservationValue: 50000
};

const reportData = prepareClientMonthlyReportData(
  'test-client',
  'Test Hotel',
  10,
  2025,
  googleAdsData,
  metaAdsData
);

console.log('Calculations:');
console.log('  Total online reservations:', reportData.totalOnlineReservations);
console.log('  Total online value:', reportData.totalOnlineValue);
console.log('  Online cost %:', reportData.onlineCostPercentage.toFixed(2) + '%');
console.log('  Micro conversions:', reportData.totalMicroConversions);
console.log('  Offline estimate:', reportData.estimatedOfflineReservations);
console.log('  Final cost %:', reportData.finalCostPercentage.toFixed(2) + '%');
console.log('  Total value:', reportData.totalValue.toFixed(2));
```

**Expected Output**:
```
Calculations:
  Total online reservations: 30
  Total online value: 150000
  Online cost %: 10.00%
  Micro conversions: 90
  Offline estimate: 18
  Final cost %: 6.38%
  Total value: 235000.00
```

---

### Test 4: Send Test Email to Yourself

**Send a test email with real data:**

```typescript
// test-send-email.ts
import 'dotenv/config';
import FlexibleEmailService from './src/lib/flexible-email';
import { getPolishMonthName, prepareClientMonthlyReportData } from './src/lib/email-helpers';

async function sendTestEmail() {
  const googleAdsData = {
    spend: 42567.89,
    impressions: 1456823,
    clicks: 34521,
    cpc: 1.23,
    ctr: 2.37,
    formSubmits: 2,
    emailClicks: 48,
    phoneClicks: 567,
    bookingStep1: 21456,
    bookingStep2: 2845,
    bookingStep3: 712,
    reservations: 95,
    reservationValue: 468234.56
  };

  const metaAdsData = {
    spend: 19876.43,
    impressions: 1398765,
    linkClicks: 12987,
    formSubmits: 1,
    emailClicks: 7,
    phoneClicks: 18,
    reservations: 45,
    reservationValue: 209876.00
  };

  const monthName = getPolishMonthName(10);
  const reportData = prepareClientMonthlyReportData(
    'test-client',
    'Test Hotel',
    10,
    2025,
    googleAdsData,
    metaAdsData
  );

  const emailService = FlexibleEmailService.getInstance();
  const result = await emailService.sendClientMonthlyReport(
    'YOUR_VERIFIED_EMAIL@example.com',  // Change this!
    'test-client',
    'Test Hotel',
    monthName,
    2025,
    reportData
  );

  console.log('Result:', result);
}

sendTestEmail();
```

**Run**:
```bash
npx tsx test-send-email.ts
```

---

### Test 5: Check Who Would Receive Emails Today

**See which clients are scheduled to receive emails:**

```typescript
// check-scheduled.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkScheduled() {
  const today = new Date();
  const currentDay = today.getDate();
  const currentWeekday = today.getDay() === 0 ? 7 : today.getDay();

  console.log('Today:', today.toISOString().split('T')[0]);
  console.log('Day of month:', currentDay);
  console.log('Day of week:', currentWeekday);
  console.log('');

  // Check monthly clients
  const { data: monthlyClients } = await supabase
    .from('clients')
    .select('id, name, email, reporting_frequency, send_day')
    .eq('api_status', 'valid')
    .eq('reporting_frequency', 'monthly')
    .eq('send_day', currentDay);

  console.log('Monthly reports to send today:', monthlyClients?.length || 0);
  monthlyClients?.forEach(client => {
    console.log(`  - ${client.name} (${client.email})`);
  });

  // Check weekly clients
  const { data: weeklyClients } = await supabase
    .from('clients')
    .select('id, name, email, reporting_frequency, send_day')
    .eq('api_status', 'valid')
    .eq('reporting_frequency', 'weekly')
    .eq('send_day', currentWeekday);

  console.log('\nWeekly reports to send today:', weeklyClients?.length || 0);
  weeklyClients?.forEach(client => {
    console.log(`  - ${client.name} (${client.email})`);
  });
}

checkScheduled();
```

---

### Test 6: Manual Send to Specific Client

**Manually trigger a report for testing:**

```typescript
// manual-send.ts
import 'dotenv/config';
import { EmailScheduler } from './src/lib/email-scheduler';

async function manualSend() {
  const scheduler = new EmailScheduler();
  
  const result = await scheduler.sendManualReport(
    'YOUR_CLIENT_ID',     // Change this!
    'YOUR_ADMIN_ID',      // Change this!
    {
      start: '2025-10-01',
      end: '2025-10-31'
    }
  );

  console.log('Result:', result);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('Period:', result.period);
  } else {
    console.log('❌ Failed:', result.error);
  }
}

manualSend();
```

---

### Test 7: Check Email Logs

**View what emails were sent:**

```sql
-- Recent scheduled emails
SELECT 
  clients.name,
  email_scheduler_logs.report_period_start,
  email_scheduler_logs.report_period_end,
  email_scheduler_logs.email_sent,
  email_scheduler_logs.email_sent_at,
  email_scheduler_logs.error_message
FROM email_scheduler_logs
LEFT JOIN clients ON clients.id = email_scheduler_logs.client_id
WHERE email_scheduler_logs.operation_type = 'scheduled'
ORDER BY email_scheduler_logs.created_at DESC
LIMIT 10;
```

---

## 🔍 Debugging Checklist

### If Emails Not Sending

1. **Check Scheduler is Enabled**:
   ```sql
   SELECT * FROM system_settings WHERE key = 'email_scheduler_enabled';
   ```

2. **Check Client Configuration**:
   ```sql
   SELECT 
     id, name, email, 
     reporting_frequency, send_day,
     api_status,
     google_ads_enabled,
     meta_access_token
   FROM clients
   WHERE id = 'YOUR_CLIENT_ID';
   ```

3. **Check Recent Logs**:
   ```sql
   SELECT * FROM email_scheduler_logs
   WHERE client_id = 'YOUR_CLIENT_ID'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

4. **Check Resend API Key**:
   ```bash
   echo $RESEND_API_KEY
   ```

5. **Check Data Availability**:
   ```sql
   SELECT COUNT(*) FROM daily_kpi_data
   WHERE client_id = 'YOUR_CLIENT_ID'
   AND date >= '2025-10-01'
   AND date <= '2025-10-31';
   ```

---

## ✅ Success Criteria

**The integration works if**:

1. ✅ Data fetching returns success for both platforms
2. ✅ Period calculation returns correct dates
3. ✅ Calculations match expected values
4. ✅ Test email sends successfully
5. ✅ Logs show no errors
6. ✅ Email arrives with correct data
7. ✅ Each client receives only their data

---

## 🚀 Ready for Production

**Before going live**:

1. ✅ Test with at least one real client
2. ✅ Verify email looks good
3. ✅ Verify data is accurate
4. ✅ Enable scheduler in system settings
5. ✅ Monitor logs for first week

**After going live**:

1. Check email_scheduler_logs daily
2. Verify clients are receiving emails
3. Monitor for any errors
4. Adjust send_day if needed



