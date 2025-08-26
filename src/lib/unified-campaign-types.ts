/**
 * Unified Campaign Types for Meta Ads and Google Ads
 * This file defines the unified data structures for reports that include both platforms
 */

export type PlatformType = 'meta' | 'google';

// Unified campaign interface that works for both Meta and Google Ads
export interface UnifiedCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  platform: PlatformType;
  status: string;
  
  // Core metrics (available in both platforms)
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  
  // Meta-specific metrics (optional for Google Ads)
  conversions?: number;
  cpa?: number;
  frequency?: number;
  reach?: number;
  relevance_score?: number;
  landing_page_view?: number;
  ad_type?: string;
  objective?: string;
  
  // Conversion tracking metrics (mapped differently for each platform)
  click_to_call?: number;        // Meta: click_to_call, Google: phone_clicks
  email_contacts?: number;       // Meta: email_contacts, Google: email_clicks
  form_submissions?: number;     // Google: form_submissions, Meta: calculated
  phone_calls?: number;          // Google: phone_calls, Meta: calculated
  booking_step_1?: number;
  booking_step_2?: number;
  booking_step_3?: number;
  reservations?: number;
  reservation_value?: number;
  roas?: number;
}

// Unified report interface
export interface UnifiedReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  
  // Separate campaigns by platform
  metaCampaigns: UnifiedCampaign[];
  googleCampaigns: UnifiedCampaign[];
  
  // Combined totals
  totals: {
    meta: PlatformTotals;
    google: PlatformTotals;
    combined: PlatformTotals;
  };
}

export interface PlatformTotals {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  averageCpa: number;
  totalReach?: number;
  averageFrequency?: number;
  
  // Conversion totals
  totalClickToCalls: number;
  totalEmailContacts: number;
  totalFormSubmissions: number;
  totalPhoneCalls: number;
  totalBookingStep1: number;
  totalBookingStep2: number;
  totalBookingStep3: number;
  totalReservations: number;
  totalReservationValue: number;
  averageRoas: number;
}

// Monthly and Weekly report types
export interface UnifiedMonthlyReport extends UnifiedReport {
  type: 'monthly';
}

export interface UnifiedWeeklyReport extends UnifiedReport {
  type: 'weekly';
}

// Helper function to convert Meta campaign to unified format
export function convertMetaCampaignToUnified(metaCampaign: any): UnifiedCampaign {
  return {
    id: metaCampaign.id || metaCampaign.campaign_id,
    campaign_id: metaCampaign.campaign_id || '',
    campaign_name: metaCampaign.campaign_name || 'Unknown Campaign',
    platform: 'meta' as PlatformType,
    status: metaCampaign.status || 'UNKNOWN',
    
    // Core metrics
    spend: parseFloat(metaCampaign.spend || '0'),
    impressions: parseInt(metaCampaign.impressions || '0'),
    clicks: parseInt(metaCampaign.clicks || '0'),
    ctr: parseFloat(metaCampaign.ctr || '0'),
    cpc: parseFloat(metaCampaign.cpc || '0'),
    
    // Meta-specific metrics
    conversions: parseInt(metaCampaign.conversions || '0'),
    cpa: metaCampaign.cpa ? parseFloat(metaCampaign.cpa) : undefined,
    frequency: metaCampaign.frequency ? parseFloat(metaCampaign.frequency) : undefined,
    reach: metaCampaign.reach ? parseInt(metaCampaign.reach) : undefined,
    relevance_score: metaCampaign.relevance_score ? parseFloat(metaCampaign.relevance_score) : undefined,
    landing_page_view: metaCampaign.landing_page_view ? parseInt(metaCampaign.landing_page_view) : undefined,
    ad_type: metaCampaign.ad_type || undefined,
    objective: metaCampaign.objective || undefined,
    
    // Conversion tracking (Meta naming)
    click_to_call: metaCampaign.click_to_call || 0,
    email_contacts: metaCampaign.email_contacts || 0,
    booking_step_1: metaCampaign.booking_step_1 || 0,
    booking_step_2: metaCampaign.booking_step_2 || 0,
    booking_step_3: metaCampaign.booking_step_3 || 0,
    reservations: metaCampaign.reservations || 0,
    reservation_value: metaCampaign.reservation_value || 0,
    roas: metaCampaign.roas || 0,
  };
}

// Helper function to convert Google Ads campaign to unified format
export function convertGoogleCampaignToUnified(googleCampaign: any): UnifiedCampaign {
  return {
    id: googleCampaign.id || googleCampaign.campaign_id,
    campaign_id: googleCampaign.campaign_id || '',
    campaign_name: googleCampaign.campaign_name || 'Unknown Campaign',
    platform: 'google' as PlatformType,
    status: googleCampaign.status || 'UNKNOWN',
    
    // Core metrics
    spend: parseFloat(googleCampaign.spend || '0'),
    impressions: parseInt(googleCampaign.impressions || '0'),
    clicks: parseInt(googleCampaign.clicks || '0'),
    ctr: parseFloat(googleCampaign.ctr || '0'),
    cpc: parseFloat(googleCampaign.cpc || '0'),
    
    // Google Ads doesn't have these Meta-specific metrics
    conversions: undefined,
    cpa: undefined,
    frequency: undefined,
    reach: undefined,
    relevance_score: undefined,
    landing_page_view: undefined,
    ad_type: undefined,
    objective: undefined,
    
    // Conversion tracking (mapped from Google naming to unified naming)
    click_to_call: googleCampaign.phone_clicks || 0,
    email_contacts: googleCampaign.email_clicks || 0,
    form_submissions: googleCampaign.form_submissions || 0,
    phone_calls: googleCampaign.phone_calls || 0,
    booking_step_1: googleCampaign.booking_step_1 || 0,
    booking_step_2: googleCampaign.booking_step_2 || 0,
    booking_step_3: googleCampaign.booking_step_3 || 0,
    reservations: googleCampaign.reservations || 0,
    reservation_value: googleCampaign.reservation_value || 0,
    roas: googleCampaign.roas || 0,
  };
}

