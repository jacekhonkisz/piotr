/**
 * META ACTIONS PARSER
 * 
 * Parses Meta API actions and action_values arrays into structured conversion metrics.
 * This is the SINGLE SOURCE OF TRUTH for converting Meta API responses into funnel data.
 * 
 * Used by:
 * - Smart cache (current month/week data)
 * - Background data collector (historical data)
 * - Any other service fetching Meta campaign insights
 */

import logger from './logger';
import {
  getMappedActionTypes,
  type CanonicalConversionMetric,
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
  // ✅ Added for consistency with Google Ads metrics:
  // - conversion_value = reservation_value (from action_values)
  // - total_conversion_value = calculated from purchase_roas × spend if ROAS is available
  conversion_value: number;
  total_conversion_value: number;
  roas: number;
}

const PBM_PHONE_EVENT = 'offsite_conversion.custom.1470262077092668';
const HAVET_EMAIL_EVENT = 'offsite_conversion.custom.2770488499782793';

/** PBM website pixel contact events — attributed counts live in insights `conversions[]`. */
export const PBM_PIXEL_PHONE_CONVERSION_PATTERNS = [
  'offsite_conversion.fb_pixel_custom.pbm - kliknięcie w numer telefonu',
  'offsite_conversion.fb_pixel_custom.pbm - klikniecie w numer telefonu',
] as const;

export const PBM_PIXEL_EMAIL_CONVERSION_PATTERNS = [
  'offsite_conversion.fb_pixel_custom.pbm - kliknięcie w adres e-mail',
  'offsite_conversion.fb_pixel_custom.pbm - klikniecie w adres e-mail',
  'offsite_conversion.fb_pixel_custom.pbm - kliknięcie w e-mail',
  'offsite_conversion.fb_pixel_custom.pbm - klikniecie w e-mail',
] as const;

const META_PHONE_EVENT_PRIORITY = [
  // Matches Ads Manager's placed-call result used by Pinea/Arche. The broader
  // call_confirm counters include confirmations that never became a call.
  'click_to_call_native_call_placed',
  'click_to_call_call_confirm',
  'call_confirm_grouped',
  'phone_number_clicks',
  'click_to_call_native_20s_call_connect',
] as const;

/**
 * Select one canonical Meta phone action. Meta can expose the same interaction
 * under several click_to_call_* action types, so summing those types inflates
 * the number shown in Ads Manager.
 */
export function selectMetaPhoneClicks(
  actionMap: ReadonlyMap<string, number>,
  forcePBMOnly: boolean = false,
  configuredActionTypes?: string[]
): number {
  if (configuredActionTypes?.length) {
    return selectFirstMappedActionValue(actionMap, configuredActionTypes);
  }

  if (actionMap.has(PBM_PHONE_EVENT)) {
    return actionMap.get(PBM_PHONE_EVENT) || 0;
  }

  if (forcePBMOnly) {
    return 0;
  }

  for (const actionType of META_PHONE_EVENT_PRIORITY) {
    if (actionMap.has(actionType)) {
      return actionMap.get(actionType) || 0;
    }
  }

  // Some accounts expose a newer click_to_call subtype. Use one deterministic
  // fallback only; never add multiple representations of the same interaction.
  const fallback = Array.from(actionMap.entries())
    .filter(([actionType]) =>
      actionType.startsWith('click_to_call_') && !actionType.includes('offsite_conversion')
    )
    .sort(([left], [right]) => left.localeCompare(right))[0];

  return fallback?.[1] || 0;
}

/**
 * Pick ONE phone action type for a whole account. Ads Manager reports a single
 * phone metric per account; letting each campaign fall back to a different
 * click_to_call_* subtype mixes metrics and inflates the account total
 * (e.g. Arche Nałęczów: 6+5 placed calls + 1 call_confirm from a campaign
 * without placed calls = 12 instead of 11).
 */
export function selectAccountMetaPhoneActionType(campaigns: any[]): string | null {
  const present = new Set<string>();
  for (const campaign of campaigns || []) {
    for (const action of campaign?.actions || []) {
      present.add(String(action?.action_type || '').toLowerCase());
    }
  }

  if (present.has(PBM_PHONE_EVENT)) return PBM_PHONE_EVENT;

  for (const actionType of META_PHONE_EVENT_PRIORITY) {
    if (present.has(actionType)) return actionType;
  }

  const fallback = Array.from(present)
    .filter((t) => t.startsWith('click_to_call_') && !t.includes('offsite_conversion'))
    .sort((left, right) => left.localeCompare(right))[0];

  return fallback || null;
}

