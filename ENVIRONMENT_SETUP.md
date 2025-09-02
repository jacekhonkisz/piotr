# 🌍 Environment Configuration Guide

## Meta Ads Reporting SaaS - Production Setup

This comprehensive guide covers all environment configurations needed for production deployment of the Meta Ads Reporting SaaS platform.

---

## 📋 Table of Contents

1. [Environment Variables](#environment-variables)
2. [Database Configuration](#database-configuration)
3. [External API Setup](#external-api-setup)
4. [Deployment Environments](#deployment-environments)
5. [Security Configuration](#security-configuration)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [CI/CD Configuration](#cicd-configuration)
8. [Troubleshooting](#troubleshooting)

---

## 🔐 Environment Variables

### Required Environment Variables

Create the following environment files:

#### `.env.local` (Development)
```bash
# 🔗 Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 🔑 Meta API Configuration
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_ACCESS_TOKEN=your-long-lived-access-token

# 📧 Email Configuration (Optional for dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 🔍 Monitoring (Optional for dev)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url

# 🏗️ Build Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### `.env.staging` (Staging Environment)
```bash
# 🔗 Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=staging-service-role-key

# 🔑 Meta API Configuration
META_APP_ID=staging-meta-app-id
META_APP_SECRET=staging-meta-app-secret
META_ACCESS_TOKEN=staging-long-lived-access-token

# 📧 Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=staging@yourdomain.com
SMTP_PASS=staging-app-password

# 🔍 Monitoring
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/staging/webhook/url
MONITORING_WEBHOOK=https://your-monitoring-service.com/webhook

# 🏗️ Build Configuration
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.meta-ads-reporting.com
```

#### `.env.production` (Production Environment)
```bash
# 🔗 Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=prod-service-role-key

# 🔑 Meta API Configuration
META_APP_ID=prod-meta-app-id
META_APP_SECRET=prod-meta-app-secret
META_ACCESS_TOKEN=prod-long-lived-access-token

# 📧 Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=prod-app-password

# 🔍 Monitoring & Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/prod/webhook/url
MONITORING_WEBHOOK=https://your-monitoring-service.com/webhook
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# 🏗️ Build Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://meta-ads-reporting.com

# 🔒 Security
NEXTAUTH_SECRET=your-super-secure-secret-key
NEXTAUTH_URL=https://meta-ads-reporting.com

# 📊 Analytics (Optional)
GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
```

### Environment Variable Descriptions

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ | - |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ | - |
| `META_APP_ID` | Meta/Facebook App ID | ✅ | - |
| `META_APP_SECRET` | Meta/Facebook App Secret | ✅ | - |
| `META_ACCESS_TOKEN` | Long-lived Meta access token | ✅ | - |
| `SMTP_HOST` | Email SMTP host | ❌ | smtp.gmail.com |
| `SMTP_PORT` | Email SMTP port | ❌ | 587 |
| `SMTP_USER` | Email username | ❌ | - |
| `SMTP_PASS` | Email password/app password | ❌ | - |
| `ALERT_WEBHOOK_URL` | Slack webhook for alerts | ❌ | - |
| `MONITORING_WEBHOOK` | Monitoring service webhook | ❌ | - |
| `SENTRY_DSN` | Sentry error tracking DSN | ❌ | - |
| `NODE_ENV` | Environment mode | ✅ | development |
| `NEXT_PUBLIC_APP_URL` | Application base URL | ✅ | http://localhost:3000 |

---

## 🗄️ Database Configuration

### Supabase Setup

1. **Create Supabase Project**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login to Supabase
   supabase login
   
   # Initialize project
   supabase init
   ```

2. **Database Schema**
   ```sql
   -- Run migrations
   supabase db push
   
   -- Generate TypeScript types
   npm run db:generate
   ```

3. **Row Level Security (RLS)**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
   
   -- Create policies (see migration files for details)
   ```

### Database Connection Pooling

For production, configure connection pooling:

```javascript
// supabase/config.toml
[db]
pooler_enabled = true
pooler_port = 6543
default_pool_size = 20
max_client_conn = 100
```

---

## 🔗 External API Setup

### Meta/Facebook API Configuration

1. **Create Meta App**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create new app
   - Add "Marketing API" product
   - Configure permissions: `ads_read`, `ads_management`

2. **Generate Long-lived Access Token**
   ```bash
   # Exchange short-lived token for long-lived token
   curl -i -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}"
   ```

3. **Webhook Configuration**
   ```javascript
   // Webhook endpoint: /api/webhooks/meta
   // Verify token: your-webhook-verify-token
   // Subscribed fields: campaigns, adsets, ads
   ```

### Rate Limiting Configuration

```javascript
// Rate limiting for Meta API
const RATE_LIMITS = {
  META_API: {
    requests_per_hour: 200,
    requests_per_day: 4800,
    burst_limit: 10
  }
};
```

---

## 🚀 Deployment Environments

### Development Environment

```bash
# Local development setup
npm install
npm run dev

# Database setup
npm run db:reset
npm run db:migrate
```

### Staging Environment

```bash
# Vercel deployment
vercel --env NODE_ENV=staging

# Or manual deployment
npm run build
npm start
```

### Production Environment

```bash
# Production deployment with monitoring
vercel --prod
```

### Environment-Specific Configurations

#### Development
- Hot reloading enabled
- Detailed error messages
- Debug logging enabled
- Mock external APIs (optional)

#### Staging
- Production-like environment
- Limited external API calls
- Staging database
- Alert notifications to staging channels

#### Production
- Optimized builds
- Error tracking with Sentry
- Full monitoring and alerting
- Production database with backups

---

## 🔒 Security Configuration

### SSL/TLS Configuration

```bash
# Ensure HTTPS in production
NEXT_PUBLIC_APP_URL=https://meta-ads-reporting.com
```

### CORS Configuration

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://meta-ads-reporting.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};
```

### API Security

```javascript
// Rate limiting middleware
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
};
```

### Environment Secrets Management

**GitHub Secrets (for CI/CD):**
```bash
# Repository secrets
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
META_APP_SECRET
VERCEL_TOKEN
SLACK_WEBHOOK
CODECOV_TOKEN
SONAR_TOKEN
```

**Vercel Environment Variables:**
- Set in Vercel dashboard
- Separate configurations for staging/production
- Encrypted at rest

---

## 📊 Monitoring & Alerting

### Health Checks

```javascript
// Health check endpoints
GET /api/health - Basic health check
GET /api/monitoring - Detailed metrics (admin only)
```

### Alert Configuration

```javascript
// Alert thresholds
const ALERT_THRESHOLDS = {
  ERROR_RATE: 0.05, // 5%
  RESPONSE_TIME: 2000, // 2 seconds
  MEMORY_USAGE: 0.85, // 85%
  CPU_USAGE: 0.80, // 80%
  CACHE_HIT_RATE: 0.70 // 70%
};
```

### Monitoring Integrations

1. **Sentry** (Error Tracking)
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

2. **Slack** (Alerts)
   ```bash
   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook
   ```

3. **Custom Monitoring**
   ```bash
   MONITORING_WEBHOOK=https://your-monitoring-service.com/webhook
   ```

---

## 🔄 CI/CD Configuration

### GitHub Actions Secrets

Required secrets in GitHub repository:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
STAGING_SUPABASE_URL
PROD_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
STAGING_SUPABASE_ANON_KEY
PROD_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STAGING_SUPABASE_SERVICE_ROLE_KEY
PROD_SUPABASE_SERVICE_ROLE_KEY

# Vercel
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Monitoring
SLACK_WEBHOOK
MONITORING_WEBHOOK
CODECOV_TOKEN
SONAR_TOKEN
SNYK_TOKEN
```

### Deployment Workflow

1. **Pull Request** → Run tests, security checks, code quality
2. **Merge to develop** → Deploy to staging
3. **Merge to main** → Deploy to production

### Branch Protection Rules

```yaml
# GitHub branch protection
main:
  required_status_checks:
    - test
    - security-check
    - code-quality
  required_reviews: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Supabase Connection Issues
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles"
```

#### 2. Meta API Rate Limiting
```javascript
// Check rate limit status
const response = await fetch('https://graph.facebook.com/v18.0/me/adaccounts', {
  headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
});
console.log(response.headers.get('x-app-usage'));
```

#### 3. Build Failures
```bash
# Clear cache and rebuild
rm -rf .next
npm run build

# Check for TypeScript errors
npm run type-check
```

#### 4. Environment Variable Issues
```bash
# Verify all required variables are set
node -e "
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
required.forEach(key => {
  if (!process.env[key]) console.error(\`Missing: \${key}\`);
});
"
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at);
```

#### 2. Caching Strategy
```javascript
// Cache configuration
const CACHE_DURATION = {
  CURRENT_MONTH: 3 * 60 * 60 * 1000, // 3 hours
  HISTORICAL_DATA: 24 * 60 * 60 * 1000, // 24 hours
  USER_PROFILES: 60 * 60 * 1000 // 1 hour
};
```

#### 3. Bundle Optimization
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Review error logs
   - Check system performance metrics
   - Update dependencies (patch versions)

2. **Monthly**
   - Security audit
   - Database optimization
   - Update dependencies (minor versions)

3. **Quarterly**
   - Full security review
   - Performance optimization
   - Major dependency updates

### Emergency Procedures

#### 1. Service Outage
```bash
# Check service status
curl -f https://meta-ads-reporting.com/api/health

# Check external dependencies
curl -f https://your-project.supabase.co/rest/v1/
```

#### 2. Database Issues
```bash
# Check database connectivity
supabase status

# View recent logs
supabase logs
```

#### 3. API Rate Limiting
```bash
# Check Meta API status
curl -H "Authorization: Bearer $META_ACCESS_TOKEN" \
     "https://graph.facebook.com/v18.0/me"
```

---

## 📚 Additional Resources

- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Meta Marketing API Documentation](https://developers.facebook.com/docs/marketing-api)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Maintainer:** Development Team

