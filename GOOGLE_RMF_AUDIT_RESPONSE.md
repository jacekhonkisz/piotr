# Google Ads API RMF Compliance Response

**Tool Name:** Piotr - Hotel Booking Campaign Performance Dashboard  
**Developer Token:** WCX04VxQqB0fsV0YDX0w1g  
**Date:** January 2025  
**Tool Category:** Reporting-Only Tool  
**Status:** Ready for RMF Audit

---

## 1. Tool Type & Classification

### Classification: **Reporting-Only Tool**

Our application provides **reporting functionality only** to end-advertisers (hotel clients). The tool does NOT provide campaign creation, management, or any editing capabilities. End-users can ONLY view their performance data.

**Tool Purpose:**
- Automated performance reporting for hotel booking campaigns
- Weekly and monthly performance analysis
- Cross-platform reporting (Meta Ads & Google Ads)
- Historical data analysis and trend visualization

### RMF Application

According to Google's RMF guidelines:
- ✅ **Reporting Functionality**: RMF applies (required)
- ❌ **Creation Functionality**: Does NOT apply (we don't offer creation features)
- ❌ **Management Functionality**: Does NOT apply (we don't offer management features)

---

## 2. Access Information

### Demo Account Access

**Live Application URL:**  
Please contact us for production URL access. The system is currently deployed and accessible.

**Demo Credentials:**  
*[TO BE PROVIDED - Please request via support@example.com]*

**Test Account:**  
We can provide access to a test account with sample data. Please contact us to arrange demo access.

**Demo Access Request:**  
Please email **piotr@example.com** to request:
1. Live production access URL
2. Demo account credentials
3. Sample client account setup

---

## 3. Annotated Screenshots - RMF Features

### Location of Each Required RMF Feature

We will provide annotated screenshots showing the location of each RMF feature. Here's a summary of where each feature is located in our application:

#### Customer-Level Reporting (R.10)
- **Location:** Dashboard main page
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅

#### Campaign-Level Reporting (R.20)
- **Location:** `/reports` page - Campaign table
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅
  - `metrics.ctr` ✅
  - `metrics.average_cpc` ✅

#### Ad Group-Level Reporting (R.30)
- **Location:** `/reports` page - Campaign details (expandable)
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅

#### Ad-Level Reporting (R.40)
- **Location:** `/reports` page - Ad performance section
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅

#### Keyword-Level Reporting (R.50)
- **Location:** Dashboard - Keyword Performance Table
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅
  - Quality metrics (for Search campaigns)

#### Search Term View (R.70)
- **Location:** `/reports` page - Search Terms section
- **Metrics Displayed:**
  - `segments.search_term` ✅
  - `segments.search_term_match_type` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅

#### Network Performance (R.80)
- **Location:** Dashboard - Network Breakdown Table
- **Metrics Displayed:**
  - `segments.network` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅

#### Device Performance (R.90)
- **Location:** Dashboard - Device Performance Table
- **Metrics Displayed:**
  - `segments.device` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅

#### Demographic Performance (R.100)
- **Location:** Dashboard - Demographics Table
- **Metrics Displayed:**
  - `segments.age_range` ✅
  - `segments.gender` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅

#### Site Category Performance (R.110)
- **Location:** Dashboard - Placement Performance (where applicable)
- **Metrics Displayed:**
  - `segments.user_list` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅

#### Video Performance (R.120)
- **Status:** ✅ Available for Video campaigns
- **Location:** Dashboard - Video metrics section
- **Metrics Displayed:**
  - `metrics.video_views` ✅
  - `metrics.video_view_rate` ✅
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅

#### Shopping Performance (R.130)
- **Status:** ✅ Available for Shopping campaigns
- **Location:** `/reports` page - Shopping Performance section
- **Metrics Displayed:**
  - `metrics.clicks` ✅
  - `metrics.cost_micros` ✅
  - `metrics.impressions` ✅
  - `metrics.conversions` ✅
  - `metrics.conversions_value` ✅

---

## 4. Specific Reports Between R.10 to R.130

Our tool provides the following reports from Google's RMF list:

| RMF Item | Report Name | Level | Required Metrics | Implementation Status |
|----------|-------------|-------|------------------|----------------------|
| R.10 | Customer Performance | Account | clicks, cost_micros, impressions, conversions, conversions_value | ✅ IMPLEMENTED |
| R.20 | Campaign Performance | Campaign | clicks, cost_micros, impressions, conversions, conversions_value | ✅ IMPLEMENTED |
| R.30 | Ad Group Performance | Ad Group | clicks, cost_micros, impressions, conversions | ✅ IMPLEMENTED |
| R.40 | Ad Performance | Ad | clicks, cost_micros, impressions, conversions, conversions_value | ✅ IMPLEMENTED |
| R.50 | Keyword Performance | Keyword | clicks, cost_micros, impressions, conversions, quality_score | ✅ IMPLEMENTED |
| R.70 | Search Term View | Search Term | search_term, match_type, clicks, cost_micros, impressions | ✅ IMPLEMENTED |
| R.80 | Network Performance | Network | network, clicks, cost_micros, impressions, conversions | ✅ IMPLEMENTED |
| R.90 | Device Performance | Device | device, clicks, cost_micros, impressions, conversions | ✅ IMPLEMENTED |
| R.100 | Demographic Performance | Demographics | age_range, gender, clicks, cost_micros, impressions | ✅ IMPLEMENTED |
| R.110 | Site Category Performance | Site | user_list, clicks, cost_micros, impressions | ✅ IMPLEMENTED |
| R.120 | Video Performance | Video | video_views, view_rate, clicks, cost_micros | ✅ IMPLEMENTED (when applicable) |
| R.130 | Shopping Performance | Shopping | clicks, cost_micros, impressions, conversions, conversions_value | ✅ IMPLEMENTED (when applicable) |

### Additional Reports Provided

Beyond the required RMF reports, we also provide:

1. **Conversion Tracking Breakdown**
   - Phone conversions (click-to-call)
   - Email contacts
   - Booking funnel metrics (step 1, 2, 3)
   - Reservation value and ROAS

2. **Historical Performance Analysis**
   - Month-over-month comparisons
   - Year-over-year comparisons
   - Trend visualization

3. **Multi-Platform Reporting**
   - Combined Meta Ads & Google Ads reporting
   - Cross-platform attribution
   - Unified campaign performance

---

## 5. Implementation Details

### API Usage

**Official Library:**  
We use the official `google-ads-api` npm package (v21.0.1)

**Key Implementation Files:**
- `src/lib/google-ads-api.ts` - Core API service
- `src/lib/google-ads-standardized-data-fetcher.ts` - Data fetching logic
- `src/app/api/fetch-google-ads-live-data/route.ts` - API endpoint

### Data Collection

**Automated Collection Schedule:**
- **Daily:** 1:15 AM - Collects previous day's performance
- **Cache Refresh:** Every 3 hours for current month data
- **Historical:** Monthly aggregation for completed periods

**Data Storage:**
- `daily_kpi_data` table - Daily performance metrics
- `campaign_summaries` table - Aggregated campaign data
- `google_ads_current_month_cache` - Real-time cache (3-hour TTL)

---

## 6. User Interface & Access

### Dashboard Features

**Main Dashboard (`/dashboard`):**
- Real-time campaign performance overview
- Platform toggle (Meta Ads ↔ Google Ads)
- Key metrics summary cards
- Interactive charts and visualizations
- Network performance breakdown
- Device performance analysis
- Demographic insights

**Reports Page (`/reports`):**
- Monthly, weekly, and custom period reports
- Campaign performance details
- Search term analysis
- Conversion funnel tracking
- PDF export functionality
- Email delivery to clients

### User Types

**Admin Users:**
- Access to all client accounts
- Report generation controls
- Client management interface

**Client Users:**
- Access to their own performance data only
- Historical report archive
- Download PDF reports
- Email notifications for new reports

---

## 7. Annotated Screenshots Delivery Plan

### Screenshot Package Structure

We will provide a comprehensive screenshot package with:

1. **Main Dashboard (5-7 screenshots)**
   - Full dashboard view with annotations
   - Campaign performance table (R.20)
   - Network performance table (R.80)
   - Device performance table (R.90)
   - Demographic performance table (R.100)
   - Keyword performance table (R.50)

2. **Reports Page (8-10 screenshots)**
   - Campaign-level report (R.20)
   - Ad group breakdown (R.30)
   - Ad performance details (R.40)
   - Search term view (R.70)
   - Conversion metrics
   - Date range selection

3. **Detailed Data Tables (5-7 screenshots)**
   - Clicking into campaign details
   - Keyword-level performance
   - Search term breakdown
   - Demographic segmentation

4. **Conversions & Attribution (3-5 screenshots)**
   - Conversion funnel visualization
   - ROAS calculation display
   - Reservation value tracking

### Annotation Requirements

Each screenshot will include:
- **Red arrows** pointing to specific RMF features
- **Numbered callouts** explaining each feature
- **RMF reference codes** (e.g., "R.10: Customer Performance")
- **Metric names** exactly as stored in our database
- **Navigation breadcrumbs** showing location in app

### Delivery Timeline

**Screenshots will be provided within 3 business days** after you confirm:
1. Demo account access details
2. Preferred screenshot format (PNG, PDF, or video walkthrough)
3. Any specific features you want highlighted

---

## 8. Data Availability

### Required Date Range Support

**Minimum Data Display:** Last 30 days (as per RMF requirements)  
**Custom Date Ranges:** ✅ Fully supported  
**Historical Data:** Available for all completed periods

**Data Freshness:**
- Current month: Real-time (3-hour cache refresh)
- Previous months: Historical aggregated data
- Today's data: Available within 1 hour of collection

---

## 9. Feature Completeness Checklist

### ✅ All Required Metrics Implemented

For each report level, we display ALL required metrics marked as "Required" in Google's RMF documentation:

**Level: Account (R.10)**
- ✅ clicks
- ✅ cost_micros
- ✅ impressions
- ✅ conversions
- ✅ conversions_value

**Level: Campaign (R.20)**
- ✅ clicks
- ✅ cost_micros
- ✅ impressions
- ✅ conversions
- ✅ conversions_value
- ✅ ctr
- ✅ average_cpc

**Level: Ad Group (R.30)**
- ✅ clicks
- ✅ cost_micros
- ✅ impressions
- ✅ conversions

**Level: Ad (R.40)**
- ✅ clicks
- ✅ cost_micros
- ✅ impressions
- ✅ conversions
- ✅ conversions_value

**Level: Keyword (R.50)**
- ✅ clicks
- ✅ cost_micros
- ✅ impressions
- ✅ conversions
- ✅ quality_score (when available)

### ⚠️ Optional Metrics

We also make available (as options) many additional metrics beyond the required ones:
- Frequency
- Reach
- Video metrics (views, view rate)
- Quality score components
- Search impression share

---

## 10. Prominence & Accessibility

### Data Prominence

**Default Display:**  
All required metrics are displayed by default when accessing any report level.

**Chart Integration:**  
Key metrics are prominently displayed in:
- Summary cards at top of dashboard
- Interactive charts and visualizations
- Detailed tables with all metrics

**Navigation:**  
Each report level is easily accessible through:
- Direct navigation links
- Breadcrumb navigation
- Expandable sections

### Download Options

**CSV Export:**  
Users can download any report as CSV with all required fields included.

**PDF Reports:**  
Automated monthly/weekly PDF reports include all required metrics with proper labeling.

---

## 11. Contact Information

**Technical Contact:**  
Email: technical@example.com  
For API integration questions and technical documentation

**Compliance Contact:**  
Email: compliance@example.com  
For RMF-related inquiries

**Demo Access Request:**  
Email: demo@example.com  
Subject: "Google Ads API RMF Audit - Demo Access Request"

**Primary Contact:**  
piotr@example.com

---

## 12. Next Steps

### Requested Actions

1. **Demo Account Setup**
   - Please provide preferred email for demo account
   - We'll create test account access within 24 hours

2. **Screenshot Timeline**
   - Confirm receipt of this response
   - We'll prepare screenshots package (3 business days)
   - Package will include annotated screenshots for all R.10 through R.130 reports

3. **Video Walkthrough (Optional)**
   - If preferred, we can provide a video walkthrough
   - Will demonstrate each RMF feature in context
   - Will show navigation and data flow

### Questions or Clarifications Needed

Please let us know if you need:
- Additional implementation details
- Access to specific test accounts
- Code documentation
- Architecture diagrams
- Any other supporting materials

---

## 13. Certification Statement

We certify that:

1. ✅ Our tool is a **Reporting-Only** tool for Google Ads API
2. ✅ We display all required metrics (clicks, cost_micros, impressions, conversions, conversions_value) for all hierarchy levels shown
3. ✅ All required metrics are displayed **by default** when accessing each report level
4. ✅ Our tool provides reports at: Account, Campaign, Ad Group, Ad, and Keyword levels
5. ✅ We support custom date ranges and display at least the last 30 days of data
6. ✅ Our implementation uses the official `google-ads-api` library
7. ✅ All reports are reasonably prominent and accessible to end users

---

## Appendix: Implementation Code References

### Core Reporting Functionality

**File:** `src/lib/google-ads-api.ts`  
**Lines:** 273-428  
**Purpose:** Campaign data fetching with conversion metrics

**File:** `src/lib/google-ads-standardized-data-fetcher.ts`  
**Lines:** 64-614  
**Purpose:** Standardized data fetching with smart caching

**File:** `src/app/reports/page.tsx`  
**Lines:** 405-4144  
**Purpose:** Reports UI with Campaign, Ad Group, Ad, and Keyword breakdowns

**File:** `src/components/GoogleAdsPerformanceLive.tsx`  
**Purpose:** Real-time dashboard metrics display

**File:** `src/components/GoogleAdsTables.tsx`  
**Purpose:** Network, Device, and Demographic performance tables

---

**End of RMF Compliance Response Document**

*We look forward to providing the demo access and annotated screenshots to complete your RMF audit. Please contact us at your earliest convenience to arrange access.*

**Date Submitted:** [Date]  
**Submitted By:** [Name/Title]  
**Signature:** [Authorized Representative]

---

## Quick Reference Summary

| Item | Status | Details |
|------|--------|---------|
| Tool Type | Reporting-Only | Read-only reporting for end-advertisers |
| Demo Access | Request via email | demo@example.com |
| Screenshots | 3 business days | Will be provided upon demo confirmation |
| Reports Offered | R.10 through R.130 | All required and optional reports |
| Required Metrics | ✅ All Implemented | clicks, cost_micros, impressions, conversions, conversions_value |
| Date Range Support | ✅ Yes | Custom ranges + last 30 days minimum |
| Data Prominence | ✅ Default | All metrics displayed by default |
| Download Options | ✅ CSV & PDF | All required fields included |

---

**For immediate questions, please contact:**  
📧 compliance@example.com  
📞 [Phone Number]  
⏰ Response Time: 24 hours












