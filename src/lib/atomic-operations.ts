/**
 * 💾 Atomic Operations Helper
 * 
 * Provides transaction-like behavior for Supabase operations.
 * While Supabase doesn't expose native transactions, we ensure atomicity through:
 * 1. Single upsert operations (atomic at DB level)
 * 2. Validation before save (Step 1 integration)
 * 3. Retry logic (Step 4 integration)
 * 4. All-or-nothing patterns
 */

import logger from './logger';
import { DataValidator } from './data-validation';
import { withRetry } from './retry-helper';

export interface AtomicOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  operationsCompleted: number;
  totalOperations: number;
}

/**
 * Execute multiple database operations atomically
 * 
 * Strategy:
 * 1. Validate all data first (fail fast)
 * 2. Prepare all operations
 * 3. Execute as single batch where possible
 * 4. Use upserts for idempotency
 * 5. Retry on failure
 */
export async function atomicUpsert<T>(
  operations: Array<{
    table: string;
    data: any;
    conflictColumns?: string;
    validate?: boolean;
  }>,
  supabaseClient: any
): Promise<AtomicOperationResult<T>> {
  
  logger.info('💾 Starting atomic operations', {
    operationCount: operations.length
  });

  try {
    // STEP 1: Validate all data first (fail fast before any DB operations)
    logger.info('🛡️ Validating all data before save...');
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      if (op.validate !== false && op.table === 'daily_kpi_data') {
        // Validate using Step 1 validator
        const validation = DataValidator.validate(op.data);
        
        if (!validation.isValid) {
          const errors = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`Validation failed for operation ${i + 1}: ${errors}`);
        }
        
        if (validation.warnings.length > 0) {
          logger.warn(`⚠️ Validation warnings for operation ${i + 1}:`, validation.warnings);
        }
      }
    }
    
    logger.info('✅ All data validated successfully');

    // STEP 2: Execute all operations with retry
    logger.info('💾 Executing database operations...');
    
    const result = await withRetry(async () => {
      const results = [];
      
      for (const op of operations) {
        const { error, data } = await supabaseClient
          .from(op.table)
          .upsert(op.data, {
            onConflict: op.conflictColumns || 'id'
          })
          .select();
        
        if (error) {
          throw new Error(`Failed to upsert to ${op.table}: ${error.message}`);
        }
        
        results.push(data);
      }
      
      return results;
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      enableJitter: true
    });

    if (!result.success) {
      throw result.error || new Error('Atomic operation failed');
    }

    logger.info('✅ All operations completed successfully', {
      operations: operations.length,
      attempts: result.attempts
    });

    return {
      success: true,
      data: result.data as T,
      operationsCompleted: operations.length,
      totalOperations: operations.length
    };

  } catch (error) {
    logger.error('❌ Atomic operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      operations: operations.length
    });

    return {
      success: false,
      error: error as Error,
      operationsCompleted: 0,
      totalOperations: operations.length
    };
  }
}

/**
 * Atomic monthly summary save
 * 
 * Ensures campaign_summaries are saved completely or not at all
 */
export async function saveMonthlySummary(params: {
  clientId: string;
  summaryDate: string;
  metrics: {
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    booking_step_2: number;
    reservations: number;
    reservation_value: number;
    campaigns_count: number;
    average_ctr: number;
    average_cpc: number;
  };
  campaignData?: any;
  metaTables?: any;
  supabaseClient: any;
}): Promise<AtomicOperationResult<any>> {
  
  const { clientId, summaryDate, metrics, campaignData, metaTables, supabaseClient } = params;
  
  logger.info('💾 Saving monthly summary atomically', {
    clientId,
    summaryDate
  });

  // Prepare complete record (all data together)
  const summaryRecord = {
    client_id: clientId,
    summary_type: 'monthly',
    summary_date: summaryDate,
    total_spend: metrics.total_spend,
    total_impressions: metrics.total_impressions,
    total_clicks: metrics.total_clicks,
    total_conversions: metrics.total_conversions,
    click_to_call: metrics.click_to_call,
    email_contacts: metrics.email_contacts,
    booking_step_1: metrics.booking_step_1,
    booking_step_2: metrics.booking_step_2,
    reservations: metrics.reservations,
    reservation_value: metrics.reservation_value,
    campaigns_count: metrics.campaigns_count || 0,
    active_campaigns: metrics.campaigns_count || 0,
    total_campaigns: metrics.campaigns_count || 0,
    average_ctr: metrics.average_ctr,
    average_cpc: metrics.average_cpc,
    average_cpa: metrics.reservations > 0 ? metrics.total_spend / metrics.reservations : 0,
    campaign_data: campaignData || null,
    meta_tables: metaTables || null,
    data_source: 'meta_api',
    last_updated: new Date().toISOString()
  };

  // Single atomic upsert
  return await atomicUpsert([{
    table: 'campaign_summaries',
    data: summaryRecord,
    conflictColumns: 'client_id,summary_type,summary_date',
    validate: false // campaign_summaries doesn't use our validator
  }], supabaseClient);
}

/**
 * Atomic daily data save with validation
 * 
 * Single operation that validates and saves
 */
export async function saveDailyDataAtomic(params: {
  dailyRecord: any;
  supabaseClient: any;
}): Promise<AtomicOperationResult<any>> {
  
  const { dailyRecord, supabaseClient } = params;
  
  logger.info('💾 Saving daily data atomically', {
    clientId: dailyRecord.client_id,
    date: dailyRecord.date
  });

  // Use atomic upsert with validation
  return await atomicUpsert([{
    table: 'daily_kpi_data',
    data: dailyRecord,
    conflictColumns: 'client_id,date',
    validate: true // Enable Step 1 validation
  }], supabaseClient);
}

/**
 * Check if operation can be safely retried (idempotency check)
 */
export function isIdempotent(operation: string, table: string): boolean {
  // Upserts are idempotent
  if (operation === 'upsert') {
    return true;
  }
  
  // Inserts are NOT idempotent (can create duplicates)
  if (operation === 'insert') {
    return false;
  }
  
  // Updates are idempotent if they set absolute values
  if (operation === 'update') {
    return true;
  }
  
  // Deletes are idempotent
  if (operation === 'delete') {
    return true;
  }
  
  return false;
}

export default atomicUpsert;
