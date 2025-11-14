# Environment Variables Template

Copy these to Vercel Dashboard → Settings → Environment Variables

## Required Variables

```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Optional Variables

```bash
# OpenAI (Optional - for AI summaries)
OPENAI_API_KEY=sk-your-key-here

# Gmail (Optional - for email reports)
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER_EMAIL=your-email@gmail.com

# Node Environment
NODE_ENV=production
```

## Database Configuration

Google Ads credentials are stored in database, NOT environment variables:

### In `system_settings` table:
- `google_ads_client_id`
- `google_ads_client_secret`
- `google_ads_developer_token`
- `google_ads_manager_customer_id`

### In `clients` table:
- `google_ads_customer_id`
- `google_ads_refresh_token`
- `meta_access_token`
- `ad_account_id`







