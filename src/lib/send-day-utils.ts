/**
 * Utility functions for handling send_day validation and defaults
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SendDayValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: number | null;
}

/**
 * Get the system default send_day value
 */
export async function getSystemDefaultSendDay(): Promise<number> {
  try {
    const { data: sendDaySettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'default_reporting_day')
      .single();
    
    return sendDaySettings?.value ? parseInt(sendDaySettings.value) : 5;
  } catch (error) {
    console.warn('Failed to get system default send_day, using fallback:', error);
    return 5;
  }
}

/**
 * Validate and normalize send_day value based on reporting frequency
 */
export async function validateAndNormalizeSendDay(
  sendDay: any,
  reportingFrequency: 'monthly' | 'weekly' | 'on_demand'
): Promise<SendDayValidationResult> {
  
  // On-demand clients don't need send_day
  if (reportingFrequency === 'on_demand') {
    return {
      isValid: true,
      normalizedValue: null
    };
  }

  // Handle null/undefined/empty values
  if (sendDay === null || sendDay === undefined || sendDay === '') {
    const defaultSendDay = await getSystemDefaultSendDay();
    return {
      isValid: true,
      normalizedValue: reportingFrequency === 'weekly' ? 1 : defaultSendDay
    };
  }

  // Convert to number
  const sendDayValue = parseInt(sendDay);
  
  if (isNaN(sendDayValue)) {
    return {
      isValid: false,
      error: 'Send day must be a valid number'
    };
  }

  // Validate range based on frequency
  if (reportingFrequency === 'monthly') {
    if (sendDayValue < 1 || sendDayValue > 31) {
      return {
        isValid: false,
        error: 'Send day for monthly reports must be between 1 and 31'
      };
    }
  } else if (reportingFrequency === 'weekly') {
    if (sendDayValue < 1 || sendDayValue > 7) {
      return {
        isValid: false,
        error: 'Send day for weekly reports must be between 1 (Monday) and 7 (Sunday)'
      };
    }
  }

  return {
    isValid: true,
    normalizedValue: sendDayValue
  };
}

/**
 * Get the display label for a send_day value
 */
export function getSendDayLabel(sendDay: number, reportingFrequency: 'monthly' | 'weekly' | 'on_demand'): string {
  if (reportingFrequency === 'on_demand') {
    return 'On Demand';
  }

  if (reportingFrequency === 'monthly') {
    const suffix = getSuffix(sendDay);
    return `${sendDay}${suffix} of month`;
  }

  if (reportingFrequency === 'weekly') {
    const weekdays = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return weekdays[sendDay] || `Day ${sendDay}`;
  }

  return `Day ${sendDay}`;
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function getSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Ensure all clients have proper send_day values
 * This function can be used for data migration/cleanup
 */
export async function ensureClientSendDayConsistency(): Promise<{
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    // Get all clients with potential send_day issues
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id, reporting_frequency, send_day')
      .or('send_day.is.null,and(reporting_frequency.neq.on_demand,send_day.is.null)');

    if (fetchError) {
      errors.push(`Failed to fetch clients: ${fetchError.message}`);
      return { updated, errors };
    }

    const defaultSendDay = await getSystemDefaultSendDay();

    for (const client of clients || []) {
      const validation = await validateAndNormalizeSendDay(
        client.send_day,
        client.reporting_frequency
      );

      if (validation.isValid && validation.normalizedValue !== client.send_day) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ send_day: validation.normalizedValue })
          .eq('id', client.id);

        if (updateError) {
          errors.push(`Failed to update client ${client.id}: ${updateError.message}`);
        } else {
          updated++;
        }
      }
    }

    return { updated, errors };
  } catch (error) {
    errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { updated, errors };
  }
}
