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
```

## Password Requirements:
- Minimum 12 characters
- Include uppercase, lowercase, numbers, symbols
- No dictionary words
- Unique per environment