function buildInsightActionMap(entries: any[] = []): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries || []) {
    const actionType = String(entry?.action_type || '').toLowerCase();
    const value = parseInt(String(entry?.value || '0'), 10);
    if (!isNaN(value) && value >= 0) {
      map.set(actionType, (map.get(actionType) || 0) + value);
    }
  }
  return map;
}

function matchesAnyPattern(actionType: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => actionType === pattern || actionType.includes(pattern));
}

/**
 * Extract phone/email contact metrics from Meta insights `conversions[]`.
 * Many PBM hotel accounts attribute website contact-button clicks here, not in `actions[]`.
 */
export function extractMetaContactFromConversions(
  conversions: any[] = [],
  mappings?: ClientConversionMappings
): Pick<ParsedConversionMetrics, 'click_to_call' | 'email_contacts'> {
  const conversionMap = buildInsightActionMap(conversions);
  const mappedPhone = getMappedActionTypes(mappings, 'meta', 'click_to_call');
  const mappedEmail = getMappedActionTypes(mappings, 'meta', 'email_contacts');

  let click_to_call = 0;
  let email_contacts = 0;

  if (mappedPhone?.length) {
    click_to_call = selectFirstMappedActionValue(conversionMap, mappedPhone);
  } else {
    for (const [actionType, value] of conversionMap.entries()) {
      if (matchesAnyPattern(actionType, PBM_PIXEL_PHONE_CONVERSION_PATTERNS)) {
        click_to_call += value;
      }
    }
  }

  if (mappedEmail?.length) {
    email_contacts = selectFirstMappedActionValue(conversionMap, mappedEmail);
  } else {
    for (const [actionType, value] of conversionMap.entries()) {
      if (matchesAnyPattern(actionType, PBM_PIXEL_EMAIL_CONVERSION_PATTERNS)) {
        email_contacts += value;
      }
    }
    if (email_contacts === 0 && conversionMap.has(HAVET_EMAIL_EVENT)) {
      email_contacts = conversionMap.get(HAVET_EMAIL_EVENT) || 0;
    }
  }

  return { click_to_call, email_contacts };
}

function mergeMetaContactMetrics(
  fromActions: ParsedConversionMetrics,
  fromConversions: Pick<ParsedConversionMetrics, 'click_to_call' | 'email_contacts'>,
  options: { allowPhoneFallback?: boolean; allowEmailFallback?: boolean } = {}
): ParsedConversionMetrics {
  const { allowPhoneFallback = true, allowEmailFallback = true } = options;
  return {
    ...fromActions,
    click_to_call:
      fromActions.click_to_call > 0
        ? fromActions.click_to_call
        : allowPhoneFallback
          ? fromConversions.click_to_call
          : 0,
    email_contacts:
      fromActions.email_contacts > 0
        ? fromActions.email_contacts
        : allowEmailFallback
          ? fromConversions.email_contacts
          : 0,
  };
}

function resolveMetaHeadlineConversions(campaign: any, formConv: number): number {
  const raw = campaign?.conversions;
  if (Array.isArray(raw)) {
    const purchase = raw.find(
      (entry: any) => String(entry?.action_type || '').toLowerCase() === 'omni_purchase'
    );
    const purchaseValue = parseInt(String(purchase?.value || '0'), 10);
    if (!isNaN(purchaseValue) && purchaseValue >= 0) {
      return Math.max(0, purchaseValue - formConv);
    }
    const total = raw.reduce((sum: number, entry: any) => {
      const value = parseInt(String(entry?.value || '0'), 10);
      return !isNaN(value) && value >= 0 ? sum + value : sum;
    }, 0);
    return Math.max(0, total - formConv);
  }

  const scalar = parseFloat(String(raw ?? '0')) || 0;
  return Math.max(0, scalar - formConv);
}

function selectFirstMappedActionValue(
  actionMap: ReadonlyMap<string, number>,
  actionTypes: string[]
): number {
  for (const configuredType of actionTypes) {
    const value = actionMap.get(configuredType.toLowerCase());
    if (value !== undefined) return value;
  }
  return 0;
}

