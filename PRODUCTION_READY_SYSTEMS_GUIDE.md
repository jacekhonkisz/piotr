# 🏗️ Building Stable Production-Ready Systems

**Based on Real Experience:** Lessons from your data collection issue  
**Applies to:** Any production system, especially data pipelines  

---

## 🎯 **CORE PRINCIPLES**

### **1. Assume Everything Will Fail**

**What we saw in your system:**
- Daily collection partially failed (got campaigns but not conversions)
- No retry mechanism
- No alerts when data incomplete
- Silent failures accumulated over months

**Better approach:**
```typescript
// ❌ BAD: Assume success
async function collectData() {
  const data = await fetchFromAPI();
  await saveToDatabase(data);
}

// ✅ GOOD: Expect and handle failures
async function collectData() {
  try {
    const data = await fetchFromAPI();
    
    // Validate before saving
    if (!isComplete(data)) {
      throw new Error('Incomplete data received');
    }
    
    await saveToDatabase(data);
    await logSuccess(data);
    
  } catch (error) {
    await logError(error);
    await notifyTeam(error);
    await retryWithBackoff();
  }
}
```

---

## 🔄 **RELIABILITY PATTERNS**

### **Pattern 1: Retry with Exponential Backoff**

**Your issue:** Daily collection failed once and never retried.

**Solution:**
```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
      
      console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
    }
  }
  throw new Error('Should never reach here');
}

// Usage
const data = await fetchWithRetry(() => fetchMetaAdsData(client));
```

---

### **Pattern 2: Circuit Breaker**

**Prevents:** Cascading failures when external API is down.

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold = 5,          // Open after 5 failures
    private timeout = 60000,        // Try again after 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error('Circuit breaker opened!');
    }
  }
}

// Usage
const metaAdsBreaker = new CircuitBreaker();
const data = await metaAdsBreaker.execute(() => fetchMetaAds());
```

---

### **Pattern 3: Idempotency**

**Your issue:** If aggregation runs twice, does it duplicate data?

**Solution:** Make operations idempotent (safe to retry).

```typescript
// ❌ BAD: Not idempotent
async function saveDailyData(data: DailyData) {
  await db.insert('daily_kpi_data', data);
  // Running twice = duplicate records
}

// ✅ GOOD: Idempotent with upsert
async function saveDailyData(data: DailyData) {
  await db.upsert('daily_kpi_data', data, {
    conflictColumns: ['client_id', 'date', 'platform']
  });
  // Running twice = same result (no duplicates)
}
```

**Database level:**
```sql
-- Use UNIQUE constraints
CREATE TABLE daily_kpi_data (
  client_id UUID NOT NULL,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  -- ... metrics
  UNIQUE(client_id, date, platform)  -- Prevents duplicates
);
```

---

## 🔍 **DATA INTEGRITY**

### **Atomic Operations**

**Your issue:** Campaign data saved, conversions not saved → split data.

**Solution:** All or nothing.

```typescript
// ❌ BAD: Can leave partial data
async function collectDailyData(client: Client, date: string) {
  const campaigns = await fetchCampaigns(client, date);
  await saveCampaigns(campaigns);  // ✅ Saved
  
  const conversions = await fetchConversions(client, date);
  await saveConversions(conversions);  // ❌ Might fail
}

// ✅ GOOD: Atomic with transaction
async function collectDailyData(client: Client, date: string) {
  return await db.transaction(async (trx) => {
    // Fetch all data first
    const [campaigns, conversions] = await Promise.all([
      fetchCampaigns(client, date),
      fetchConversions(client, date)
    ]);
    
    // Validate completeness
    if (!campaigns || !conversions) {
      throw new Error('Incomplete data - rolling back');
    }
    
    // Save together (atomic)
    await trx.insert('daily_kpi_data', {
      ...campaigns,
      ...conversions
    });
    
    // All or nothing - if conversion save fails, campaign save rolls back too
  });
}
```

---

### **Data Validation**

**Your issue:** Incomplete data wasn't detected until months later.

**Solution:** Validate immediately.

```typescript
interface DailyDataRequirements {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  click_to_call: number;
  email_contacts: number;
  reservations: number;
}

