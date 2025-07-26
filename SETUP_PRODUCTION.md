# Production Setup Guide

## Environment Variables Configuration

### Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Service Role Key (Server-side only - Required for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Meta (Facebook) API Configuration (Optional - for future features)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Next.js Configuration (Optional)
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://yourdomain.com
```

### Environment Variable Security

1. **Client-side variables** (prefixed with `NEXT_PUBLIC_`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - These are safe to expose in the browser

2. **Server-side only variables**:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `META_APP_SECRET`
   - `NEXTAUTH_SECRET`
   - These should NEVER be exposed to the client

### Production Deployment

#### Vercel Deployment

1. **Set environment variables in Vercel dashboard**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all required variables

2. **Deploy command**:
   ```bash
   vercel --prod
   ```

#### Other Platforms

For other platforms (Netlify, Railway, etc.), set the environment variables in their respective dashboards.

### Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used server-side
- [ ] All sensitive keys are properly secured
- [ ] HTTPS is enabled in production
- [ ] Security headers are configured
- [ ] Environment variables are not committed to git

### Troubleshooting

#### Common Issues

1. **"Missing SUPABASE_SERVICE_ROLE_KEY" error**:
   - This should only happen on server-side operations
   - Ensure the key is set in your production environment
   - Check that server-side functions are properly configured

2. **Authentication errors**:
   - Verify Supabase project is active
   - Check that anon key is correct
   - Ensure RLS policies are properly configured

3. **Redirect issues**:
   - Verify `NEXTAUTH_URL` is set correctly
   - Check that all auth callbacks are properly configured

### Development vs Production

- **Development**: Use `.env.local` for local development
- **Production**: Set environment variables in your hosting platform
- **Testing**: Use separate environment variables for testing

### Monitoring

Set up monitoring for:
- Authentication failures
- Database connection issues
- API rate limiting
- Error tracking (Sentry, etc.) 