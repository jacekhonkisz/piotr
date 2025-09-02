# 🔍 GOOGLE ADS REPORTS AUDIT & IMPLEMENTATION PLAN

## 📊 **CURRENT META ADS METRICS (BASELINE)**

### **Core Performance Metrics:**
1. **💰 spend** - Total ad spend
2. **👁️ impressions** - Ad impressions
3. **🖱️ clicks** - Ad clicks  
4. **📊 ctr** - Click-through rate
5. **💵 cpc** - Cost per click
6. **🎯 conversions** - Total conversions
7. **💸 cpa** - Cost per acquisition
8. **🔄 frequency** - Ad frequency
9. **👥 reach** - Unique reach
10. **📈 cpm** - Cost per mille
11. **🎯 relevance_score** - Ad relevance
12. **📄 landing_page_view** - Landing page views

### **Conversion Tracking Metrics (8 Key Metrics):**
1. **📞 click_to_call** - Phone click conversions
2. **📧 email_contacts** - Email contact conversions  
3. **🛒 booking_step_1** - Booking initiation (initiate_checkout)
4. **✅ reservations** - Completed bookings (purchase)
5. **💎 reservation_value** - Booking revenue value
6. **📊 roas** - Return on ad spend
7. **💵 cost_per_reservation** - Cost per booking
8. **🛒 booking_step_2** - Booking step 2 (add_payment_info)
9. **🛒 booking_step_3** - Booking step 3 (complete_checkout)

### **Meta Tables Data:**
1. **📱 placementPerformance** - Platform/placement breakdown
2. **👥 demographicPerformance** - Age/gender performance
3. **🎯 adRelevanceResults** - Ad quality metrics

---

## 🎯 **GOOGLE ADS EQUIVALENT METRICS**

### **Core Performance Metrics (Available):**
✅ **spend** → `metrics.cost_micros / 1000000`
✅ **impressions** → `metrics.impressions`
✅ **clicks** → `metrics.clicks`
✅ **ctr** → `metrics.ctr`
✅ **cpc** → `metrics.average_cpc / 1000000`
✅ **conversions** → `metrics.conversions`
✅ **cpa** → `metrics.cost_per_conversion / 1000000`
❌ **frequency** → Not available (Meta-specific)
❌ **reach** → Not available (Meta-specific)
✅ **cpm** → `metrics.cost_per_thousand_impressions_micros / 1000000`
❌ **relevance_score** → Use `metrics.search_impression_share` instead
✅ **landing_page_view** → `metrics.view_through_conversions`

### **Conversion Tracking Metrics (Google Ads Mapping):**
✅ **click_to_call** → `conversion_action.phone_call_conversions`
✅ **email_contacts** → `conversion_action.email_conversions`
✅ **booking_step_1** → `conversion_action.initiate_checkout`
✅ **reservations** → `conversion_action.purchase`
✅ **reservation_value** → `metrics.conversions_value / 1000000`
✅ **roas** → `conversions_value / cost_micros`
✅ **cost_per_reservation** → `cost_micros / purchase_conversions`
✅ **booking_step_2** → `conversion_action.add_payment_info`
✅ **booking_step_3** → `conversion_action.complete_checkout`

### **Google Ads Tables Data (Equivalent):**
✅ **placementPerformance** → Network performance (Search, Display, YouTube)
✅ **demographicPerformance** → Age/gender performance
✅ **adRelevanceResults** → Quality Score metrics

---

## 🚀 **IMPLEMENTATION PLAN**

### **PHASE 1: Enhanced Google Ads API Service**

#### **1.1 Update GoogleAdsAPIService**
**File:** `src/lib/google-ads-api.ts`

```typescript
interface GoogleAdsCampaignData {
  // Core metrics (matching Meta)
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  cpa: number;
  cpm: number;
  search_impression_share: number; // Google's relevance equivalent
  view_through_conversions: number; // Landing page view equivalent
  
  // Conversion tracking (exact Meta mapping)
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
  booking_step_2: number;
  booking_step_3: number;
  
  // Google-specific additional metrics
  search_budget_lost_impression_share?: number;
  display_budget_lost_impression_share?: number;
  quality_score?: number;
  expected_ctr?: string;
  ad_relevance?: string;
  landing_page_experience?: string;
}
```

#### **1.2 Enhanced GAQL Query**
```sql
SELECT 
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  
  -- Core performance metrics
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.conversions,
  metrics.cost_per_conversion,
  metrics.cost_per_thousand_impressions_micros,
  metrics.search_impression_share,
  metrics.view_through_conversions,
  
  -- Conversion values
  metrics.conversions_value,
  metrics.all_conversions,
  metrics.all_conversions_value,
  
  -- Quality metrics
  metrics.search_budget_lost_impression_share,
  metrics.display_budget_lost_impression_share,
  
  -- Conversion actions breakdown
  segments.conversion_action_name,
  segments.conversion_action_category,
  metrics.conversions_by_conversion_date

FROM campaign
WHERE segments.date BETWEEN '{dateStart}' AND '{dateEnd}'
ORDER BY metrics.cost_micros DESC
```