/**
 * Sum Meta Insights `actions[]` values that represent lead / instant forms.
 * Subtracted from the API `conversions` scalar so headline counts exclude forms.
 */
export function sumMetaFormConversionActions(actions: any[] = []): number {
  const formExact = new Set([
    'lead',
    'onsite_conversion.lead_grouped',
    'onsite_conversion.lead',
    'onsite_conversion.form',
    'submit_application',
    'onsite_conversion.submit_application',
  ]);
  let sum = 0;
  for (const a of actions || []) {
    const t = String(a.action_type || '').toLowerCase();
    if (formExact.has(t) || t.includes('lead_gen') || t.includes('leadgen') || t.includes('instant_form')) {
      const v = parseInt(String(a.value || '0'), 10);
      if (!isNaN(v) && v >= 0) sum += v;
    }
  }
  return sum;
}

/**
 * Parses Meta API actions array into structured conversion metrics
 * 
 * @param actions - The actions array from Meta API campaign insights
 * @param actionValues - The action_values array from Meta API (for monetary values)
 *                       This contains "Zakupy w witrynie - wartość konwersji" (website purchase conversion value)
 * @param campaignName - Optional campaign name for logging
 * @returns Parsed conversion metrics
 */
export function parseMetaActions(
  actions: any[] = [],
  actionValues: any[] = [],
  campaignName?: string,
  forcePBMOnly: boolean = false,
  mappings?: ClientConversionMappings,
  accountPhoneActionType?: string | null
): ParsedConversionMetrics {
  
  const metrics: ParsedConversionMetrics = {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
    // ✅ Direct from Meta API action_values - "Zakupy w witrynie - wartość konwersji"
    conversion_value: 0,
    total_conversion_value: 0,
    roas: 0,
  };

  // Validate inputs
  if (!Array.isArray(actions)) {
    logger.warn(`parseMetaActions: actions is not an array for campaign "${campaignName || 'unknown'}"`);
    return metrics;
  }

  if (!Array.isArray(actionValues)) {
    logger.warn(`parseMetaActions: actionValues is not an array for campaign "${campaignName || 'unknown'}"`);
    actionValues = [];
  }

  // ✅ CRITICAL FIX: Meta API returns the SAME event under multiple action types:
  // - omni_* (unified/aggregated)
  // - offsite_conversion.fb_pixel_* (pixel-based)
  // - base names (e.g., "search", "purchase")
  //
  // We must use ONLY the "omni_*" variants as the single source of truth
  // to avoid double/triple counting conversions!
  //
  // Build a lookup map for fast access
  const actionMap = new Map<string, number>();
  actions.forEach((action) => {
    const actionType = String(action.action_type || '').toLowerCase();
    const value = parseInt(action.value || '0', 10);
    if (!isNaN(value) && value >= 0) {
      actionMap.set(actionType, (actionMap.get(actionType) || 0) + value);
    }
  });

  const mappedActionTypes = (metric: CanonicalConversionMetric) =>
    getMappedActionTypes(mappings, 'meta', metric);
  const mappedPhone = mappedActionTypes('click_to_call');
  const mappedEmail = mappedActionTypes('email_contacts');
  const mappedStep1 = mappedActionTypes('booking_step_1');
  const mappedStep2 = mappedActionTypes('booking_step_2');
  const mappedStep3 = mappedActionTypes('booking_step_3');
  const mappedReservations = mappedActionTypes('reservations');

  if (mappedPhone?.length) {
    metrics.click_to_call = selectFirstMappedActionValue(actionMap, mappedPhone);
  } else if (accountPhoneActionType !== undefined) {
    // Account-level selection: every campaign reads the SAME phone action type
    // so per-campaign fallbacks to broader subtypes cannot inflate the total.
    metrics.click_to_call = accountPhoneActionType
      ? actionMap.get(accountPhoneActionType) || 0
      : 0;
  } else {
    metrics.click_to_call = selectMetaPhoneClicks(actionMap, forcePBMOnly);
  }
  if (mappedEmail) metrics.email_contacts = selectFirstMappedActionValue(actionMap, mappedEmail);
  if (mappedStep1) metrics.booking_step_1 = selectFirstMappedActionValue(actionMap, mappedStep1);
  if (mappedStep2) metrics.booking_step_2 = selectFirstMappedActionValue(actionMap, mappedStep2);
  if (mappedStep3) metrics.booking_step_3 = selectFirstMappedActionValue(actionMap, mappedStep3);
  if (mappedReservations) {
    metrics.reservations = selectFirstMappedActionValue(actionMap, mappedReservations);
  }

  // Parse actions array - using PRIORITY ORDER to avoid double counting
  actions.forEach((action) => {
    try {
      const actionType = String(action.action_type || '').toLowerCase();
      const value = parseInt(action.value || '0', 10);
      
      // 🔍 DEBUG: Log booking_step_3 related actions for debugging
      if (actionType.includes('initiate_checkout') || actionType.includes('booking_step_3')) {
        logger.debug(`🔍 parseMetaActions: Found booking_step_3 action: ${actionType} = ${value}`, { campaignName });
      }
      
      if (isNaN(value) || value < 0) {
        logger.debug(`parseMetaActions: Invalid value for action_type "${actionType}": ${action.value}`);
        return; // Skip invalid values
      }
      
      // ✅ EMAIL CONTACTS (website e-mail clicks only — lead/instant forms excluded)
      if (!mappedEmail && actionType === HAVET_EMAIL_EVENT) {  // Havet PBM email
        metrics.email_contacts += value;
      }
      
      // ✅ BOOKING STEP 1 - Search (Wyszukiwania)
      // UPDATED: Use omni_search as Step 1 (searches in booking engine)
      // This represents when someone searches for availability/dates
      if (!mappedStep1 && actionType === 'omni_search') {
        metrics.booking_step_1 = value; // Use assignment, not +=
      }
      // Fallback: use offsite_conversion.fb_pixel_search if omni_search not present
      else if (!mappedStep1 && actionType === 'offsite_conversion.fb_pixel_search' && !actionMap.has('omni_search')) {
        metrics.booking_step_1 = value;
      }
      // Fallback: use base 'search' if others not present
      else if (!mappedStep1 && actionType === 'search' && !actionMap.has('omni_search') && !actionMap.has('offsite_conversion.fb_pixel_search')) {
        metrics.booking_step_1 = value;
      }
      
      // ✅ BOOKING STEP 2 - View Content (Booking Engine View Details)
      // Use ONLY omni_view_content as the single source of truth
      if (!mappedStep2 && actionType === 'omni_view_content') {
        metrics.booking_step_2 = value; // Use assignment, not +=
      }
      // Fallback if omni_view_content not present
      else if (!mappedStep2 && actionType === 'offsite_conversion.fb_pixel_view_content' && !actionMap.has('omni_view_content')) {
        metrics.booking_step_2 = value;
      }
      
      // ✅ BOOKING STEP 3 - Initiate Checkout (Booking Engine Begin Booking)
      // Use ONLY omni_initiated_checkout as the single source of truth
      if (!mappedStep3 && actionType === 'omni_initiated_checkout') {
        metrics.booking_step_3 = value; // Use assignment, not +=
      }
      // Fallback if omni_initiated_checkout not present
      else if (!mappedStep3 && actionType === 'offsite_conversion.fb_pixel_initiate_checkout' && !actionMap.has('omni_initiated_checkout')) {
        metrics.booking_step_3 = value;
      }
      
      // ✅ RESERVATIONS - Final Purchase
      // Use ONLY omni_purchase as the single source of truth
      if (!mappedReservations && actionType === 'omni_purchase') {
        metrics.reservations = value; // Use assignment, not +=
      }
      // Fallback if omni_purchase not present
      else if (!mappedReservations && actionType === 'offsite_conversion.fb_pixel_purchase' && !actionMap.has('omni_purchase')) {
        metrics.reservations = value;
      }
      
    } catch (error) {
      logger.error(`parseMetaActions: Error parsing action`, {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignName
      });
    }
  });

  // ✅ CRITICAL FIX: Build action_values lookup map to avoid double counting
  const actionValueMap = new Map<string, number>();
  actionValues.forEach((av) => {
    const actionType = String(av.action_type || '').toLowerCase();
    const value = parseFloat(av.value || '0');
    if (!isNaN(value) && value >= 0) {
      actionValueMap.set(actionType, (actionValueMap.get(actionType) || 0) + value);
    }
  });

  const mappedReservationValue =
    mappedActionTypes('reservation_value') || mappedReservations;
  if (mappedReservationValue) {
    metrics.reservation_value = selectFirstMappedActionValue(
      actionValueMap,
      mappedReservationValue
    );
  }

  // Parse action_values array (for monetary values)
  // Use ONLY omni_purchase as the single source of truth (same event duplicated)
  actionValues.forEach((actionValue) => {
    try {
      const actionType = String(actionValue.action_type || '').toLowerCase();
      const value = parseFloat(actionValue.value || '0');
      
      if (isNaN(value) || value < 0) {
        logger.debug(`parseMetaActions: Invalid value for action_value "${actionType}": ${actionValue.value}`);
        return; // Skip invalid values
      }
      
      // ✅ Reservation value (purchase value) - use ONLY omni_purchase
      if (!mappedReservationValue && actionType === 'omni_purchase') {
        metrics.reservation_value = value; // Use assignment, not +=
      }
      // Fallback if omni_purchase not present
      else if (!mappedReservationValue && actionType === 'offsite_conversion.fb_pixel_purchase' && !actionValueMap.has('omni_purchase')) {
        metrics.reservation_value = value;
      }
      
    } catch (error) {
      logger.error(`parseMetaActions: Error parsing action_value`, {
        actionValue,
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignName
      });
    }
  });

  // Validation: Check for funnel inversions (debugging aid)
  if (metrics.booking_step_2 > metrics.booking_step_1 && metrics.booking_step_1 > 0) {
    logger.warn(`⚠️ Funnel inversion detected for campaign "${campaignName || 'unknown'}": Step 2 (${metrics.booking_step_2}) > Step 1 (${metrics.booking_step_1})`);
  }
  
  if (metrics.booking_step_3 > metrics.booking_step_2 && metrics.booking_step_2 > 0) {
    logger.warn(`⚠️ Funnel inversion detected for campaign "${campaignName || 'unknown'}": Step 3 (${metrics.booking_step_3}) > Step 2 (${metrics.booking_step_2})`);
  }
  
  if (metrics.reservations > metrics.booking_step_3 && metrics.booking_step_3 > 0) {
    logger.warn(`⚠️ Funnel inversion detected for campaign "${campaignName || 'unknown'}": Reservations (${metrics.reservations}) > Step 3 (${metrics.booking_step_3})`);
  }

  // ✅ DIRECT FROM API: Use reservation_value from action_values
  // This is "Zakupy w witrynie - wartość konwersji" in Meta Ads Manager
  // No calculation needed - Meta API provides the value directly
  metrics.conversion_value = metrics.reservation_value;
  metrics.total_conversion_value = metrics.reservation_value;
  
  // Log if we have conversion value from API
  if (metrics.reservation_value > 0) {
    logger.debug(`📊 Meta conversion value from API (action_values) for "${campaignName}":`, {
      reservation_value: metrics.reservation_value,
      conversion_value: metrics.conversion_value,
      total_conversion_value: metrics.total_conversion_value
    });
  }

  return metrics;
}

