import { NextRequest, NextResponse } from 'next/server';
import { dataValidator, DataValidationReport } from '../../../../lib/data-validation';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';
import logger from '../../../../lib/logger';

/**
 * Data Validation API Endpoint
 * 
 * GET - Run comprehensive data validation and return results
 * POST - Run specific validation checks
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    
    // Only allow admin users to run validation
    if (authResult.user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }
    
    logger.info('🔍 Data validation requested by admin', { 
      userId: authResult.user.id,
      userEmail: authResult.user.email 
    });
    
    // Run comprehensive validation
    const validationReport: DataValidationReport = await dataValidator.runFullValidation();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Data validation completed', {
      overallStatus: validationReport.overallStatus,
      healthScore: validationReport.healthScore,
      totalChecks: validationReport.totalChecks,
      criticalIssues: validationReport.criticalIssues,
      responseTime
    });
    
    return NextResponse.json({
      success: true,
      data: validationReport,
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        requestedBy: authResult.user.email
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('❌ Data validation failed', { 
      error: errorMessage,
      responseTime 
    });
    
    return NextResponse.json({
      success: false,
      error: 'Data validation failed',
      details: errorMessage,
      meta: {
        responseTime,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    
    // Only allow admin users to run validation
    if (authResult.user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }
    
    const body = await request.json().catch(() => ({}));
    const { checkTypes, clientId, period } = body;
    
    logger.info('🔍 Specific data validation requested', { 
      checkTypes,
      clientId,
      period,
      requestedBy: authResult.user.email
    });
    
    // For now, run full validation regardless of specific checks requested
    // In the future, this could be enhanced to run only specific validation types
    const validationReport: DataValidationReport = await dataValidator.runFullValidation();
    
    // Filter results if specific check types were requested
    if (checkTypes && Array.isArray(checkTypes)) {
      validationReport.checks = validationReport.checks.filter(check => 
        checkTypes.includes(check.checkType)
      );
      
      // Recalculate metrics for filtered results
      const filteredPassedChecks = validationReport.checks.filter(c => c.status === 'passed').length;
      const filteredWarningChecks = validationReport.checks.filter(c => c.status === 'warning').length;
      const filteredCriticalIssues = validationReport.checks.filter(c => c.severity === 'critical' && c.status === 'failed').length;
      
      validationReport.totalChecks = validationReport.checks.length;
      validationReport.passedChecks = filteredPassedChecks;
      validationReport.warningChecks = filteredWarningChecks;
      validationReport.criticalIssues = filteredCriticalIssues;
    }
    
    // Filter by client if specified
    if (clientId) {
      validationReport.checks = validationReport.checks.filter(check => 
        !check.clientId || check.clientId === clientId
      );
    }
    
    // Filter by period if specified
    if (period) {
      validationReport.checks = validationReport.checks.filter(check => 
        !check.period || check.period === period
      );
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Specific data validation completed', {
      checkTypes,
      filteredChecks: validationReport.checks.length,
      responseTime
    });
    
    return NextResponse.json({
      success: true,
      data: validationReport,
      meta: {
        responseTime,
        timestamp: new Date().toISOString(),
        requestedBy: authResult.user.email,
        filters: { checkTypes, clientId, period }
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('❌ Specific data validation failed', { 
      error: errorMessage,
      responseTime 
    });
    
    return NextResponse.json({
      success: false,
      error: 'Specific data validation failed',
      details: errorMessage,
      meta: {
        responseTime,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
