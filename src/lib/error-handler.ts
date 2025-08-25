/**
 * Production-Ready Error Handling System
 * Centralized error handling with logging and monitoring
 */

import logger from './logger';

export interface ErrorContext {
  userId?: string;
  clientId?: string;
  endpoint?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: string;
  requestId?: string;
  retryAttempt?: number;
  maxRetries?: number;
}

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: ErrorContext;
  isOperational?: boolean;
}

/**
 * Custom error classes for different error types
 */
export class ValidationError extends Error implements AppError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}

export class AuthenticationError extends Error implements AppError {
  code = 'AUTHENTICATION_ERROR';
  statusCode = 401;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string = 'Authentication required', context?: ErrorContext) {
    super(message);
    this.name = 'AuthenticationError';
    this.context = context;
  }
}

export class AuthorizationError extends Error implements AppError {
  code = 'AUTHORIZATION_ERROR';
  statusCode = 403;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string = 'Access denied', context?: ErrorContext) {
    super(message);
    this.name = 'AuthorizationError';
    this.context = context;
  }
}

export class NotFoundError extends Error implements AppError {
  code = 'NOT_FOUND_ERROR';
  statusCode = 404;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string = 'Resource not found', context?: ErrorContext) {
    super(message);
    this.name = 'NotFoundError';
    this.context = context;
  }
}

export class RateLimitError extends Error implements AppError {
  code = 'RATE_LIMIT_ERROR';
  statusCode = 429;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string = 'Rate limit exceeded', context?: ErrorContext) {
    super(message);
    this.name = 'RateLimitError';
    this.context = context;
  }
}

export class ExternalServiceError extends Error implements AppError {
  code = 'EXTERNAL_SERVICE_ERROR';
  statusCode = 502;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = 'ExternalServiceError';
    this.context = context;
  }
}

export class DatabaseError extends Error implements AppError {
  code = 'DATABASE_ERROR';
  statusCode = 500;
  isOperational = true;
  context?: ErrorContext;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = 'DatabaseError';
    this.context = context;
  }
}

/**
 * Central error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log errors appropriately
   */
  handleError(error: Error | AppError, context?: ErrorContext): void {
    const appError = this.normalizeError(error, context);
    
    // Log error with appropriate level
    if (appError.isOperational) {
      if (appError.statusCode && appError.statusCode >= 500) {
        logger.error('Operational error (server)', {
          name: appError.name,
          message: appError.message,
          code: appError.code,
          statusCode: appError.statusCode,
          context: appError.context,
          stack: appError.stack
        });
      } else {
        logger.warn('Operational error (client)', {
          name: appError.name,
          message: appError.message,
          code: appError.code,
          statusCode: appError.statusCode,
          context: appError.context
        });
      }
    } else {
      // Programming errors - always log as error
      logger.error('Programming error', {
        name: appError.name,
        message: appError.message,
        code: appError.code,
        statusCode: appError.statusCode,
        context: appError.context,
        stack: appError.stack
      });

      // In production, you might want to send alerts for programming errors
      if (process.env.NODE_ENV === 'production') {
        this.sendAlert(appError);
      }
    }
  }

  /**
   * Normalize any error to AppError format
   */
  private normalizeError(error: Error | AppError, context?: ErrorContext): AppError {
    if (this.isAppError(error)) {
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }

    // Convert generic errors to AppError
    const appError: AppError = {
      ...error,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      isOperational: false,
      context: {
        ...context,
        timestamp: new Date().toISOString()
      }
    };

    return appError;
  }

  /**
   * Check if error is an AppError
   */
  private isAppError(error: Error | AppError): error is AppError {
    return 'code' in error && 'statusCode' in error && 'isOperational' in error;
  }

  /**
   * Send alert for critical errors (implement based on your alerting system)
   */
  private sendAlert(error: AppError): void {
    // Implement your alerting logic here
    // Examples: Slack webhook, email, PagerDuty, etc.
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to monitoring service
      console.error('🚨 CRITICAL ERROR ALERT:', {
        error: error.message,
        code: error.code,
        context: error.context,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Create safe error response for API endpoints
   */
  createErrorResponse(error: Error | AppError, context?: ErrorContext) {
    const appError = this.normalizeError(error, context);
    
    // Log the error
    this.handleError(appError);

    // Return safe response (don't expose internal details)
    const response: any = {
      error: true,
      code: appError.code,
      message: appError.isOperational 
        ? appError.message 
        : 'An unexpected error occurred',
      statusCode: appError.statusCode || 500,
      timestamp: new Date().toISOString()
    };

    // Add request ID if available
    if (appError.context?.requestId) {
      response.requestId = appError.context.requestId;
    }

    return response;
  }
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler(
  handler: (req: any, res: any) => Promise<any>
) {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      const errorHandler = ErrorHandler.getInstance();
      const context: ErrorContext = {
        endpoint: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      };

      const errorResponse = errorHandler.createErrorResponse(error as Error, context);
      
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
}

/**
 * Promise error wrapper
 */
export function handlePromise<T>(
  promise: Promise<T>
): Promise<[T | null, Error | null]> {
  return promise
    .then<[T, null]>((data: T) => [data, null])
    .catch<[null, Error]>((error: Error) => [null, error]);
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        const errorHandler = ErrorHandler.getInstance();
        errorHandler.handleError(lastError, {
          ...context,
          retryAttempt: attempt,
          maxRetries
        });
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
        error: lastError.message,
        context,
        nextRetryIn: `${Math.round(delay)}ms`
      });
    }
  }

  throw lastError!;
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