#### **1.3 Conversion Action Mapping**
```typescript
async getConversionBreakdown(dateStart: string, dateEnd: string): Promise<ConversionMetrics> {
  const query = `
    SELECT 
      conversion_action.name,
      conversion_action.category,
      conversion_action.type,
      metrics.conversions,
      metrics.conversions_value
    FROM conversion_action
    WHERE conversion_action.status = 2
  `;
  
  // Map Google conversion actions to Meta equivalents
  const conversionMapping = {
    'click_to_call': ['phone_call', 'call_conversion'],
    'email_contacts': ['email', 'contact_form'],
    'booking_step_1': ['initiate_checkout', 'begin_checkout'],
    'reservations': ['purchase', 'booking', 'reservation'],
    'booking_step_2': ['add_payment_info', 'payment_info'],
    'booking_step_3': ['complete_checkout', 'checkout_complete']
  };
}
```

### **PHASE 2: Google Ads Tables Data**

#### **2.1 Network Performance (Placement Equivalent)**
```typescript
async getNetworkPerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsNetworkPerformance[]> {
  const query = `
    SELECT 
      segments.ad_network_type,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY metrics.cost_micros DESC
  `;
  
  // Maps to Meta's placementPerformance
  // Networks: SEARCH, DISPLAY, YOUTUBE, SHOPPING
}
```

#### **2.2 Demographic Performance**
```typescript
async getDemographicPerformance(dateStart: string, dateEnd: string): Promise<GoogleAdsDemographicPerformance[]> {
  const query = `
    SELECT 
      segments.age_range,
      segments.gender,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM age_range_view
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY metrics.cost_micros DESC
  `;
  
  // Direct equivalent to Meta's demographicPerformance
}
```

#### **2.3 Quality Score Metrics (Ad Relevance Equivalent)**
```typescript
async getQualityScoreMetrics(dateStart: string, dateEnd: string): Promise<GoogleAdsQualityMetrics[]> {
  const query = `
    SELECT 
      ad_group.name,
      keywords.text,
      keywords.quality_score,
      keywords.creative_quality_score,
      keywords.post_click_quality_score,
      keywords.search_predicted_ctr,
      metrics.impressions,
      metrics.clicks
    FROM keyword_view
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY keywords.quality_score DESC
  `;
  
  // Maps to Meta's adRelevanceResults
}
```

### **PHASE 3: API Route Integration**

#### **3.1 Create fetch-google-ads-live-data Route**
**File:** `src/app/api/fetch-google-ads-live-data/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Mirror the structure of fetch-live-data/route.ts
  // but use GoogleAdsAPIService instead of MetaAPIService
  
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
  
  // Fetch campaign data
  const campaigns = await googleAdsService.getCampaignData(startDate, endDate);
  
  // Fetch Google Ads tables
  const googleAdsTables = {
    networkPerformance: await googleAdsService.getNetworkPerformance(startDate, endDate),
    demographicPerformance: await googleAdsService.getDemographicPerformance(startDate, endDate),
    qualityScoreMetrics: await googleAdsService.getQualityScoreMetrics(startDate, endDate)
  };
  
  // Return in same format as Meta API
  return NextResponse.json({
    success: true,
    data: {
      client: clientData,
      campaigns,
      stats: calculateTotals(campaigns),
      conversionMetrics: calculateConversionMetrics(campaigns),
      googleAdsTables, // Equivalent to metaTables
      dateRange: { start: startDate, end: endDate },
      accountInfo: await googleAdsService.getAccountInfo(),
      fromDatabase: false,
      platform: 'google'
    }
  });
}
```

#### **3.2 Update Reports Page**
**File:** `src/app/reports/page.tsx`

```typescript
// Add Google Ads provider toggle
const [activeAdsProvider, setActiveAdsProvider] = useState<'meta' | 'google'>('meta');

// Dual API calls based on provider
const fetchDataForProvider = async (provider: 'meta' | 'google') => {
  const endpoint = provider === 'meta' 
    ? '/api/fetch-live-data'
    : '/api/fetch-google-ads-live-data';
    
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(requestBody)
  });
  
  return response.json();
};
```

### **PHASE 4: Unified Campaign Types**

#### **4.1 Enhanced Conversion Mapping**
**File:** `src/lib/unified-campaign-types.ts`

