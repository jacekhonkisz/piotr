/**
 * GOOGLE ADS CONVERSIONS PARSER
 * 
 * Parses Google Ads conversion data into structured funnel metrics.
 * This is the SINGLE SOURCE OF TRUTH for converting Google Ads API responses into funnel data.
 * 
 * Used by:
 * - Smart cache (current month/week data)
 * - Background data collector (historical data)
 * - Any other service fetching Google Ads campaign data
 */

import logger from './logger';

export interface ParsedConversionMetrics {
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  total_conversion_value?: number; // ✅ Total conversion value (all_conversions_value) - "Wartość konwersji" from Google Ads
}

/**
 * Parses Google Ads conversions array into structured conversion metrics
 * 
 * Google Ads conversion names (Polish):
 * - "Step 1 w BE" = Booking Engine Step 1
 * - "Step 2 w BE" = Booking Engine Step 2
 * - "Step 3 w BE" = Booking Engine Step 3
 * - "Rezerwacja" or "Zakup" = Reservation/Purchase
 * 
 * @param conversions - Array of conversion objects from Google Ads API
 * @param campaignName - Optional campaign name for logging
 * @returns Parsed conversion metrics
 */
export function parseGoogleAdsConversions(
  conversions: any[] = [],
  campaignName?: string
): ParsedConversionMetrics {
  
  const metrics: ParsedConversionMetrics = {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
    total_conversion_value: 0, // ✅ Will be set from all_conversions_value aggregation
  };

  // Validate inputs
  if (!Array.isArray(conversions)) {
    logger.warn(`parseGoogleAdsConversions: conversions is not an array for campaign "${campaignName || 'unknown'}"`);
    return metrics;
  }

  // Parse conversions array
  conversions.forEach((conversion) => {
    try {
      const conversionName = String(conversion.conversion_name || conversion.name || '').toLowerCase();
      const conversions = parseFloat(conversion.conversions || conversion.value || '0');
      const conversionValue = parseFloat(conversion.conversion_value || conversion.all_conversions_value || '0');
      
      if (isNaN(conversions) || conversions < 0) {
        logger.debug(`parseGoogleAdsConversions: Invalid conversions for "${conversionName}": ${conversion.conversions}`);
        return;
      }

      let matched = false;
      
      // --- Click to call ---
      const isPhone = (
        conversionName.includes('phone') || 
        conversionName.includes('telefon') ||
        conversionName.includes('call') ||
        conversionName.includes('dzwonienie')
      );
      if (isPhone) {
        metrics.click_to_call += conversions;
        matched = true;
      }
      
      // --- Email / contact / form ---
      const isEmailContact = (
        conversionName.includes('email') || 
        conversionName.includes('e-mail') ||
        conversionName.includes('contact') ||
        conversionName.includes('kontakt') ||
        conversionName.includes('formularz') ||
        conversionName.includes('inquiry') ||
        conversionName.includes('request_info') ||
        conversionName.includes('lead_form') ||
        conversionName.includes('contact_us') ||
        conversionName.includes('mailto')
      );
      // Avoid matching "mail" inside "belmonte" etc.
      const isMailExact = (
        conversionName.includes('mail') && !conversionName.includes('belmonte')
      );
      if (isEmailContact || isMailExact) {
        metrics.email_contacts += conversions;
        matched = true;
      }
      
      // --- BOOKING STEP 1 ---
      const isStep1 = (
        conversionName.includes('step 1') || 
        conversionName.includes('step1') ||
        conversionName.includes('krok 1') ||
        conversionName.includes('1 krok') ||
        conversionName.includes('pierwszy krok') ||
        conversionName.includes('pierwszy_krok') ||
        conversionName.includes('booking_step_1') ||
        // Client-specific: Belmonte MICE / engagement
        conversionName.includes('engaged user') ||
        conversionName === 'search' ||
        conversionName.includes('wejście na stronę') ||
        conversionName.includes('wejscie na strone') ||
        conversionName.includes('kliknięcia linków na podstronie') ||
        conversionName.includes('klikniecia linkow na podstronie') ||
        // Generic GA4 funnel top
        conversionName.includes('page_view') ||
        conversionName.includes('view_item') ||
        conversionName.includes('landing_page_view') ||
        conversionName.includes('begin_checkout') ||
        conversionName.includes('website_visit')
      );
      if (isStep1) {
        metrics.booking_step_1 += conversions;
        matched = true;
      }
      
      // --- BOOKING STEP 2 ---
      const isStep2 = (
        conversionName.includes('step 2') || 
        conversionName.includes('step2') ||
        conversionName.includes('krok 2') ||
        conversionName.includes('2 krok') ||
        conversionName.includes('drugi krok') ||
        conversionName.includes('drugi_krok') ||
        conversionName.includes('booking_step_2') ||
        // Client-specific: Belmonte MICE / forms
        conversionName.includes('pobranie oferty') ||
        conversionName.includes('form_submit') ||
        conversionName.includes('form submit') ||
        // Generic GA4 funnel mid
        conversionName.includes('add_to_cart') ||
        conversionName.includes('add_payment_info') ||
        conversionName.includes('checkout_progress') ||
        conversionName.includes('view_content') ||
        conversionName.includes('file_download') ||
        conversionName.includes('offer_download')
      );
      if (isStep2) {
        metrics.booking_step_2 += conversions;
        matched = true;
      }
      
      // --- BOOKING STEP 3 ---
      const isStep3 = (
        conversionName.includes('step 3') || 
        conversionName.includes('step3') ||
        conversionName.includes('krok 3') ||
        conversionName.includes('3 krok') ||
        conversionName.includes('trzeci krok') ||
        conversionName.includes('trzeci_krok') ||
        conversionName.includes('booking_step_3') ||
        // Client-specific: micro conversions
        conversionName.includes('micro_conversion') ||
        conversionName.includes('micro-marco') ||
        conversionName.includes('micro conversion') ||
        // Generic GA4 funnel bottom
        conversionName.includes('initiate_checkout') ||
        conversionName.includes('checkout_complete') ||
        conversionName.includes('complete_checkout')
      );
      if (isStep3) {
        metrics.booking_step_3 += conversions;
        matched = true;
      }
      
      // --- RESERVATIONS (Final Purchase) ---
      const isReservation = (
        conversionName.includes('rezerwacja') ||
        conversionName.includes('reservation') ||
        conversionName.includes('zakup') ||
        conversionName.includes('purchase') ||
        conversionName.includes('complete') ||
        conversionName.includes('sale') ||
        conversionName.includes('transaction') ||
        conversionName.includes('order') ||
        conversionName.includes('booking_complete') ||
        conversionName.includes('reservation_complete')
      );
      
      const isBookingStep = (
        conversionName.includes('krok') ||
        conversionName.includes('step') ||
        conversionName.includes('booking engine') ||
        conversionName.includes('booking_step') ||
        conversionName.includes('checkout_progress') ||
        conversionName.includes('initiate_checkout') ||
        conversionName.includes('begin_checkout')
      );
      
      if (isReservation && !isBookingStep) {
        metrics.reservations += conversions;
        if (!isNaN(conversionValue) && conversionValue > 0) {
          metrics.reservation_value += conversionValue;
        }
        matched = true;
      }

      if (!matched) {
        logger.debug(`parseGoogleAdsConversions: Unclassified action "${conversionName}" (${conversions} conversions) for campaign "${campaignName || 'unknown'}"`);
      }
      
    } catch (error) {
      logger.error(`parseGoogleAdsConversions: Error parsing conversion`, {
        conversion,
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignName
      });
    }
  });

  // ✅ CRITICAL FIX: Round all conversion counts to integers
  // Google Ads uses attribution models that can assign fractional conversions (e.g., 0.5)
  // But for display purposes, we round to whole numbers
  metrics.click_to_call = Math.round(metrics.click_to_call);
  metrics.email_contacts = Math.round(metrics.email_contacts);
  metrics.booking_step_1 = Math.round(metrics.booking_step_1);
  metrics.booking_step_2 = Math.round(metrics.booking_step_2);
  metrics.booking_step_3 = Math.round(metrics.booking_step_3);
  metrics.reservations = Math.round(metrics.reservations);
  // Note: reservation_value is monetary, keep as-is (with decimals)
  metrics.reservation_value = Math.round(metrics.reservation_value * 100) / 100; // Round to 2 decimal places

  // Validation: Check for funnel inversions (debugging aid)
  if (metrics.booking_step_2 > metrics.booking_step_1 && metrics.booking_step_1 > 0) {
    logger.warn(`⚠️ Google Ads funnel inversion for campaign "${campaignName || 'unknown'}": Step 2 (${metrics.booking_step_2}) > Step 1 (${metrics.booking_step_1})`);
  }
  
  if (metrics.booking_step_3 > metrics.booking_step_2 && metrics.booking_step_2 > 0) {
    logger.warn(`⚠️ Google Ads funnel inversion for campaign "${campaignName || 'unknown'}": Step 3 (${metrics.booking_step_3}) > Step 2 (${metrics.booking_step_2})`);
  }
  
  if (metrics.reservations > metrics.booking_step_3 && metrics.booking_step_3 > 0) {
    logger.warn(`⚠️ Google Ads funnel inversion for campaign "${campaignName || 'unknown'}": Reservations (${metrics.reservations}) > Step 3 (${metrics.booking_step_3})`);
  }

  return metrics;
}

