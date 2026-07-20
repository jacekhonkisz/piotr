/**
 * GOOGLE ADS CONVERSIONS PARSER
 * 
 * Parses Google Ads conversion data into structured funnel metrics.
 * This is the SINGLE SOURCE OF TRUTH for converting Google Ads API responses into funnel data.
 *
 * For aggregating E-mail / Telefon across campaigns or DB rows (including legacy column
 * names), use `google-ads-contact-metrics.ts`.
 * 
 * Used by:
 * - Smart cache (current month/week data)
 * - Background data collector (historical data)
 * - Any other service fetching Google Ads campaign data
 */

import logger from './logger';
import {
  getMappedActionTypes,
  type ClientConversionMappings,
} from './client-conversion-mappings';

export interface ParsedConversionMetrics {
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  total_conversion_value?: number; // ✅ Total conversion value (all_conversions_value) - "Wartość konwersji" from Google Ads
  /** Σ all_conversions minus form-type actions (for headline conversion counts). */
  total_non_form_conversions?: number;
}

/** Lowercase + strip diacritics so PL/EN conversion action names match reliably. */
function normalizeConversionLabel(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

/**
 * Maps to Google Ads UI „Kontakt” → „Kliknięcie w adres email” (website).
 * Only that style of action counts as email_contacts (no generic „kontakt” / „contact”).
 */
export function isGoogleAdsEmailAddressClickConversion(name: string): boolean {
  const n = normalizeConversionLabel(name);
  if (/klikniecie\s+w\s+adres/.test(n) && /(email|e-mail|e_mail)/.test(n)) return true;
  if (n.includes('click on email address')) return true;
  if (n.includes('website click') && n.includes('email')) return true;
  return false;
}

/**
 * Sum bucket for phone / calls in Google Ads UI:
 * - „Kliknięcie w numer telefonu” (website)
 * - „Click to call” (Google-hosted), when present
 * - „Calls from ads” / „Połączenie z reklamy” (primary call conversions)
 */
export function isGoogleAdsPhoneOrCallConversion(name: string): boolean {
  const n = normalizeConversionLabel(name);
  if (n.includes('calls from ads')) return true;
  if (n.includes('call from ad')) return true;
  if (n.includes('polaczenie') && n.includes('reklamy')) return true;
  if (n.includes('click to call') || n.includes('click-to-call') || n.includes('clicks to call') || n.includes('clicks-to-call')) return true;
  if (/klikniecie\s+w\s+numer/.test(n) && (n.includes('telefon') || n.includes('phone'))) return true;
  if (n.includes('click on phone number')) return true;
  if (n.includes('phone number click')) return true;
  return false;
}

/**
 * Dedicated reservation conversion actions (e.g. "PBM - Rezerwacja", "Rezerwacja").
 * These are the authoritative source for reservation counts and value.
 */
export function isGoogleAdsDedicatedReservationConversion(name: string): boolean {
  const n = normalizeConversionLabel(name);
  return n.includes('rezerwacja') || n.includes('reservation');
}

/**
 * Generic purchase-style actions (e.g. GA4-imported "Zakup") that track the SAME
 * bookings as a dedicated reservation action. When a dedicated reservation action
 * exists on the account, these are duplicates and must be excluded from
 * reservation counts/value to avoid double counting (client-reported bug:
 * Lambert June = PBM-Rezerwacja 179k + GA4 "Zakup" 62k shown as 249k).
 */
export function isGoogleAdsGenericPurchaseConversion(name: string): boolean {
  const n = normalizeConversionLabel(name);
  if (!n.trim()) return false;
  if (isGoogleAdsDedicatedReservationConversion(name)) return false;
  return (
    n.includes('zakup') ||
    n.includes('purchase') ||
    n.includes('complete') ||
    n.includes('sale') ||
    n.includes('transaction') ||
    n.includes('order')
  );
}

/**
 * Form / lead-form conversion actions — excluded from funnel, contact buckets,
 * reservation totals, and aggregated conversion counts (see product rule: no forms in reports).
 */
export function isGoogleAdsFormConversion(name: string): boolean {
  const n = normalizeConversionLabel(name);
  if (!n.trim()) return false;
  if (n.includes('formularz')) return true;
  if (n.includes('form_submit') || n.includes('form submit') || n.includes('form-submit')) return true;
  if (n.includes('formsubmit')) return true;
  if (n.includes('form_completion') || n.includes('form completion')) return true;
  if (n.includes('form complete')) return true;
  if (n.includes('lead_form') || n.includes('lead form')) return true;
  if (n.includes('contact_form') || n.includes('contact form')) return true;
  if (n.includes('submit_application') || n.includes('submit application')) return true;
  if (n.includes('instant form')) return true;
  if (n.includes('zgloszen') || n.includes('zgłosz')) return true;
  return false;
}

/** Sum conversion counts from Google action rows, excluding form-type actions. */
export function sumGoogleConversionsExcludingForms(
  rows: Array<{ conversion_name?: string; name?: string; conversions?: unknown; value?: unknown }>
): number {
  let sum = 0;
  for (const r of rows || []) {
    const label = String(r.conversion_name || r.name || '');
    if (isGoogleAdsFormConversion(label)) continue;
    const c = parseFloat(String(r.conversions ?? r.value ?? '0')) || 0;
    if (c > 0) sum += c;
  }
  return Math.round(sum);
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
  campaignName?: string,
  options?: {
    /**
     * Set when ANY campaign on the account has a dedicated reservation action.
     * Needed because campaigns are parsed one-by-one: a campaign carrying only
     * the GA4 "Zakup" duplicate must still be deduped.
     */
    accountHasDedicatedReservation?: boolean;
    /** Exact, case/diacritic-insensitive conversion-action mappings for this client. */
    mappings?: ClientConversionMappings;
  }
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

  // Detect a dedicated reservation action ("PBM - Rezerwacja", "Rezerwacja", ...).
  // If present (in this campaign OR anywhere on the account), generic purchase
  // actions (GA4 "Zakup" etc.) are duplicates of the same bookings and must NOT
  // be added on top.
  const hasDedicatedReservationAction =
    options?.accountHasDedicatedReservation ||
    conversions.some((c) =>
      isGoogleAdsDedicatedReservationConversion(String(c.conversion_name || c.name || ''))
    );
  const mappedStep1 = getMappedActionTypes(options?.mappings, 'google', 'booking_step_1');
  const mappedStep2 = getMappedActionTypes(options?.mappings, 'google', 'booking_step_2');
  const mappedStep3 = getMappedActionTypes(options?.mappings, 'google', 'booking_step_3');
  const normalizedMappedStep1 = new Set((mappedStep1 || []).map(normalizeConversionLabel));
  const normalizedMappedStep2 = new Set((mappedStep2 || []).map(normalizeConversionLabel));
  const normalizedMappedStep3 = new Set((mappedStep3 || []).map(normalizeConversionLabel));

  // Parse conversions array
  conversions.forEach((conversion) => {
    try {
      const rawLabel = String(conversion.conversion_name || conversion.name || '');
      const conversionName = rawLabel.toLowerCase();
      const normalizedConversionName = normalizeConversionLabel(rawLabel);
      if (isGoogleAdsFormConversion(rawLabel)) {
        return;
      }
      const conversions = parseFloat(conversion.conversions || conversion.value || '0');
      const conversionValue = parseFloat(conversion.conversion_value || conversion.all_conversions_value || '0');
      
      if (isNaN(conversions) || conversions < 0) {
        logger.debug(`parseGoogleAdsConversions: Invalid conversions for "${conversionName}": ${conversion.conversions}`);
        return;
      }

      let matched = false;

      // --- Kontakt (Google Ads UI): strict mapping to dashboard „E-mail” / „Telefon” ---
      if (isGoogleAdsEmailAddressClickConversion(conversionName)) {
        metrics.email_contacts += conversions;
        matched = true;
      } else if (isGoogleAdsPhoneOrCallConversion(conversionName)) {
        metrics.click_to_call += conversions;
        matched = true;
      }

      // --- BOOKING STEP 1 ---
      const isStep1 = mappedStep1 ? normalizedMappedStep1.has(normalizedConversionName) : (
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
      const isStep2 = mappedStep2 ? normalizedMappedStep2.has(normalizedConversionName) : (
        conversionName.includes('step 2') || 
        conversionName.includes('step2') ||
        conversionName.includes('krok 2') ||
        conversionName.includes('2 krok') ||
        conversionName.includes('drugi krok') ||
        conversionName.includes('drugi_krok') ||
        conversionName.includes('booking_step_2') ||
        // Client-specific: Belmonte MICE / forms
        conversionName.includes('pobranie oferty') ||
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
      const isStep3 = mappedStep3 ? normalizedMappedStep3.has(normalizedConversionName) : (
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
      // Dedicated reservation actions always count. Generic purchase actions
      // (GA4 "Zakup", "purchase", ...) count ONLY when the account has no
      // dedicated reservation action — otherwise they duplicate the same bookings.
      const isDedicatedReservation = isGoogleAdsDedicatedReservationConversion(rawLabel);
      const isGenericPurchase = isGoogleAdsGenericPurchaseConversion(rawLabel) ||
        conversionName.includes('booking_complete');
      const isReservation =
        isDedicatedReservation || (isGenericPurchase && !hasDedicatedReservationAction);

      if (isGenericPurchase && hasDedicatedReservationAction && conversions > 0) {
        logger.info(`parseGoogleAdsConversions: Skipping duplicate purchase action "${rawLabel}" (${conversions} conv) — dedicated reservation action exists for campaign "${campaignName || 'unknown'}"`);
      }
      
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