```typescript
export function convertGoogleCampaignToUnified(googleCampaign: GoogleAdsCampaignData): UnifiedCampaign {
  return {
    id: googleCampaign.campaignId,
    campaign_id: googleCampaign.campaignId,
    campaign_name: googleCampaign.campaignName,
    platform: 'google' as PlatformType,
    status: googleCampaign.status,
    
    // Core metrics (exact mapping)
    spend: googleCampaign.spend,
    impressions: googleCampaign.impressions,
    clicks: googleCampaign.clicks,
    ctr: googleCampaign.ctr,
    cpc: googleCampaign.cpc,
    conversions: googleCampaign.conversions,
    cpa: googleCampaign.cpa,
    cpm: googleCampaign.cpm,
    
    // Google-specific mappings
    frequency: undefined, // Not available in Google Ads
    reach: undefined, // Not available in Google Ads
    relevance_score: googleCampaign.search_impression_share, // Google equivalent
    landing_page_view: googleCampaign.view_through_conversions,
    
    // Conversion tracking (exact Meta mapping)
    click_to_call: googleCampaign.click_to_call,
    email_contacts: googleCampaign.email_contacts,
    booking_step_1: googleCampaign.booking_step_1,
    booking_step_2: googleCampaign.booking_step_2,
    booking_step_3: googleCampaign.booking_step_3,
    reservations: googleCampaign.reservations,
    reservation_value: googleCampaign.reservation_value,
    roas: googleCampaign.roas,
  };
}
```

### **PHASE 5: Database Integration**

#### **5.1 Google Ads Campaign Summaries**
**Table:** `google_ads_campaign_summaries`

```sql
CREATE TABLE google_ads_campaign_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  summary_date DATE NOT NULL,
  summary_type TEXT NOT NULL, -- 'monthly', 'weekly', 'daily'
  
  -- Campaign data (JSON)
  campaign_data JSONB,
  
  -- Aggregated metrics (same structure as Meta)
  total_spend DECIMAL(10,2),
  total_impressions INTEGER,
  total_clicks INTEGER,
  total_conversions INTEGER,
  average_ctr DECIMAL(5,4),
  average_cpc DECIMAL(10,2),
  
  -- Conversion metrics (exact Meta mapping)
  click_to_call INTEGER DEFAULT 0,
  email_contacts INTEGER DEFAULT 0,
  booking_step_1 INTEGER DEFAULT 0,
  reservations INTEGER DEFAULT 0,
  reservation_value DECIMAL(10,2) DEFAULT 0,
  booking_step_2 INTEGER DEFAULT 0,
  booking_step_3 INTEGER DEFAULT 0,
  roas DECIMAL(10,4) DEFAULT 0,
  cost_per_reservation DECIMAL(10,2) DEFAULT 0,
  
  -- Google Ads tables data
  google_ads_tables JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **5.2 Google Ads Tables Data**
**Table:** `google_ads_tables_data`

```sql
CREATE TABLE google_ads_tables_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Network performance (equivalent to placement)
  network_performance JSONB,
  
  -- Demographic performance (exact equivalent)
  demographic_performance JSONB,
  
  -- Quality score metrics (equivalent to ad relevance)
  quality_score_metrics JSONB,
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🎯 **IMPLEMENTATION PRIORITY**

### **HIGH PRIORITY (Week 1):**
1. ✅ Enhanced GoogleAdsAPIService with all Meta metrics
2. ✅ Conversion action mapping and breakdown
3. ✅ Core campaign data fetching with real conversion values
4. ✅ Basic Google Ads tables (network, demographic, quality)

### **MEDIUM PRIORITY (Week 2):**
1. ✅ fetch-google-ads-live-data API route
2. ✅ Reports page Google Ads integration
3. ✅ Database schema for Google Ads summaries
4. ✅ Unified campaign types enhancement

### **LOW PRIORITY (Week 3):**
1. ✅ Advanced quality score metrics
2. ✅ Historical data migration
3. ✅ Performance optimizations
4. ✅ Error handling and logging

---

## 📊 **SUCCESS CRITERIA**

### **Functional Parity:**
- ✅ All 12 core Meta metrics available in Google Ads
- ✅ All 9 conversion tracking metrics mapped correctly
- ✅ Google Ads tables equivalent to Meta tables
- ✅ Same report structure and UI

### **Data Accuracy:**
- ✅ Real-time spend tracking (15-30 min updates)
- ✅ Accurate conversion values (wartość rezerwacji)
- ✅ Proper ROAS calculations
- ✅ Correct cost per conversion metrics

### **User Experience:**
- ✅ Seamless provider switching (Meta ↔ Google)
- ✅ Identical report layouts
- ✅ Same performance and loading times
- ✅ Consistent error handling

---

## 🚀 **NEXT STEPS**

1. **Start with Phase 1**: Enhanced GoogleAdsAPIService
2. **Test with Belmonte**: Real conversion data validation
3. **Implement Phase 2**: Google Ads tables data
4. **Create Phase 3**: API route integration
5. **Deploy Phase 4**: Reports page integration

**Timeline: 2-3 weeks for complete Google Ads parity with Meta Ads** 🎯
