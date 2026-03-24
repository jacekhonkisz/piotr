/**
 * GOOGLE ADS CONVERSIONS PARSER
 * 
 * Parses Google Ads conversion data into structured funnel metrics.
 * This is the SINGLE SOURCE OF TRUTH for converting Google Ads API responses into funnel data.
 * 
 * Classification is PRIORITY-BASED — each conversion action is assigned to exactly ONE bucket:
 *   1. Booking step 1/2/3  (highest priority)
 *   2. Reservations / purchases
 *   3. Click-to-call / phone
 *   4. Email / contact / form  (lowest — catch-all for micro-conversions)
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
  total_conversion_value?: number;
}

type ConversionBucket = 'booking_step_1' | 'booking_step_2' | 'booking_step_3' | 'reservations' | 'click_to_call' | 'email_contacts' | null;

function classifyConversion(name: string): ConversionBucket {
  // --- BOOKING STEP 1 ---
  if (
    name.includes('step 1') ||
    name.includes('step1') ||
    name.includes('krok 1') ||
    name.includes('1 krok') ||
    name.includes('pierwszy krok') ||
    name.includes('pierwszy_krok') ||
    name.includes('booking_step_1') ||
    name.includes('begin_checkout') ||
    name.includes('start_checkout') ||
    name.includes('checkout_started') ||
    name.includes('initiate_checkout') ||
    // Belmonte / MICE specific
    name.includes('engaged user') ||
    name.includes('wejście na stronę biznesow') ||
    name.includes('wejscie na strone biznesow') ||
    name.includes('kliknięcia linków na podstronie') ||
    name.includes('klikniecia linkow na podstronie')
  ) {
    return 'booking_step_1';
  }

  // --- BOOKING STEP 2 ---
  if (
    name.includes('step 2') ||
    name.includes('step2') ||
    name.includes('krok 2') ||
    name.includes('2 krok') ||
    name.includes('drugi krok') ||
    name.includes('drugi_krok') ||
    name.includes('booking_step_2') ||
    name.includes('add_to_cart') ||
    name.includes('add_payment_info') ||
    name.includes('checkout_progress') ||
    name.includes('form_submit') ||
    name.includes('form_completion') ||
    // Belmonte / MICE specific
    name.includes('pobranie oferty')
  ) {
    return 'booking_step_2';
  }

  // --- BOOKING STEP 3 ---
  if (
    name.includes('step 3') ||
    name.includes('step3') ||
    name.includes('krok 3') ||
    name.includes('3 krok') ||
    name.includes('trzeci krok') ||
    name.includes('trzeci_krok') ||
    name.includes('booking_step_3') ||
    name.includes('micro_conversion') ||
    name.includes('micro konwersj') ||
    name.includes('micro-marco')
  ) {
    return 'booking_step_3';
  }

  // --- RESERVATIONS (final purchase) ---
  // Exclude anything that looks like a booking engine step
  const isBookingStep = (
    name.includes('krok') ||
    name.includes('step') ||
    name.includes('booking engine') ||
    name.includes('booking_step')
  );
  if (
    !isBookingStep && (
      name.includes('rezerwacja') ||
      name.includes('reservation') ||
      name.includes('zakup') ||
      name.includes('purchase') ||
      name.includes('transaction') ||
      name.includes('sale') ||
      name.includes('complete_checkout') ||
      name.includes('checkout_complete') ||
      name.includes('purchase_complete') ||
      name.includes('booking_complete') ||
      name.includes('reservation_complete')
    )
  ) {
    return 'reservations';
  }

  // --- CLICK TO CALL ---
  if (
    name.includes('phone') ||
    name.includes('telefon') ||
    name.includes('call') ||
    name.includes('dzwonienie')
  ) {
    return 'click_to_call';
  }

  // --- EMAIL / CONTACT (catch-all for remaining micro-conversions) ---
  if (
    name.includes('email') ||
    name.includes('e-mail') ||
    name.includes('mail') ||
    name.includes('contact') ||
    name.includes('kontakt') ||
    name.includes('formularz') ||
    name.includes('inquiry') ||
    name.includes('lead_form') ||
    name.includes('request_info') ||
    name.includes('zapytanie')
  ) {
    return 'email_contacts';
  }

  return null;
}

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
    total_conversion_value: 0,
  };

  if (!Array.isArray(conversions)) {
    logger.warn(`parseGoogleAdsConversions: conversions is not an array for campaign "${campaignName || 'unknown'}"`);
    return metrics;
  }

  conversions.forEach((conversion) => {
    try {
      const conversionName = String(conversion.conversion_name || conversion.name || '').toLowerCase();
      const count = parseFloat(conversion.conversions || conversion.value || '0');
      const conversionValue = parseFloat(conversion.conversion_value || conversion.all_conversions_value || '0');
      
      if (isNaN(count) || count < 0) {
        return;
      }
      
      const bucket = classifyConversion(conversionName);
      
      if (!bucket) {
        if (count > 0) {
          logger.debug(`Unclassified conversion action: "${conversionName}" (${count} conversions) — campaign "${campaignName || 'unknown'}"`);
        }
        return;
      }

      metrics[bucket] += count;

      if (bucket === 'reservations' && !isNaN(conversionValue) && conversionValue > 0) {
        metrics.reservation_value += conversionValue;
      }
      
    } catch (error) {
      logger.error(`parseGoogleAdsConversions: Error parsing conversion`, {
        conversion,
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignName
      });
    }
  });

  metrics.click_to_call = Math.round(metrics.click_to_call);
  metrics.email_contacts = Math.round(metrics.email_contacts);
  metrics.booking_step_1 = Math.round(metrics.booking_step_1);
  metrics.booking_step_2 = Math.round(metrics.booking_step_2);
  metrics.booking_step_3 = Math.round(metrics.booking_step_3);
  metrics.reservations = Math.round(metrics.reservations);
  metrics.reservation_value = Math.round(metrics.reservation_value * 100) / 100;

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






