import { z } from 'zod';

/**
 * Validation schemas for API requests
 * Using Zod for runtime type checking and validation
 */

// ============================================================================
// MONITORING API SCHEMAS
// ============================================================================

export const recordMetricSchema = z.object({
  action: z.literal('record_metric'),
  data: z.object({
    type: z.enum(['api_request', 'cache_operation', 'database_query', 'meta_api_call']),
    endpoint: z.string().optional(),
    responseTime: z.number().positive().optional(),
    success: z.boolean().optional(),
    operation: z.string().optional(),
    key: z.string().optional(),
    queryTime: z.number().positive().optional(),
    query: z.string().optional(),
    rateLimitHit: z.boolean().optional()
  })
});

export const clearAlertsSchema = z.object({
  action: z.literal('clear_alerts'),
  data: z.object({
    alertIds: z.array(z.string()).optional(),
    clearAll: z.boolean().optional()
  })
});

export const monitoringActionSchema = z.discriminatedUnion('action', [
  recordMetricSchema,
  clearAlertsSchema
]);

// ============================================================================
// DATA VALIDATION API SCHEMAS
// ============================================================================

export const dataValidationSchema = z.object({
  checkTypes: z.array(z.enum([
    'completeness',
    'consistency',
    'accuracy',
    'freshness',
    'integrity'
  ])).optional(),
  clientId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM format
  severity: z.enum(['info', 'warning', 'critical']).optional()
});

// ============================================================================
// CLIENT API SCHEMAS
// ============================================================================

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  company: z.string().min(1).max(200).optional(),
  ad_account_id: z.string().optional(),
  meta_access_token: z.string().optional(),
  system_user_token: z.string().optional(),
  google_ads_customer_id: z.string().regex(/^\d{3}-\d{3}-\d{4}$/).optional(),
  google_ads_refresh_token: z.string().optional(),
  google_ads_system_user_token: z.string().optional(),
  google_ads_enabled: z.boolean().optional(),
  reporting_frequency: z.enum(['monthly', 'weekly', 'on_demand']).default('monthly'),
  notes: z.string().optional()
});

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid()
});

// ============================================================================
// CACHE API SCHEMAS
// ============================================================================

export const clearCacheSchema = z.object({
  clientId: z.string().uuid().optional(),
  cacheType: z.enum(['monthly', 'weekly', 'daily', 'all']).optional()
});

export const refreshCacheSchema = z.object({
  clientId: z.string().uuid().optional(),
  force: z.boolean().default(false),
  platform: z.enum(['meta', 'google_ads', 'all']).optional()
});

// ============================================================================
// REPORT API SCHEMAS
// ============================================================================

export const generateReportSchema = z.object({
  clientId: z.string().uuid(),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  format: z.enum(['pdf', 'json']).default('pdf'),
  includeCharts: z.boolean().default(true),
  includeAISummary: z.boolean().default(true)
});

export const sendReportSchema = z.object({
  clientId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().max(1000).optional()
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

export const bulkClientActionSchema = z.object({
  action: z.enum([
    'delete',
    'regenerate_credentials',
    'generate_reports',
    'change_frequency'
  ]),
  clientIds: z.array(z.string().uuid()).min(1).max(50),
  frequency: z.enum(['monthly', 'weekly', 'on_demand']).optional()
});

// ============================================================================
// ADMIN API SCHEMAS
// ============================================================================

export const verifyClientDataSchema = z.object({
  clientId: z.string().uuid().optional(),
  clientName: z.string().optional(),
  forceLive: z.boolean().default(false)
}).refine(
  (data) => data.clientId || data.clientName,
  { message: 'Either clientId or clientName must be provided' }
);

export const backfillDataSchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataType: z.enum(['daily', 'weekly', 'monthly', 'all']).default('all'),
  force: z.boolean().default(false)
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate request body against a schema
 * @param data - Request body data
 * @param schema - Zod schema to validate against
 * @returns Validated data or throws error
 */
export function validateRequest<T>(data: unknown, schema: z.ZodSchema<T>): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns result object instead of throwing
 * @param data - Request body data
 * @param schema - Zod schema to validate against
 * @returns Object with success flag and data or errors
 */
export function safeValidateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Format Zod errors into user-friendly messages
 * @param error - Zod error object
 * @returns Array of error messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