function validateDailyData(data: Partial<DailyDataRequirements>): void {
  const required: (keyof DailyDataRequirements)[] = [
    'total_spend',
    'total_impressions', 
    'total_clicks',
    'click_to_call',
    'email_contacts',
    'reservations'
  ];
  
  const missing = required.filter(key => data[key] === undefined);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  // Validate logical consistency
  if (data.total_spend! > 0 && data.total_impressions === 0) {
    throw new Error('Illogical: has spend but zero impressions');
  }
  
  if (data.total_clicks! > data.total_impressions!) {
    throw new Error('Illogical: more clicks than impressions');
  }
}

// Usage
async function collectData() {
  const data = await fetchData();
  
  validateDailyData(data);  // Throws if invalid
  
  await saveData(data);
}
```

---

### **Consistency Checks**

**Your issue:** Data split between sources wasn't detected.

**Solution:** Regular health checks.

```typescript
// Run after every aggregation
async function verifyDataConsistency(month: string) {
  const summaries = await db.query(`
    SELECT 
      client_id,
      total_spend,
      click_to_call,
      email_contacts
    FROM campaign_summaries
    WHERE summary_date = $1
  `, [month]);
  
  const issues: string[] = [];
  
  for (const summary of summaries) {
    // Check 1: Has spend but no conversions
    if (summary.total_spend > 0 && summary.click_to_call === 0) {
      issues.push(`${summary.client_id}: Has spend but no conversions`);
    }
    
    // Check 2: Has conversions but no spend
    if (summary.click_to_call > 0 && summary.total_spend === 0) {
      issues.push(`${summary.client_id}: Has conversions but no spend`);
    }
    
    // Check 3: Unrealistic conversion rate
    const conversionRate = summary.click_to_call / summary.total_impressions;
    if (conversionRate > 0.1) {  // > 10% is suspicious
      issues.push(`${summary.client_id}: Unrealistic conversion rate: ${conversionRate}`);
    }
  }
  
  if (issues.length > 0) {
    await alertTeam({
      title: 'Data Consistency Issues Detected',
      issues: issues,
      month: month
    });
  }
  
  return issues.length === 0;
}
```

---

## 📊 **MONITORING & OBSERVABILITY**

### **The Three Pillars**

**1. Metrics**
```typescript
// Track everything
const metrics = {
  // Success/failure rates
  dailyCollectionSuccess: new Counter('daily_collection_success'),
  dailyCollectionFailure: new Counter('daily_collection_failure'),
  
  // Performance
  apiResponseTime: new Histogram('api_response_time_ms'),
  
  // Data quality
  incompleteDataCount: new Gauge('incomplete_data_count'),
  
  // Business metrics
  totalSpendCollected: new Gauge('total_spend_collected'),
  totalConversionsCollected: new Gauge('total_conversions_collected')
};

async function collectData() {
  const startTime = Date.now();
  
  try {
    const data = await fetchData();
    
    metrics.apiResponseTime.observe(Date.now() - startTime);
    metrics.dailyCollectionSuccess.inc();
    metrics.totalSpendCollected.set(data.total_spend);
    
    if (!isComplete(data)) {
      metrics.incompleteDataCount.inc();
    }
    
  } catch (error) {
    metrics.dailyCollectionFailure.inc();
    throw error;
  }
}
```

**2. Logging**
```typescript
// Structured logging
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