/**
 * Parse and enhance a single campaign with conversion metrics
 * 
 * @param campaign - Google Ads campaign object
 * @returns Campaign with added conversion metrics
 */
export function enhanceCampaignWithConversions(campaign: any): any {
  const parsed = parseGoogleAdsConversions(
    campaign.conversions || campaign.segments?.conversions || [],
    campaign.campaign?.name || campaign.name
  );
  
  return {
    ...campaign,
    ...parsed
  };
}

/**
 * Parse and enhance multiple campaigns with conversion metrics
 * 
 * @param campaigns - Array of Google Ads campaign objects
 * @returns Campaigns with added conversion metrics
 */
export function enhanceCampaignsWithConversions(campaigns: any[]): any[] {
  if (!Array.isArray(campaigns)) {
    logger.warn('enhanceCampaignsWithConversions: campaigns is not an array');
    return [];
  }
  
  return campaigns.map(campaign => enhanceCampaignWithConversions(campaign));
}

/**
 * Aggregate conversion metrics from multiple campaigns
 * 
 * @param campaigns - Array of campaigns (should be already parsed/enhanced)
 * @returns Aggregated conversion metrics
 */
export function aggregateConversionMetrics(campaigns: any[]): ParsedConversionMetrics {
  const totals: ParsedConversionMetrics = {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
  };
  
  if (!Array.isArray(campaigns)) {
    logger.warn('aggregateConversionMetrics: campaigns is not an array');
    return totals;
  }
  
  campaigns.forEach((campaign) => {
    totals.click_to_call += campaign.click_to_call || 0;
    totals.email_contacts += campaign.email_contacts || 0;
    totals.booking_step_1 += campaign.booking_step_1 || 0;
    totals.booking_step_2 += campaign.booking_step_2 || 0;
    totals.booking_step_3 += campaign.booking_step_3 || 0;
    totals.reservations += campaign.reservations || 0;
    totals.reservation_value += campaign.reservation_value || 0;
  });
  
  // ✅ CRITICAL FIX: Round aggregated conversion counts to integers
  // Floating point arithmetic can create values like 1162.892644
  totals.click_to_call = Math.round(totals.click_to_call);
  totals.email_contacts = Math.round(totals.email_contacts);
  totals.booking_step_1 = Math.round(totals.booking_step_1);
  totals.booking_step_2 = Math.round(totals.booking_step_2);
  totals.booking_step_3 = Math.round(totals.booking_step_3);
  totals.reservations = Math.round(totals.reservations);
  totals.reservation_value = Math.round(totals.reservation_value * 100) / 100; // Round to 2 decimal places
  
  return totals;
}