// Helper function to calculate platform totals
export function calculatePlatformTotals(campaigns: UnifiedCampaign[]): PlatformTotals {
  if (campaigns.length === 0) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      averageCtr: 0,
      averageCpc: 0,
      averageCpa: 0,
      totalReach: 0,
      averageFrequency: 0,
      totalClickToCalls: 0,
      totalEmailContacts: 0,
      totalFormSubmissions: 0,
      totalPhoneCalls: 0,
      totalBookingStep1: 0,
      totalBookingStep2: 0,
      totalBookingStep3: 0,
      totalReservations: 0,
      totalReservationValue: 0,
      averageRoas: 0,
    };
  }

  const totals = campaigns.reduce((acc, campaign) => {
    acc.totalSpend += campaign.spend;
    acc.totalImpressions += campaign.impressions;
    acc.totalClicks += campaign.clicks;
    acc.totalConversions += campaign.conversions || 0;
    acc.totalReach += campaign.reach || 0;
    acc.totalClickToCalls += campaign.click_to_call || 0;
    acc.totalEmailContacts += campaign.email_contacts || 0;
    acc.totalFormSubmissions += campaign.form_submissions || 0;
    acc.totalPhoneCalls += campaign.phone_calls || 0;
    acc.totalBookingStep1 += campaign.booking_step_1 || 0;
    acc.totalBookingStep2 += campaign.booking_step_2 || 0;
    acc.totalBookingStep3 += campaign.booking_step_3 || 0;
    acc.totalReservations += campaign.reservations || 0;
    acc.totalReservationValue += campaign.reservation_value || 0;
    return acc;
  }, {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalReach: 0,
    totalClickToCalls: 0,
    totalEmailContacts: 0,
    totalFormSubmissions: 0,
    totalPhoneCalls: 0,
    totalBookingStep1: 0,
    totalBookingStep2: 0,
    totalBookingStep3: 0,
    totalReservations: 0,
    totalReservationValue: 0,
  });

  return {
    ...totals,
    averageCtr: totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0,
    averageCpc: totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0,
    averageCpa: totals.totalConversions > 0 ? totals.totalSpend / totals.totalConversions : 0,
    averageFrequency: campaigns.length > 0 ? 
      campaigns.reduce((sum, c) => sum + (c.frequency || 0), 0) / campaigns.length : 0,
    averageRoas: campaigns.length > 0 ? 
      campaigns.reduce((sum, c) => sum + (c.roas || 0), 0) / campaigns.length : 0,
  };
}

// Helper function to combine platform totals
export function combinePlatformTotals(metaTotals: PlatformTotals, googleTotals: PlatformTotals): PlatformTotals {
  const combined = {
    totalSpend: metaTotals.totalSpend + googleTotals.totalSpend,
    totalImpressions: metaTotals.totalImpressions + googleTotals.totalImpressions,
    totalClicks: metaTotals.totalClicks + googleTotals.totalClicks,
    totalConversions: metaTotals.totalConversions + googleTotals.totalConversions,
    totalReach: (metaTotals.totalReach || 0) + (googleTotals.totalReach || 0),
    totalClickToCalls: metaTotals.totalClickToCalls + googleTotals.totalClickToCalls,
    totalEmailContacts: metaTotals.totalEmailContacts + googleTotals.totalEmailContacts,
    totalFormSubmissions: metaTotals.totalFormSubmissions + googleTotals.totalFormSubmissions,
    totalPhoneCalls: metaTotals.totalPhoneCalls + googleTotals.totalPhoneCalls,
    totalBookingStep1: metaTotals.totalBookingStep1 + googleTotals.totalBookingStep1,
    totalBookingStep2: metaTotals.totalBookingStep2 + googleTotals.totalBookingStep2,
    totalBookingStep3: metaTotals.totalBookingStep3 + googleTotals.totalBookingStep3,
    totalReservations: metaTotals.totalReservations + googleTotals.totalReservations,
    totalReservationValue: metaTotals.totalReservationValue + googleTotals.totalReservationValue,
  };

  return {
    ...combined,
    averageCtr: combined.totalImpressions > 0 ? (combined.totalClicks / combined.totalImpressions) * 100 : 0,
    averageCpc: combined.totalClicks > 0 ? combined.totalSpend / combined.totalClicks : 0,
    averageCpa: combined.totalConversions > 0 ? combined.totalSpend / combined.totalConversions : 0,
    averageFrequency: (metaTotals.averageFrequency || 0 + googleTotals.averageFrequency || 0) / 2,
    averageRoas: (metaTotals.averageRoas + googleTotals.averageRoas) / 2,
  };
}
