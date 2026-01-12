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
        return; // Skip invalid values
      }
      
      // Click to call conversions
      if (conversionName.includes('phone') || 
          conversionName.includes('telefon') ||
          conversionName.includes('call') ||
          conversionName.includes('dzwonienie')) {
        metrics.click_to_call += conversions;
      }
      
      // Email contact conversions
      // ✅ FIXED: Added 'e-mail', 'mail', 'kliknięcie w e-mail', 'klik w mail' patterns
      if (conversionName.includes('email') || 
          conversionName.includes('e-mail') ||
          conversionName.includes('mail') ||
          conversionName.includes('contact') ||
          conversionName.includes('kontakt') ||
          conversionName.includes('formularz')) {
        metrics.email_contacts += conversions;
      }
      
      // ✅ BOOKING STEP 1
      // Matches: "Step 1 w BE", "step 1 w be", "booking step 1", "pierwszy krok", "1 krok", etc.
      if (conversionName.includes('step 1') || 
          conversionName.includes('step1') ||
          conversionName.includes('krok 1') ||
          conversionName.includes('1 krok') ||
          conversionName.includes('pierwszy krok') ||
          conversionName.includes('pierwszy_krok') ||
          conversionName.includes('1 krok silnik') ||
          conversionName.includes('1 krok rezerwacyjny') ||
          conversionName.includes('booking_step_1')) {
        metrics.booking_step_1 += conversions;
      }
      
      // ✅ BOOKING STEP 2
      // Matches: "Step 2 w BE", "step 2 w be", "booking step 2", "drugi krok", "2 krok", etc.
      if (conversionName.includes('step 2') || 
          conversionName.includes('step2') ||
          conversionName.includes('krok 2') ||
          conversionName.includes('2 krok') ||
          conversionName.includes('drugi krok') ||
          conversionName.includes('drugi_krok') ||
          conversionName.includes('2 krok silnik') ||
          conversionName.includes('2 krok rezerwacyjny') ||
          conversionName.includes('booking_step_2')) {
        metrics.booking_step_2 += conversions;
      }
      
      // ✅ BOOKING STEP 3
      // Matches: "Step 3 w BE", "step 3 w be", "booking step 3", "trzeci krok", "3 krok", etc.
      if (conversionName.includes('step 3') || 
          conversionName.includes('step3') ||
          conversionName.includes('krok 3') ||
          conversionName.includes('3 krok') ||
          conversionName.includes('trzeci krok') ||
          conversionName.includes('trzeci_krok') ||
          conversionName.includes('3 krok silnik') ||
          conversionName.includes('3 krok rezerwacyjny') ||
          conversionName.includes('booking_step_3')) {
        metrics.booking_step_3 += conversions;
      }
      
      // ✅ RESERVATIONS (Final Purchase)
      // Matches: "Rezerwacja", "Zakup", "Purchase", "Reservation"
      // ⚠️ CRITICAL: Do NOT match generic "booking" - it matches "Booking Engine - krok 1/2/3"!
      // Only match specific reservation/purchase patterns
      const isReservation = (
        conversionName.includes('rezerwacja') ||
        conversionName.includes('reservation') ||
        conversionName.includes('zakup') ||
        conversionName.includes('purchase') ||
        conversionName.includes('complete')
      );
      
      // ⚠️ EXCLUDE booking engine steps from reservations
      const isBookingStep = (
        conversionName.includes('krok') ||
        conversionName.includes('step') ||
        conversionName.includes('booking engine') ||
        conversionName.includes('booking_step')
      );
      
      if (isReservation && !isBookingStep) {
        metrics.reservations += conversions;
        
        // Add monetary value if available
        if (!isNaN(conversionValue) && conversionValue > 0) {
          metrics.reservation_value += conversionValue;
        }
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






