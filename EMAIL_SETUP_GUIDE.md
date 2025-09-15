# 📧 Hybrid Email Setup Guide

This guide will help you set up a hybrid email system that uses Gmail SMTP for development/testing and Resend for production.

## 🎯 **What This Setup Gives You:**

- **Development:** Direct emails to `jac.honkisz@gmail.com` via Gmail SMTP
- **Testing:** Emails to `pbajerlein@gmail.com` via Resend
- **Production:** Client emails via Resend with custom domain
- **Easy Switching:** Just change environment variables

---

## 🔧 **Step 1: Gmail SMTP Setup (for jac.honkisz@gmail.com)**

### **1.1 Enable 2-Factor Authentication**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **"2-Step Verification"**
3. Follow the setup process if not already enabled

### **1.2 Generate App Password**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **"App passwords"** (under "2-Step Verification")
3. Select **"Mail"** as the app
4. Copy the 16-character password (format: `abcd efgh ijkl mnop`)

### **1.3 Add to Environment File**
Add these lines to your `.env.local` file:

```bash
# Gmail SMTP Configuration
GMAIL_USER=jac.honkisz@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password_here
```

---

## 🔧 **Step 2: Resend Configuration (Already Done)**

Your Resend setup is already configured:
- ✅ API Key: `re_bDtP4uoy_J2JsBg4okmc1Ujw5ihcRCzFk`
- ✅ From Address: `onboarding@resend.dev`
- ✅ Verified Email: `pbajerlein@gmail.com`

---

## 🔧 **Step 3: Environment Configuration**

### **Development (.env.local):**
```bash
# Email Provider Selection
EMAIL_PROVIDER=auto  # Smart selection based on recipient

# Gmail SMTP (for jac.honkisz@gmail.com)
GMAIL_USER=jac.honkisz@gmail.com
GMAIL_APP_PASSWORD=your_app_password_here

# Resend (for pbajerlein@gmail.com and production)
RESEND_API_KEY=re_bDtP4uoy_J2JsBg4okmc1Ujw5ihcRCzFk
EMAIL_FROM_ADDRESS=onboarding@resend.dev

# Other existing config...
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Production (.env.production):**
```bash
# Email Provider Selection
EMAIL_PROVIDER=resend  # Force Resend for production

# Resend with Custom Domain
RESEND_API_KEY=re_bDtP4uoy_J2JsBg4okmc1Ujw5ihcRCzFk
EMAIL_FROM_ADDRESS=noreply@yourdomain.com  # Your custom domain

# Remove Gmail config for production
# GMAIL_USER=
# GMAIL_APP_PASSWORD=
```

---

## 🔧 **Step 4: Test the Setup**

### **4.1 Test Gmail SMTP (Direct to Jac)**
```bash
# Create a test script
cat > test-gmail.js << 'EOF'
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testGmail() {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const result = await transporter.sendMail({
    from: `"Meta Ads Reports" <${process.env.GMAIL_USER}>`,
    to: 'jac.honkisz@gmail.com',
    subject: '✅ Gmail SMTP Test - Direct Delivery',
    html: '<h2>Gmail SMTP Working!</h2><p>This email was sent directly to jac.honkisz@gmail.com</p>'
  });

  console.log('✅ Gmail test successful!', result.messageId);
}

testGmail().catch(console.error);
EOF

# Run the test
node test-gmail.js
```

### **4.2 Test Resend (pbajerlein@gmail.com)**
```bash
# Test Resend API
curl -X POST http://localhost:3000/api/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"email_from_address": "onboarding@resend.dev"}'
```

---

## 🔧 **Step 5: Integration with Your App**

### **5.1 Update Email Service**
The flexible email service is already created in `src/lib/flexible-email.ts`. It will automatically:

- Send to `jac.honkisz@gmail.com` via Gmail SMTP
- Send to `pbajerlein@gmail.com` via Resend
- Send to client emails via Resend

### **5.2 Usage in Your Code**
```typescript
import FlexibleEmailService from '../lib/flexible-email';

const emailService = FlexibleEmailService.getInstance();

// This will automatically use Gmail for jac.honkisz@gmail.com
await emailService.sendReportEmail(
  'jac.honkisz@gmail.com',
  'Belmonte Hotel',
  {
    dateRange: 'Last 30 days',
    totalSpend: 1500.50,
    totalImpressions: 45000,
    totalClicks: 1200,
    ctr: 0.0267,
    cpc: 1.25,
    cpm: 33.34
  }
);
```

---

## 🔧 **Step 6: Production Migration (Future)**

### **6.1 Add Custom Domain to Resend**
1. Go to [Resend Domains](https://resend.com/domains)
2. Add your custom domain (e.g., `yourdomain.com`)
3. Verify domain ownership
4. Update DNS records as instructed

### **6.2 Update Production Environment**
```bash
# .env.production
EMAIL_PROVIDER=resend
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
RESEND_API_KEY=your_key
```

### **6.3 Update Routing Rules**
In `src/lib/email-provider-config.ts`, add your custom domain:
```typescript
verifiedDomains: ['resend.dev', 'yourdomain.com']
```

---

## 📋 **Email Routing Logic**

| Recipient | Provider | Reason |
|-----------|----------|---------|
| `jac.honkisz@gmail.com` | Gmail SMTP | Direct delivery for testing |
| `pbajerlein@gmail.com` | Resend | Verified Resend address |
| `client@example.com` | Resend | Production client emails |
| `noreply@yourdomain.com` | Resend | Custom domain (future) |

---

## 🚨 **Troubleshooting**

### **Gmail Issues:**
- **"Invalid login"**: Check app password is correct
- **"2FA required"**: Enable 2-Factor Authentication
- **"App password not working"**: Generate new app password

### **Resend Issues:**
- **"Unauthorized"**: Check API key
- **"Domain not verified"**: Verify domain in Resend dashboard
- **"Rate limit exceeded"**: Wait and retry

### **Environment Issues:**
- **"Gmail not configured"**: Add GMAIL_APP_PASSWORD to .env.local
- **"Provider not found"**: Check EMAIL_PROVIDER setting

---

## ✅ **Verification Checklist**

- [ ] Gmail 2-Factor Authentication enabled
- [ ] Gmail App Password generated and added to .env.local
- [ ] Resend API key configured
- [ ] Test email sent to jac.honkisz@gmail.com via Gmail
- [ ] Test email sent to pbajerlein@gmail.com via Resend
- [ ] Email routing working correctly
- [ ] Production environment prepared for custom domain

---

## 🎉 **You're All Set!**

Your hybrid email system is now ready:
- **Development:** Direct emails to Jac via Gmail
- **Production:** Client emails via Resend
- **Future:** Easy migration to custom domain

The system will automatically choose the best provider for each recipient!
