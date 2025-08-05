# Production Security Checklist

## 🚨 CRITICAL: Password Security Issues

### Current Problem
Many development scripts are hardcoding `password123` instead of using actual production passwords. This is a **CRITICAL SECURITY VULNERABILITY**.

### Affected Scripts
The following scripts currently hardcode `password123` and need to be updated:

#### High Priority (Production Impact)
- `scripts/reset-admin-password.js` - Resets production passwords to `password123`
- `scripts/test-credentials-functionality.js` - Uses hardcoded password
- `scripts/setup-users.js` - Sets up users with weak passwords

#### Medium Priority (Development Only)
- Multiple test scripts in `src/__tests__/`
- Various debug scripts in `scripts/`

## ✅ Immediate Actions Required

### 1. Environment Variables Setup
Add the following to your `.env.local` file:

```bash
# Production Passwords (NEVER commit these to git)
ADMIN_PASSWORD=your_actual_admin_password
JACEK_PASSWORD=v&6uP*1UqTQN
CLIENT_PASSWORD=your_actual_client_password

# Development Passwords (safe for local development)
DEV_ADMIN_PASSWORD=password123
DEV_JACEK_PASSWORD=password123
DEV_CLIENT_PASSWORD=password123
```

### 2. Update Critical Scripts

#### Fix `scripts/reset-admin-password.js`
```javascript
// BEFORE (DANGEROUS)
{ password: 'password123' }

// AFTER (SECURE)
{ password: process.env.ADMIN_PASSWORD || 'password123' }
```

#### Fix `scripts/test-credentials-functionality.js`
```javascript
// BEFORE (DANGEROUS)
password: 'password123'

// AFTER (SECURE)
password: process.env.ADMIN_PASSWORD || 'password123'
```

### 3. Use Secure Password Manager
Use the new `scripts/secure-password-manager.js` for all password operations:

```bash
# Get password securely
node scripts/secure-password-manager.js get admin@example.com

# Reset password
node scripts/secure-password-manager.js reset jac.honkisz@gmail.com

# Test authentication
node scripts/secure-password-manager.js auth client@example.com
```

## 🔒 Security Best Practices

### 1. Never Hardcode Passwords
❌ **WRONG:**
```javascript
const password = 'password123';
```

✅ **CORRECT:**
```javascript
const password = process.env.ADMIN_PASSWORD || 'password123';
```

### 2. Environment Detection
```javascript
function isProduction() {
  return process.env.NODE_ENV === 'production' || 
         process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co') ||
         process.env.VERCEL_ENV === 'production';
}
```

### 3. Secure Password Generation
```javascript
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

## 🛡️ Production Deployment Checklist

### Before Deploying to Production:

1. **✅ Environment Variables**
   - [ ] Set `ADMIN_PASSWORD` environment variable
   - [ ] Set `JACEK_PASSWORD` environment variable  
   - [ ] Set `CLIENT_PASSWORD` environment variable
   - [ ] Verify no hardcoded passwords in code

2. **✅ Script Review**
   - [ ] Review all scripts for hardcoded passwords
   - [ ] Update scripts to use environment variables
   - [ ] Test scripts in production environment

3. **✅ Credentials Management**
   - [ ] Verify production passwords are secure
   - [ ] Test credential regeneration functionality
   - [ ] Verify admin access works correctly

4. **✅ Security Audit**
   - [ ] Check for any remaining `password123` references
   - [ ] Verify environment variables are properly set
   - [ ] Test authentication flows

## 🚨 Emergency Procedures

### If Passwords Are Compromised:

1. **Immediate Actions:**
   ```bash
   # Reset admin password
   node scripts/secure-password-manager.js reset admin@example.com
   
   # Reset jacek password
   node scripts/secure-password-manager.js reset jac.honkisz@gmail.com
   
   # Reset client password
   node scripts/secure-password-manager.js reset client@example.com
   ```

2. **Update Environment Variables:**
   - Update all password environment variables
   - Rotate any API keys or tokens
   - Notify affected users

3. **Audit Logs:**
   - Check authentication logs
   - Review recent access patterns
   - Document incident response

## 📋 Script Migration Guide

### For Each Script That Uses Hardcoded Passwords:

1. **Import Secure Password Manager:**
   ```javascript
   const { getPasswordSecurely, authenticateUser } = require('./secure-password-manager');
   ```

2. **Replace Hardcoded Authentication:**
   ```javascript
   // BEFORE
   const { data: { user } } = await supabase.auth.signInWithPassword({
     email: 'admin@example.com',
     password: 'password123'
   });

   // AFTER
   const auth = await authenticateUser('admin@example.com');
   if (!auth) {
     throw new Error('Authentication failed');
   }
   const { user } = auth;
   ```

3. **Add Environment Detection:**
   ```javascript
   if (isProduction()) {
     console.warn('⚠️  Running in production environment');
   }
   ```

## 🔍 Monitoring and Alerts

### Set Up Monitoring For:
- Failed authentication attempts
- Password reset operations
- Environment variable access
- Script execution in production

### Alert Conditions:
- Multiple failed login attempts
- Password reset without proper authorization
- Script execution with hardcoded passwords
- Environment variable access failures

## 📞 Contact Information

### Security Issues:
- **Immediate**: Stop deployment and contact security team
- **Email**: security@yourcompany.com
- **Emergency**: +1-XXX-XXX-XXXX

### Technical Support:
- **DevOps**: devops@yourcompany.com
- **Backend**: backend@yourcompany.com

---

**⚠️ REMEMBER: Never commit passwords to version control. Always use environment variables in production.** 