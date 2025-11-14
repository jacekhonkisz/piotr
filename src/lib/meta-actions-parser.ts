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
}

/**
 * Parses Meta API actions array into structured conversion metrics
 * 
 * @param actions - The actions array from Meta API campaign insights
 * @param actionValues - The action_values array from Meta API (for monetary values)
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

  // Parse actions array
  actions.forEach((action) => {
    try {
      const actionType = String(action.action_type || '').toLowerCase();
      const value = parseInt(action.value || '0', 10);
      
      if (isNaN(value) || value < 0) {
        logger.debug(`parseMetaActions: Invalid value for action_type "${actionType}": ${action.value}`);
        return; // Skip invalid values
      }
      
      // Click to call conversions
      if (actionType.includes('click_to_call') || 
          actionType.includes('phone_number_clicks')) {
        metrics.click_to_call += value;
      }
      
      // Email contact conversions
      if (actionType.includes('contact') || 
          actionType.includes('email') ||
          actionType.includes('onsite_web_lead')) {
        metrics.email_contacts += value;
      }
      
      // ✅ BOOKING STEP 1 - Search (Booking Engine Search)
      // Maps to Meta column: "search"
      // Includes: omni_search, offsite_conversion.fb_pixel_search, search
      if (actionType.includes('booking_step_1') || 
          actionType.includes('search') ||
          actionType === 'search' ||
          actionType === 'omni_search' ||
          actionType.includes('fb_pixel_search')) {
        metrics.booking_step_1 += value;
      }
      
      // ✅ BOOKING STEP 2 - View Content (Booking Engine View Details)
      // Maps to Meta column: "view content"
      // Includes: omni_view_content, offsite_conversion.fb_pixel_view_content, view_content
      if (actionType.includes('booking_step_2') || 
          actionType.includes('view_content') ||
          actionType === 'view_content' ||
          actionType === 'omni_view_content' ||
          actionType.includes('fb_pixel_view_content') ||
          actionType.includes('offsite_conversion.custom.1150356839010935')) {
        metrics.booking_step_2 += value;
      }
      
      // ✅ BOOKING STEP 3 - Initiate Checkout (Booking Engine Begin Booking)
      // Maps to Meta column: "initiate checkout"
      // Includes: omni_initiated_checkout, initiate_checkout, offsite_conversion.fb_pixel_initiate_checkout
      if (actionType.includes('booking_step_3') || 
          actionType.includes('initiate_checkout') ||
          actionType === 'initiate_checkout' ||
          actionType === 'omni_initiated_checkout' ||
          actionType.includes('fb_pixel_initiate_checkout') ||
          actionType.includes('offsite_conversion.custom.3490904591193350')) {
        metrics.booking_step_3 += value;
      }
      
      // RESERVATIONS - Final Purchase
      // Maps to: purchase, complete_registration
      if (actionType === 'purchase' || 
          actionType.includes('fb_pixel_purchase') ||
          actionType.includes('offsite_conversion.fb_pixel_purchase') ||
          actionType.includes('omni_purchase') ||
          actionType === 'onsite_web_purchase' ||
          actionType.includes('complete_registration')) {
        metrics.reservations += value;
      }
      
    } catch (error) {
      logger.error(`parseMetaActions: Error parsing action`, {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignName
      });
    }
  });

  // Parse action_values array (for monetary values)
  actionValues.forEach((actionValue) => {
    try {
      const actionType = String(actionValue.action_type || '').toLowerCase();
      const value = parseFloat(actionValue.value || '0');
      
      if (isNaN(value) || value < 0) {
        logger.debug(`parseMetaActions: Invalid value for action_value "${actionType}": ${actionValue.value}`);
        return; // Skip invalid values
      }
      
      // Reservation value (purchase value)
      if (actionType === 'purchase' || 
          actionType.includes('fb_pixel_purchase') ||
          actionType.includes('offsite_conversion.fb_pixel_purchase') ||
          actionType.includes('omni_purchase') ||
          actionType === 'onsite_web_purchase') {
        metrics.reservation_value += value;
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

  return metrics;
}

/**
 * Parse and enhance a single campaign with conversion metrics
 * 
 * @param campaign - Meta API campaign object
 * @returns Campaign with added conversion metrics
 */
export function enhanceCampaignWithConversions(campaign: any): any {
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
  
  return totals;
}

