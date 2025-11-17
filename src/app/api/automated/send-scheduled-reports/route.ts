import { NextRequest, NextResponse } from 'next/server';
import { EmailScheduler } from '../../../../lib/email-scheduler';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  try {
    logger.info('🚀 Automated email scheduler triggered');
    
    // Create scheduler instance
    const scheduler = new EmailScheduler();
    
    // Check and send scheduled emails
    const result = await scheduler.checkAndSendScheduledEmails();
    
    console.log(`📊 Scheduler results:`, {
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors.length
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Email scheduler completed successfully`,
      data: {
        sent: result.sent,
        skipped: result.skipped,
        errors: result.errors,
        details: result.details
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Automated email scheduler error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  try {
    logger.info('🔍 Manual email scheduler check triggered');
    
    const scheduler = new EmailScheduler();
    const result = await scheduler.checkAndSendScheduledEmails();
    
    return NextResponse.json({
      success: true,
      message: `Manual email scheduler check completed`,
      data: {
        sent: result.sent,
        skipped: result.skipped,
        errors: result.errors,
        details: result.details
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual email scheduler error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 