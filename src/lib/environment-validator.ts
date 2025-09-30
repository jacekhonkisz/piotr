/**
 * Environment Variable Validation
 * 
 * This module validates that all required environment variables are present
 * and properly configured for the current environment (development/production).
 */

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
}

/**
 * Required environment variables for all environments
 */
const REQUIRED_ALWAYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/**
 * Required environment variables for production only
 */
const REQUIRED_PRODUCTION = [
  'NEXT_PUBLIC_APP_URL',
  'RESEND_API_KEY',
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED = [
  'OPENAI_API_KEY',
  'META_ACCESS_TOKEN',
  'SENTRY_DSN',
  'LOG_LEVEL',
];

/**
 * Validate a single environment variable
 */
function validateVariable(name: string, value: string | undefined, required: boolean): { error?: string; warning?: string } {
  if (!value || value.trim() === '') {
    if (required) {
      return { error: `${name} is required but not set` };
    } else {
      return { warning: `${name} is recommended but not set` };
    }
  }

  // Additional validation for specific variables
  switch (name) {
    case 'NEXT_PUBLIC_SUPABASE_URL':
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        return { error: `${name} must be a valid Supabase URL (https://xxx.supabase.co)` };
      }
      break;
    
    case 'NEXT_PUBLIC_APP_URL':
      if (process.env.NODE_ENV === 'production' && !value.startsWith('https://')) {
        return { error: `${name} must use HTTPS in production` };
      }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { error: `${name} must be a valid URL` };
      }
      break;
    
    case 'RESEND_API_KEY':
      if (!value.startsWith('re_')) {
        return { warning: `${name} should start with 're_' for Resend API keys` };
      }
      break;
    
    case 'OPENAI_API_KEY':
      if (!value.startsWith('sk-')) {
        return { warning: `${name} should start with 'sk-' for OpenAI API keys` };
      }
      break;
  }

  return {};
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvironmentValidationResult {
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables for all environments
  for (const varName of REQUIRED_ALWAYS) {
    const result = validateVariable(varName, process.env[varName], true);
    if (result.error) errors.push(result.error);
    if (result.warning) warnings.push(result.warning);
  }

  // Check production-specific required variables
  if (isProduction) {
    for (const varName of REQUIRED_PRODUCTION) {
      const result = validateVariable(varName, process.env[varName], true);
      if (result.error) errors.push(result.error);
      if (result.warning) warnings.push(result.warning);
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED) {
    const result = validateVariable(varName, process.env[varName], false);
    if (result.warning) warnings.push(result.warning);
  }

  // Additional environment-specific checks
  if (isProduction) {
    // Check that we're not using development values in production
    if (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')) {
      errors.push('NEXT_PUBLIC_APP_URL cannot use localhost in production');
    }
    
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL cannot use localhost in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    environment,
  };
}

/**
 * Validate environment and throw error if invalid
 */
export function validateEnvironmentOrThrow(): void {
  // During build phase, only validate basic requirements
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (isBuildPhase) {
    console.log('⏭️ Build phase: Running basic environment validation only');
    // Only check absolutely critical variables during build
    const criticalVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = criticalVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('❌ Critical environment variables missing:', missing);
      throw new Error(`Critical environment variables missing: ${missing.join(', ')}`);
    }
    
    console.log('✅ Basic environment validation passed for build phase');
    return;
  }
  
  const result = validateEnvironment();
  
  if (!result.isValid) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    
    if (result.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    throw new Error(`Environment validation failed with ${result.errors.length} error(s)`);
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log(`✅ Environment validation passed for ${result.environment} environment`);
}

/**
 * Get environment status for monitoring/health checks
 */
export function getEnvironmentStatus() {
  const result = validateEnvironment();
  
  return {
    environment: result.environment,
    isValid: result.isValid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    timestamp: new Date().toISOString(),
  };
}
