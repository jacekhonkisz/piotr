# 📧 Custom Domain Setup for pbmreports.pl

## 🎯 **Current Status**
- ✅ Domain added to Resend: `pbmreports.pl`
- ⚠️ Status: **Pending verification**
- 🆔 Domain ID: `f2859f39-87d5-4b8b-9ec1-f8e4dac28782`

## 📋 **DNS Records to Add**

Add these records to your domain registrar's DNS settings:

### **1. SPF Record**
```
Type: TXT
Name: @
Value: v=spf1 include:amazonses.com ~all
```

### **2. DKIM Record**
```
Type: TXT
Name: resend._domainkey
Value: [DKIM key from Resend dashboard]
```

### **3. MX Record (if needed)**
```
Type: MX
Name: send
Value: feedback-smtp.eu-west-1.amazonses.com
Priority: 10
```

## 🔧 **Environment Configuration Update**

Once your domain is verified, update your `.env.local`:

```bash
# Change from:
EMAIL_FROM_ADDRESS=onboarding@resend.dev

# To:
EMAIL_FROM_ADDRESS=reports@pbmreports.pl
```

## ✅ **Email Configuration Updated**

I've already updated the monitoring emails in `src/lib/email-config.ts`:

```typescript
MONITORING_EMAILS: [
  'jac.honkisz@gmail.com',
  'kontakt@piotrbajerlein.pl'
],
```

## 🧪 **Testing Script Ready**

Once your domain is verified, run this test:

```bash
node scripts/test-with-custom-domain.js
```

## 📝 **Next Steps**

1. **Add DNS records** to your domain registrar
2. **Wait for verification** (can take up to 24 hours)
3. **Update EMAIL_FROM_ADDRESS** in `.env.local`
4. **Test sending** to jac.honkisz@gmail.com

## 🔍 **Check Verification Status**

Run this to check if your domain is verified:

```bash
node scripts/check-resend-domains.js
```

When you see `Status: verified`, you're ready to send emails to any address!