async function collectData(client: Client, date: string) {
  logger.info({
    event: 'collection_start',
    clientId: client.id,
    date: date
  });
  
  try {
    const data = await fetchData();
    
    logger.info({
      event: 'collection_success',
      clientId: client.id,
      date: date,
      spend: data.total_spend,
      conversions: data.click_to_call
    });
    
  } catch (error) {
    logger.error({
      event: 'collection_failure',
      clientId: client.id,
      date: date,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

**3. Alerting**
```typescript
// Alert on critical issues
async function monitorDailyCollection() {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if collection ran
  const collections = await db.query(`
    SELECT COUNT(*) as count
    FROM daily_kpi_data
    WHERE date = $1
  `, [today]);
  
  const expectedClients = 16;
  const actualClients = collections[0].count;
  
  if (actualClients < expectedClients) {
    await sendAlert({
      severity: 'CRITICAL',
      title: 'Daily Collection Incomplete',
      message: `Expected ${expectedClients} clients, got ${actualClients}`,
      action: 'Check daily-kpi-collection logs'
    });
  }
  
  // Check data quality
  const incomplete = await db.query(`
    SELECT COUNT(*) as count
    FROM daily_kpi_data
    WHERE date = $1
      AND (total_spend > 0 AND click_to_call = 0
           OR click_to_call > 0 AND total_spend = 0)
  `, [today]);
  
  if (incomplete[0].count > 0) {
    await sendAlert({
      severity: 'HIGH',
      title: 'Incomplete Data Detected',
      message: `${incomplete[0].count} clients have split data`,
      action: 'Run data validation script'
    });
  }
}
```

---

## 🧪 **TESTING STRATEGY**

### **Test Pyramid**

```
        /\
       /  \    E2E Tests (Few, Slow, Expensive)
      /____\
     /      \   Integration Tests (Some, Medium Speed)
    /________\
   /          \  Unit Tests (Many, Fast, Cheap)
  /____________\
```

### **Unit Tests**
```typescript
// Test individual functions
describe('validateDailyData', () => {
  it('should throw if missing required fields', () => {
    const data = {
      total_spend: 100
      // missing other fields
    };
    
    expect(() => validateDailyData(data)).toThrow('Missing required fields');
  });
  
  it('should throw if spend > 0 but impressions = 0', () => {
    const data = {
      total_spend: 100,
      total_impressions: 0,
      total_clicks: 10,
      click_to_call: 5,
      email_contacts: 3,
      reservations: 2
    };
    
    expect(() => validateDailyData(data)).toThrow('Illogical');
  });
  
  it('should pass with complete valid data', () => {
    const data = {
      total_spend: 100,
      total_impressions: 10000,
      total_clicks: 500,
      click_to_call: 50,
      email_contacts: 30,
      reservations: 20
    };
    
    expect(() => validateDailyData(data)).not.toThrow();
  });
});
```

### **Integration Tests**
```typescript
// Test entire data flow
describe('Daily Collection Integration', () => {
  it('should fetch, validate, and save complete data', async () => {
    const client = await createTestClient();
    const date = '2025-10-01';
    
    // Run collection
    await collectDailyData(client.id, date);
    
    // Verify saved
    const saved = await db.query(`
      SELECT * FROM daily_kpi_data
      WHERE client_id = $1 AND date = $2
    `, [client.id, date]);
    
    expect(saved).toHaveLength(1);
    expect(saved[0].total_spend).toBeGreaterThan(0);
    expect(saved[0].click_to_call).toBeGreaterThan(0);
  });
  
  it('should rollback on partial failure', async () => {
    const client = await createTestClient();
    
    // Mock API to return incomplete data
    mockMetaAPI.mockResolvedValueOnce({
      spend: 100,
      impressions: 1000
      // missing conversions
    });
    
    // Should throw and not save
    await expect(collectDailyData(client.id, '2025-10-01')).rejects.toThrow();
    
    // Verify nothing saved
    const saved = await db.query(`
      SELECT * FROM daily_kpi_data
      WHERE client_id = $1
    `, [client.id]);
    
    expect(saved).toHaveLength(0);
  });
});
```

### **E2E Tests**
```typescript
// Test full user journey
describe('Reports E2E', () => {
  it('should show complete data after aggregation', async () => {
    // Setup: Create test client and data
    const client = await createTestClient();
    await seedDailyData(client.id, '2025-10-01', '2025-10-31');
    
    // Run aggregation
    await runMonthlyAggregation(2025, 10);
    
    // Visit reports page
    const page = await browser.newPage();
    await page.goto('/reports');
    
    // Select October
    await page.select('#period-selector', '2025-10');
    
    // Verify data displayed
    const spend = await page.$eval('#total-spend', el => el.textContent);
    expect(spend).not.toBe('0 zł');
    
    const conversions = await page.$eval('#conversions', el => el.textContent);
    expect(conversions).not.toBe('0');
  });
});
```

---

## 🚀 **DEPLOYMENT PRACTICES**

### **Blue-Green Deployment**

```typescript
// Zero-downtime deployments
// Keep old version running while new version starts

// docker-compose.yml
services:
  app-blue:
    image: app:v1.0.0
    ports: ["3000:3000"]
    
  app-green:
    image: app:v1.1.0
    ports: ["3001:3000"]
    
  nginx:
    # Routes traffic to blue (old) or green (new)
```

### **Database Migrations**

```typescript
// ❌ BAD: Breaking change
// Migration: Rename column
ALTER TABLE daily_kpi_data 
RENAME COLUMN total_spend TO spend;

// ❌ Old code breaks immediately:
SELECT total_spend FROM daily_kpi_data;  // Error!

// ✅ GOOD: Backwards compatible migration
// Step 1: Add new column
ALTER TABLE daily_kpi_data 
ADD COLUMN spend DECIMAL(12,2);

// Step 2: Copy data
UPDATE daily_kpi_data 
SET spend = total_spend;

// Step 3: Deploy new code (uses 'spend')

// Step 4: Later, drop old column
ALTER TABLE daily_kpi_data 
DROP COLUMN total_spend;
```

### **Feature Flags**

```typescript
// Deploy code but keep it disabled
async function collectDailyData() {
  if (featureFlags.useNewCollectionLogic) {
    return await newCollectionLogic();
  } else {
    return await oldCollectionLogic();
  }
}

// Enable gradually:
// - 1% of users
// - 10% of users
// - 50% of users
// - 100% of users

// Can rollback instantly if issues detected
```

---

## 📝 **DOCUMENTATION**

### **Runbooks**

**Example: Daily Collection Failure Runbook**

```markdown
# Daily Collection Failure

## Symptoms
- Alert: "Daily Collection Incomplete"
- Reports show 0 data for today
- Logs show errors in /api/automated/daily-kpi-collection

## Diagnosis
1. Check Vercel logs: vercel logs --since 24h
2. Look for errors in daily-kpi-collection function
3. Check Meta Ads API status: https://developers.facebook.com/status/
4. Verify database connectivity

## Common Causes
1. Meta Ads API rate limit exceeded
2. Token expired
3. Network timeout
4. Database connection lost

## Fix
1. **If rate limited:** Wait 1 hour, retry
2. **If token expired:** Regenerate token in Meta Business Settings
3. **If timeout:** Increase function timeout in vercel.json
4. **If database:** Check Supabase status

## Recovery
1. Run manual collection: POST /api/automated/daily-kpi-collection
2. Verify data saved: SELECT * FROM daily_kpi_data WHERE date = TODAY
3. If still failing, escalate to on-call engineer

## Prevention
- Monitor rate limit usage
- Set up token expiry alerts
- Implement retry logic
```

---

## 🏗️ **ARCHITECTURE PATTERNS**

### **Separation of Concerns**

```typescript
// ❌ BAD: Everything in one function
async function dailyCollection() {
  // Fetch data
  const response = await fetch('https://graph.facebook.com/...');
  const rawData = await response.json();
  
  // Transform data
  const transformed = rawData.map(d => ({
    spend: parseFloat(d.spend),
    impressions: parseInt(d.impressions)
  }));
  
  // Validate data
  if (!transformed.every(d => d.spend > 0)) {
    throw new Error('Invalid data');
  }
  
  // Save to database
  await db.insert('daily_kpi_data', transformed);
  
  // Send notification
  await sendSlackMessage('Collection complete');
}

// ✅ GOOD: Separated concerns
class DataCollectionPipeline {
  constructor(
    private fetcher: DataFetcher,
    private transformer: DataTransformer,
    private validator: DataValidator,
    private repository: DataRepository,
    private notifier: Notifier
  ) {}
  
  async execute(client: Client, date: string): Promise<void> {
    const rawData = await this.fetcher.fetch(client, date);
    const transformed = await this.transformer.transform(rawData);
    const validated = await this.validator.validate(transformed);
    await this.repository.save(validated);
    await this.notifier.notify('Collection complete');
  }
}

// Easy to test each part independently
// Easy to replace implementations
// Easy to understand what each part does
```

---

## 🎯 **PRODUCTION CHECKLIST**

Before deploying to production:

### **Code Quality**
- [ ] All tests passing (unit + integration + E2E)
- [ ] Code review completed
- [ ] No linter errors
- [ ] TypeScript strict mode enabled
- [ ] No console.logs (use proper logging)

### **Reliability**
- [ ] Retry logic implemented
- [ ] Circuit breakers for external APIs
- [ ] Timeouts configured
- [ ] Graceful error handling
- [ ] Idempotent operations

### **Data Integrity**
- [ ] Input validation
- [ ] Database transactions for atomic operations
- [ ] Unique constraints to prevent duplicates
- [ ] Foreign key constraints
- [ ] Data consistency checks

### **Observability**
- [ ] Structured logging
- [ ] Metrics collection
- [ ] Alerts configured
- [ ] Dashboards created
- [ ] Health check endpoints

### **Security**
- [ ] Authentication required
- [ ] Authorization checked
- [ ] Input sanitization
- [ ] SQL injection prevention
- [ ] Rate limiting

### **Performance**
- [ ] Database indexes created
- [ ] Query performance tested
- [ ] Caching implemented where appropriate
- [ ] Load tested
- [ ] Resource limits configured

### **Documentation**
- [ ] README updated
- [ ] API documentation
- [ ] Runbooks for common issues
- [ ] Architecture diagrams
- [ ] Deployment guide

### **Deployment**
- [ ] Feature flags for risky changes
- [ ] Backwards-compatible migrations
- [ ] Rollback plan documented
- [ ] Blue-green deployment configured
- [ ] Smoke tests after deployment

---

## 📚 **RECOMMENDED READING**

1. **"Release It!" by Michael Nygard**
   - Patterns for resilient systems
   - Circuit breakers, timeouts, bulkheads

2. **"Site Reliability Engineering" by Google**
   - How to run production systems at scale
   - SLIs, SLOs, error budgets

3. **"Database Reliability Engineering" by Laine Campbell**
   - Data integrity and consistency
   - Backup and recovery strategies

4. **"The Twelve-Factor App"**
   - Best practices for modern applications
   - Config, dependencies, logs, processes

---

## 🎯 **APPLYING TO YOUR SYSTEM**

### **Immediate (This Week):**
```
[ ] Add retry logic to daily collection
[ ] Implement data validation after collection
[ ] Set up alerts for incomplete data
[ ] Create consistency check script
[ ] Document runbook for collection failures
```

### **Short-term (This Month):**
```
[ ] Add circuit breaker for Meta Ads API
[ ] Implement atomic transactions for data saves
[ ] Set up monitoring dashboard
[ ] Write integration tests for collection
[ ] Add feature flags for risky changes
```

### **Long-term (Next Quarter):**
```
[ ] Build comprehensive test suite
[ ] Implement blue-green deployments
[ ] Create automated health checks
[ ] Set up proper observability stack
[ ] Document all critical systems
```

---

## 💡 **KEY TAKEAWAYS**

1. **Assume failure** - Everything will fail, plan for it
2. **Validate everything** - Don't trust any data
3. **Make operations idempotent** - Safe to retry
4. **Monitor religiously** - You can't fix what you can't see
5. **Test thoroughly** - Catch issues before production
6. **Document obsessively** - Future you will thank you
7. **Deploy carefully** - Always have a rollback plan

---

**The Goal:** Systems that are:
- ✅ Reliable (99.9%+ uptime)
- ✅ Observable (know what's happening)
- ✅ Maintainable (easy to fix issues)
- ✅ Scalable (grows with usage)
- ✅ Secure (protected from attacks)

**Remember:** Production-ready doesn't mean perfect. It means:
- You know what can go wrong
- You detect when it does
- You can fix it quickly
- You learn from failures

---

**Start small, improve iteratively.** Each improvement makes your system more stable. 🚀







