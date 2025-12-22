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
      
      // ✅ CLICK TO CALL (PHONE)
      // Priority 1: Known PBM custom events (Havet-specific)
      // Priority 2: Standard click_to_call_call_confirm (all other clients)
      if (actionType === 'offsite_conversion.custom.1470262077092668') {  // Havet PBM phone
        metrics.click_to_call += value;
      }
      else if (actionType === 'click_to_call_call_confirm' && 
               !actionMap.has('offsite_conversion.custom.1470262077092668')) {
        metrics.click_to_call = value;
      }
      
      // ✅ EMAIL CONTACTS
      // Priority 1: Known PBM custom events (Havet-specific)
      // Priority 2: Standard lead events (all other clients)
      if (actionType === 'offsite_conversion.custom.2770488499782793') {  // Havet PBM email
        metrics.email_contacts += value;
      }
      else if ((actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') && 
               !actionMap.has('offsite_conversion.custom.2770488499782793')) {
        metrics.email_contacts += value;
      }
      
      // ✅ BOOKING STEP 1 - Search (Booking Engine Search)
      // Use ONLY omni_search as the single source of truth
      // Meta duplicates this as: omni_search, offsite_conversion.fb_pixel_search, search
      if (actionType === 'omni_search') {
        metrics.booking_step_1 = value; // Use assignment, not +=
      }
      // Fallback if omni_search not present but fb_pixel_search is
      else if (actionType === 'offsite_conversion.fb_pixel_search' && !actionMap.has('omni_search')) {
        metrics.booking_step_1 = value;
      }
      
      // ✅ BOOKING STEP 2 - View Content (Booking Engine View Details)
      // Use ONLY omni_view_content as the single source of truth
      if (actionType === 'omni_view_content') {
        metrics.booking_step_2 = value; // Use assignment, not +=
      }
      // Fallback if omni_view_content not present
      else if (actionType === 'offsite_conversion.fb_pixel_view_content' && !actionMap.has('omni_view_content')) {
        metrics.booking_step_2 = value;
      }
      
      // ✅ BOOKING STEP 3 - Initiate Checkout (Booking Engine Begin Booking)
      // Use ONLY omni_initiated_checkout as the single source of truth
      if (actionType === 'omni_initiated_checkout') {
        metrics.booking_step_3 = value; // Use assignment, not +=
      }
      // Fallback if omni_initiated_checkout not present
      else if (actionType === 'offsite_conversion.fb_pixel_initiate_checkout' && !actionMap.has('omni_initiated_checkout')) {
        metrics.booking_step_3 = value;
      }
      
      // ✅ RESERVATIONS - Final Purchase
      // Use ONLY omni_purchase as the single source of truth
      if (actionType === 'omni_purchase') {
        metrics.reservations = value; // Use assignment, not +=
      }
      // Fallback if omni_purchase not present
      else if (actionType === 'offsite_conversion.fb_pixel_purchase' && !actionMap.has('omni_purchase')) {
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
      if (actionType === 'omni_purchase') {
        metrics.reservation_value = value; // Use assignment, not +=
      }
      // Fallback if omni_purchase not present
      else if (actionType === 'offsite_conversion.fb_pixel_purchase' && !actionValueMap.has('omni_purchase')) {
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
export function enhanceCampaignWithConversions(campaign: any): any {
  // ✅ Parse action_values to get "Zakupy w witrynie - wartość konwersji" directly from API
  const parsed = parseMetaActions(
    campaign.actions || [],
    campaign.action_values || [],
    campaign.campaign_name || campaign.name
  );
  
  return {
    ...campaign,
    ...parsed
  };
}

/**
 * Parse and enhance multiple campaigns with conversion metrics
 * 
 * @param campaigns - Array of Meta API campaign objects
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

