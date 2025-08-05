# Meta Ads API Data Availability Audit Report

## 📋 **Audit Overview**

**Account:** jac.honkisz@gmail.com  
**Ad Account ID:** 703853679965014  
**Audit Date:** August 5, 2025  
**Account Name:** 703853679965014  
**Currency:** PLN  
**Timezone:** Europe/Warsaw  

---

## 📊 **Data Availability Results**

| Metric                      | Status         | Sample Value   | If NOT available – Reason or Setup Instruction       |
|-----------------------------|---------------|---------------|-----------------------------------------------------|
| Spend                       | AVAILABLE     | 259.39 PLN    | -                                                   |
| Impressions                 | AVAILABLE     | 8,549         | -                                                   |
| Clicks                      | AVAILABLE     | 152           | -                                                   |
| Link Clicks                 | AVAILABLE     | 81            | -                                                   |
| Lead Form Submissions       | NOT AVAILABLE | -             | No Lead Ads campaigns on account                     |
| Email Clicks                | AVAILABLE     | 81            | -                                                   |
| Phone Number Clicks         | NOT AVAILABLE | -             | No click-to-call ads or events                      |
| Reservations                | NOT AVAILABLE | -             | No Facebook Pixel purchase events on website        |
| Reservation Value           | NOT AVAILABLE | -             | No value parameter sent with Pixel events           |
| ROAS                        | NOT AVAILABLE | -             | No purchase/value events, or value not configured    |

---

## 📈 **Summary Statistics**

- **✅ Available metrics:** 5/10 (50%)
- **❌ Missing metrics:** 5/10 (50%)

### **Available Metrics:**
1. **Spend** - Basic ad spend tracking ✅
2. **Impressions** - Ad impression count ✅
3. **Clicks** - Total click count ✅
4. **Link Clicks** - Inline link clicks ✅
5. **Email Clicks** - Link click actions (includes mailto: links) ✅

### **Missing Metrics:**
1. **Lead Form Submissions** - No Lead Ads campaigns
2. **Phone Number Clicks** - No click-to-call functionality
3. **Reservations** - No Facebook Pixel purchase events
4. **Reservation Value** - No value tracking in Pixel events
5. **ROAS** - No purchase events or value configuration

---

## 🔍 **Detailed Analysis**

### **Available Actions Found:**
- `post_engagement`: 1,570
- `onsite_conversion.post_save`: 17
- `comment`: 2
- `page_engagement`: 1,570
- `video_view`: 1,389
- `post_reaction`: 81
- `link_click`: 81

### **Missing Action Types:**
- `lead` - Lead form submissions
- `click_to_call` - Phone number clicks
- `purchase` - Purchase/reservation events

---

## 🔧 **Setup Recommendations**

### **To Enable Missing Metrics:**

#### **1. Lead Form Submissions**
- **Current Status:** NOT AVAILABLE
- **Reason:** No Lead Ads campaigns configured
- **Setup Required:** Create Lead Ads campaigns in Meta Ads Manager
- **Steps:**
  1. Go to Meta Ads Manager
  2. Create new campaign with "Lead generation" objective
  3. Set up lead form with desired fields
  4. Launch campaign

#### **2. Phone Number Clicks**
- **Current Status:** NOT AVAILABLE
- **Reason:** No click-to-call functionality
- **Setup Required:** Add click-to-call buttons in ad creatives
- **Steps:**
  1. Add phone numbers to ad creatives
  2. Enable click-to-call functionality
  3. Use call-to-action buttons with phone numbers

#### **3. Reservations & Reservation Value**
- **Current Status:** NOT AVAILABLE
- **Reason:** No Facebook Pixel with purchase events
- **Setup Required:** Implement Facebook Pixel with purchase tracking
- **Steps:**
  1. Install Facebook Pixel on website
  2. Configure purchase events with value parameter
  3. Test pixel implementation
  4. Set up custom conversions if needed

#### **4. ROAS (Return on Ad Spend)**
- **Current Status:** NOT AVAILABLE
- **Reason:** No purchase events or value tracking
- **Setup Required:** Configure value parameter in Pixel events
- **Steps:**
  1. Add value parameter to purchase events
  2. Ensure consistent value tracking
  3. Set up proper attribution windows

---

## 💡 **Implementation Priority**

### **High Priority (Immediate Impact):**
1. **Facebook Pixel Implementation** - Enables reservations, value tracking, and ROAS
2. **Lead Ads Campaigns** - Enables lead form submissions

### **Medium Priority (Enhanced Tracking):**
1. **Click-to-Call Setup** - Enables phone number click tracking
2. **Value Parameter Configuration** - Improves ROAS calculation

### **Low Priority (Nice to Have):**
1. **Custom Conversions** - For specific business goals
2. **Enhanced Attribution** - For better performance analysis

---

## 🎯 **Next Steps**

1. **Implement Facebook Pixel** on the client's website
2. **Create Lead Ads campaigns** for lead generation
3. **Configure value tracking** for purchase events
4. **Set up click-to-call** functionality in ad creatives
5. **Test and validate** all tracking implementations

---

## 📞 **Technical Support**

For implementation assistance:
- **Facebook Pixel Setup:** Follow Meta's official documentation
- **Lead Ads Configuration:** Use Meta Ads Manager interface
- **API Integration:** Ensure proper permissions and token validation

---

*Report generated on August 5, 2025*  
*Account: jac.honkisz@gmail.com*  
*Ad Account ID: 703853679965014* 