# 🔒 PRODUCTION ENVIRONMENT CONFIGURATION

## CRITICAL: Create .env.local file with these variables

```bash
# ================================
# SUPABASE CONFIGURATION
# ================================
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ================================
# PRODUCTION SECURITY (CRITICAL)
# ================================
# NEVER use password123 in production!
ADMIN_PASSWORD=your_secure_admin_password_min_12_chars
CLIENT_PASSWORD=your_secure_client_password_min_12_chars
JACEK_PASSWORD=your_secure_jacek_password_min_12_chars

# ================================
# API KEYS & EXTERNAL SERVICES
# ================================
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
RESEND_API_KEY=your_resend_api_key

# ================================
# SECURITY SETTINGS
# ================================
JWT_SECRET=your_jwt_secret_key_min_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars

# ================================
# CRON JOB AUTHENTICATION (CRITICAL)
# ================================
# REQUIRED: Protects automated endpoints from unauthorized access
# Generate using: openssl rand -base64 48
CRON_SECRET=your_super_secret_cron_key_64_chars
```

## Password Requirements:
- Minimum 12 characters
- Include uppercase, lowercase, numbers, symbols
- No dictionary words
- Unique per environment

## CRON_SECRET Requirements:
**Purpose:** Authenticates automated cron job requests to prevent:
- Unauthorized API calls costing $$$
- Email spam attacks
- Data deletion/manipulation
- DDoS amplification

**Generation:**
```bash
# Generate a cryptographically secure 64-character secret:
openssl rand -base64 48

# Example output (DO NOT use this example):
# "Kx8h2Nf9mP4qR7tY3wZ6cV1bA5gJ0sD8fE2lT9uK4pM7oN3xW6yC1vB5hQ8j"
```

**Usage:**
- Required for all `/api/automated/*` endpoints
- Required for all `/api/background/*` endpoints
- Required for all Vercel cron jobs
- Passed as `Authorization: Bearer ${CRON_SECRET}` header

**Protected Endpoints (19 total):**
1. `/api/automated/send-scheduled-reports` - Email sending
2. `/api/automated/generate-monthly-reports` - Report generation
3. `/api/automated/generate-weekly-reports` - Report generation
4. `/api/automated/daily-kpi-collection` - Meta API data collection
5. `/api/automated/google-ads-daily-collection` - Google Ads API data
6. `/api/automated/end-of-month-collection` - Monthly data aggregation
7. `/api/automated/refresh-all-caches` - Cache refresh (most expensive)
8. `/api/automated/refresh-current-month-cache` - Monthly cache
9. `/api/automated/refresh-current-week-cache` - Weekly cache
10. `/api/automated/refresh-3hour-cache` - Frequent cache updates
11. `/api/automated/refresh-google-ads-current-month-cache` - Google cache
12. `/api/automated/refresh-google-ads-current-week-cache` - Google cache
13. `/api/automated/archive-completed-months` - Data archival
14. `/api/automated/archive-completed-weeks` - Data archival
15. `/api/automated/cleanup-old-data` - Data deletion (PERMANENT)
16. `/api/automated/collect-monthly-summaries` - Monthly aggregation
17. `/api/automated/collect-weekly-summaries` - Weekly aggregation
18. `/api/automated/monthly-aggregation` - Historical aggregation
19. `/api/background/collect-monthly` - Background collection
20. `/api/background/collect-weekly` - Background collection
21. `/api/background/collect-current-week` - Real-time updates
22. `/api/background/cleanup-executive-summaries` - Cleanup
23. `/api/background/cleanup-old-data` - Data deletion

**Security Impact if Missing:**
- ❌ Anyone can trigger expensive Meta/Google Ads API calls → $10,000+ costs
- ❌ Anyone can send unlimited emails → domain blacklisting, GDPR fines
- ❌ Anyone can delete historical data → permanent data loss
- ❌ Anyone can trigger DDoS attacks → service downtime

**Risk Level:** 🔴 **CRITICAL - P0 BLOCKER**

**Status:** ✅ **IMPLEMENTED** - All endpoints now require CRON_SECRET
