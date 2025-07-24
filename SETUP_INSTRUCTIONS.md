# 🚀 Meta Ads Reporting SaaS - Setup Instructions

## Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** and npm/yarn installed
- **Git** for version control
- A **Supabase** account (free tier available)
- A **Vercel** account for deployment (free tier available)
- A **Resend** account for email service (free tier available)
- A **Meta Developer** account for API access

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including Next.js, Supabase, TypeScript, Tailwind CSS, and other dependencies.

## Step 2: Environment Variables Setup

Create a `.env.local` file in your project root with the following variables:

```bash
# Copy this to .env.local and fill in your actual values

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_PROJECT_ID=your_supabase_project_id

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_key_here
NEXTAUTH_URL=http://localhost:3000

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key

# Meta/Facebook API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Application Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# File Storage
NEXT_PUBLIC_STORAGE_BUCKET=reports

# Cron Job Security (for Vercel)
CRON_SECRET=your_cron_secret_key

# Email Configuration
DEFAULT_FROM_EMAIL=reports@youragency.com
DEFAULT_FROM_NAME="Your Agency Name"
SUPPORT_EMAIL=support@youragency.com

# System Monitoring
LOG_LEVEL=info
ENABLE_ANALYTICS=true

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# PDF Generation
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Development/Testing
SKIP_AUTH_IN_DEV=false
MOCK_META_API=false
TEST_CLIENT_EMAIL=test@example.com
```

## Step 3: Supabase Setup

### 3.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and API keys to `.env.local`

### 3.2 Run Database Migrations
```bash
# Initialize Supabase locally (optional for local development)
npx supabase init

# Run the database migration
npx supabase db push --db-url YOUR_SUPABASE_DB_URL
```

Or manually run the SQL migration in your Supabase dashboard:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the migration

### 3.3 Configure Storage
1. Go to Supabase Dashboard → Storage
2. Create a new bucket called `reports`
3. Set it to public for file downloads

## Step 4: Resend Email Setup

### 4.1 Create Resend Account
1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add it to your `.env.local` file

### 4.2 Configure Domain (Optional)
1. Add your domain in Resend dashboard for custom sender addresses
2. Verify DNS records as instructed

## Step 5: Meta Developer Setup

### 5.1 Create Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app with "Business" type
3. Add the "Marketing API" product
4. Get your App ID and App Secret

### 5.2 Generate Access Tokens
For each client, you'll need:
- Long-lived User Access Token
- Ad Account ID (format: act_123456789)

Note: This typically requires the client to grant permissions through Facebook's OAuth flow.

## Step 6: Development Server

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## Step 7: Database Setup Verification

### 7.1 Create Admin User
1. Go to your Supabase Dashboard → Authentication
2. Create a new user manually or through the app
3. Update the user's role to 'admin' in the profiles table:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

### 7.2 Test Database Connection
The app should automatically create the user profile when someone signs up.

## Step 8: Production Deployment

### 8.1 Vercel Deployment
```bash
npm install -g vercel
vercel login
vercel
```

### 8.2 Environment Variables in Vercel
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add all production environment variables
4. Update `NEXTAUTH_URL` to your production domain

### 8.3 Cron Jobs Setup
1. In your Vercel dashboard, go to Functions
2. Configure cron jobs for:
   - Monthly report generation: `0 9 1 * *` (9 AM on 1st of each month)
   - Daily health checks: `0 6 * * *` (6 AM daily)

## Step 9: Testing the Setup

### 9.1 Basic Functionality Test
1. ✅ Visit the homepage
2. ✅ Create an admin account
3. ✅ Log in to admin dashboard
4. ✅ Add a test client (use dummy Meta API credentials for now)
5. ✅ Test email functionality

### 9.2 Meta API Integration Test
Once you have real Meta API credentials:
1. Add a real client with valid credentials
2. Test API validation
3. Generate a test report
4. Verify email delivery

## Troubleshooting

### Common Issues

**1. Supabase Connection Error**
- Verify your Supabase URL and keys
- Check if the database migration ran successfully
- Ensure RLS policies are in place

**2. Email Not Sending**
- Verify Resend API key
- Check domain verification if using custom domain
- Review email logs in Resend dashboard

**3. Meta API Errors**
- Verify App ID and App Secret
- Check if access tokens are valid and not expired
- Ensure proper permissions are granted

**4. PDF Generation Issues**
- Check if Puppeteer can access Chrome/Chromium
- For production, ensure proper Chrome installation
- Adjust memory limits if needed

### Development Tips

**1. Mock Mode for Development**
Set `MOCK_META_API=true` in `.env.local` to use dummy data during development.

**2. Database Reset**
```bash
npm run db:reset
```
This will reset your database (development only).

**3. Type Generation**
```bash
npm run db:generate
```
This updates TypeScript types from your database schema.

## Next Steps

After setup is complete:

1. **Customize Branding**: Update colors, logos, and company information
2. **Configure Email Templates**: Customize the email templates in `src/lib/email.ts`
3. **Add Real Clients**: Set up proper Meta API credentials for clients
4. **Test Automation**: Verify the monthly reporting automation works
5. **Monitor Performance**: Set up proper logging and monitoring

## Security Considerations

- **Never commit `.env.local`** to version control
- **Use strong passwords** for all accounts
- **Enable 2FA** on all service accounts
- **Regularly rotate API keys**
- **Monitor access logs** for suspicious activity

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the documentation in `/docs/`
3. Check the GitHub issues
4. Contact support for critical issues

---

**Congratulations!** 🎉 Your Meta Ads Reporting SaaS is now set up and ready for development. The foundation is in place for a scalable, professional reporting platform. 