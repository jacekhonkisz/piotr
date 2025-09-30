/**
 * Startup Validation
 * 
 * This module runs validation checks when the application starts up
 * to ensure all required configuration is present and valid.
 */

import { validateEnvironmentOrThrow, getEnvironmentStatus } from './environment-validator';

/**
 * Run all startup validation checks
 */
export function runStartupValidation(): void {
  console.log('🔍 Running startup validation checks...');
  
  // Skip strict validation during build process
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('⏭️ Skipping strict validation during build phase');
    return;
  }
  
  try {
    // 1. Validate environment variables
    validateEnvironmentOrThrow();
    
    // 2. Log environment status for monitoring
    const envStatus = getEnvironmentStatus();
    console.log(`📊 Environment Status:`, {
      environment: envStatus.environment,
      errors: envStatus.errorCount,
      warnings: envStatus.warningCount,
    });
    
    // 3. Additional startup checks can be added here
    // - Database connectivity
    // - External API health checks
    // - Cache system initialization
    
    console.log('✅ All startup validation checks passed');
    
  } catch (error) {
    console.error('❌ Startup validation failed:', error);
    
    // In production, we might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Exiting due to validation failure in production');
      process.exit(1);
    }
    
    // In development, we'll throw the error to be handled by Next.js
    throw error;
  }
}

/**
 * Initialize the application with validation
 * This should be called once when the app starts
 */
let validationRun = false;

export function initializeApp(): void {
  if (!validationRun) {
    runStartupValidation();
    validationRun = true;
  }
}
