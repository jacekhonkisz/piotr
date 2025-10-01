/**
 * Production-Ready Data Validation
 * Prevents split data issues
 */

import logger from './logger';
import { productionMonitor } from './monitoring';

export interface DailyKPIData {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  campaigns_count: number;
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  reservations: number;
  reservation_value: number;
  client_id: string;
  date: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{field: string; message: string}>;
  warnings: Array<{field: string; message: string}>;
}

export class DataValidator {
  static validate(data: Partial<DailyKPIData>): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    
    // Check required fields
    const required = ['total_spend', 'total_impressions', 'total_clicks', 'click_to_call'];
    required.forEach(f => {
      if (data[f as keyof DailyKPIData] === undefined) {
        errors.push({ field: f, message: `Missing ${f}` });
      }
    });
    
    // Check split data
    const hasCampaigns = (data.total_spend || 0) > 0;
    const hasConversions = (data.click_to_call || 0) > 0 || (data.email_contacts || 0) > 0;
    
    if (hasCampaigns && !hasConversions) {
      errors.push({ field: 'conversions', message: 'SPLIT DATA: campaigns without conversions' });
    }
    if (!hasCampaigns && hasConversions) {
      errors.push({ field: 'campaigns', message: 'SPLIT DATA: conversions without campaigns' });
    }
    
    return { isValid: errors.length === 0, errors, warnings };
  }
}

export default DataValidator;