/**
 * Parse and enhance a single campaign with conversion metrics
 * 
 * @param campaign - Meta API campaign object
 * @returns Campaign with added conversion metrics
 */
export function enhanceCampaignWithConversions(
  campaign: any,
  mappings?: ClientConversionMappings
): any {
  const parsed = mergeMetaContactMetrics(
    parseMetaActions(
      campaign.actions || [],
      campaign.action_values || [],
      campaign.campaign_name || campaign.name,
      false,
      mappings
    ),
    extractMetaContactFromConversions(campaign.conversions || [], mappings)
  );
  const formConv = sumMetaFormConversionActions(campaign.actions || []);

  return {
    ...campaign,
    ...parsed,
    conversions: resolveMetaHeadlineConversions(campaign, formConv),
  };
}

/**
 * Parse and enhance multiple campaigns with conversion metrics
 * 
 * @param campaigns - Array of Meta API campaign objects
 * @returns Campaigns with added conversion metrics
 */
export function enhanceCampaignsWithConversions(
  campaigns: any[],
  mappings?: ClientConversionMappings
): any[] {
  if (!Array.isArray(campaigns)) {
    logger.warn('enhanceCampaignsWithConversions: campaigns is not an array');
    return [];
  }
  
  // ✅ CRITICAL FIX: Check if ANY campaign has PBM events at account level
  // If ANY campaign uses PBM, ALL campaigns should use PBM-only logic
  // This prevents mixing PBM and standard events (which causes double-counting)
  const pbmEventKey = PBM_PHONE_EVENT;
  const hasConfiguredPhoneMapping =
    !!getMappedActionTypes(mappings, 'meta', 'click_to_call');
  let accountHasPBM = false;
  
  // First pass: Check if any campaign has PBM events
  for (const campaign of campaigns) {
    if (hasConfiguredPhoneMapping) break;
    const actions = campaign.actions || [];
    for (const action of actions) {
      const actionType = String(action.action_type || '').toLowerCase();
      if (actionType === pbmEventKey) {
        accountHasPBM = true;
        break;
      }
    }
    if (accountHasPBM) break;
  }
  
  if (accountHasPBM) {
    logger.info(`✅ Account-level PBM detection: Found PBM events in at least one campaign. All campaigns will use PBM-only logic.`);
  }
  
  // Account-level phone source: all campaigns read one action type so mixed
  // per-campaign fallbacks can't inflate the total.
  const accountPhoneActionType = hasConfiguredPhoneMapping
    ? undefined
    : selectAccountMetaPhoneActionType(campaigns);

  // Second pass: Parse each campaign, but force PBM-only if account has PBM
  const parsedCampaigns = campaigns.map(campaign => ({
    campaign,
    fromActions: parseMetaActions(
      campaign.actions || [],
      campaign.action_values || [],
      campaign.campaign_name || campaign.name,
      accountHasPBM,
      mappings,
      accountPhoneActionType
    ),
    fromConversions: extractMetaContactFromConversions(campaign.conversions || [], mappings),
  }));

  // ✅ Account-level source selection: if ANY campaign reports phones/emails via
  // actions[] (call ads or PBM custom events), use actions[] as the single source
  // for the whole account. Mixing actions[] and the conversions[] pixel fallback
  // across campaigns double-counts the same contact (e.g. Arche Nałęczów 12 vs 11).
  const accountPhonesFromActions = parsedCampaigns.some(p => p.fromActions.click_to_call > 0);
  const accountEmailsFromActions = parsedCampaigns.some(p => p.fromActions.email_contacts > 0);

  return parsedCampaigns.map(({ campaign, fromActions, fromConversions }) => {
    const parsed = mergeMetaContactMetrics(fromActions, fromConversions, {
      allowPhoneFallback: !accountPhonesFromActions,
      allowEmailFallback: !accountEmailsFromActions,
    });
    const formConv = sumMetaFormConversionActions(campaign.actions || []);

    return {
      ...campaign,
      ...parsed,
      conversions: resolveMetaHeadlineConversions(campaign, formConv),
    };
  });
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
    conversion_value: 0,
    total_conversion_value: 0,
    roas: 0, // Will be calculated after aggregation
  };
  
  if (!Array.isArray(campaigns)) {
    logger.warn('aggregateConversionMetrics: campaigns is not an array');
    return totals;
  }
  
  // ✅ CRITICAL FIX: Sanitize values to numbers to prevent string concatenation
  const sanitizeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  let totalSpend = 0;

  campaigns.forEach((campaign) => {
    totals.click_to_call += sanitizeNumber(campaign.click_to_call);
    totals.email_contacts += sanitizeNumber(campaign.email_contacts);
    totals.booking_step_1 += sanitizeNumber(campaign.booking_step_1);
    totals.booking_step_2 += sanitizeNumber(campaign.booking_step_2);
    totals.booking_step_3 += sanitizeNumber(campaign.booking_step_3);
    totals.reservations += sanitizeNumber(campaign.reservations);
    totals.reservation_value += sanitizeNumber(campaign.reservation_value);
    totals.conversion_value += sanitizeNumber(campaign.conversion_value);
    totals.total_conversion_value += sanitizeNumber(campaign.total_conversion_value);
    totalSpend += sanitizeNumber(campaign.spend);
  });
  
  // ✅ Calculate aggregated ROAS from total_conversion_value / totalSpend
  if (totalSpend > 0 && totals.total_conversion_value > 0) {
    totals.roas = totals.total_conversion_value / totalSpend;
  }
  
  return totals;
}

