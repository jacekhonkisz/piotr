import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../../lib/flexible-email';
import { EMAIL_CONFIG } from '../../../../lib/email-config';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';
import logger from '../../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

type Frequency = 'monthly' | 'weekly' | 'on_demand';

interface ScheduledClient {
  id: string;
  name: string;
  email: string;
  contact_emails: string[] | null;
  reporting_frequency: Frequency;
  send_day: number;
  api_status: string;
}

interface ReportPeriod {
  start: string;
  end: string;
}

interface MonitorIssue {
  clientId: string;
  clientName: string;
  scheduledDate: string;
  period: ReportPeriod;
  status: 'missing' | 'failed';
  errorMessages: string[];
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function getReportPeriodForDate(frequency: Frequency, scheduledDate: Date): ReportPeriod | null {
  if (frequency === 'monthly') {
    const previousMonth = new Date(Date.UTC(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth() - 1,
      1
    ));
    const lastDayOfPreviousMonth = new Date(Date.UTC(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth(),
      0
    ));

    return {
      start: toDateKey(previousMonth),
      end: toDateKey(lastDayOfPreviousMonth)
    };
  }

  if (frequency === 'weekly') {
    const weekday = scheduledDate.getUTCDay();
    const daysBackToMonday = weekday === 0 ? 6 : weekday - 1;
    const lastMonday = new Date(scheduledDate);
    lastMonday.setUTCDate(scheduledDate.getUTCDate() - daysBackToMonday - 7);

    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

    return {
      start: toDateKey(lastMonday),
      end: toDateKey(lastSunday)
    };
  }

  return null;
}

function isDueOnDate(client: ScheduledClient, scheduledDate: Date): boolean {
  if (client.reporting_frequency === 'monthly') {
    return scheduledDate.getUTCDate() === client.send_day;
  }

  if (client.reporting_frequency === 'weekly') {
    const weekday = scheduledDate.getUTCDay() === 0 ? 7 : scheduledDate.getUTCDay();
    return weekday === client.send_day;
  }

  return false;
}

function buildAlertHtml(issues: MonitorIssue[]): string {
  const rows = issues.map(issue => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${issue.clientName}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${issue.status}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${issue.scheduledDate}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${issue.period.start} - ${issue.period.end}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${issue.errorMessages.join('<br>') || 'No success log found'}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <h2>Scheduled report delivery alert</h2>
      <p>The monitor found ${issues.length} scheduled report issue(s). These reports were due but were not successfully sent.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Client</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Status</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Scheduled date</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Report period</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Errors</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildAlertText(issues: MonitorIssue[]): string {
  return [
    `Scheduled report delivery alert: ${issues.length} issue(s)`,
    '',
    ...issues.map(issue => [
      `${issue.clientName} - ${issue.status}`,
      `Scheduled date: ${issue.scheduledDate}`,
      `Period: ${issue.period.start} - ${issue.period.end}`,
      `Errors: ${issue.errorMessages.join('; ') || 'No success log found'}`
    ].join('\n')),
  ].join('\n\n');
}

async function sendAlert(issues: MonitorIssue[]): Promise<void> {
  if (issues.length === 0) return;

  const emailService = FlexibleEmailService.getInstance();
  const [to = EMAIL_CONFIG.REVIEW_EMAIL, ...cc] = EMAIL_CONFIG.REVIEW_RECIPIENTS;

  const result = await emailService.sendEmail({
    to,
    cc,
    from: process.env.CUSTOM_SMTP_USER || process.env.EMAIL_FROM_ADDRESS || EMAIL_CONFIG.REVIEW_EMAIL,
    subject: `[ALERT] Scheduled reports failed or missing (${issues.length})`,
    html: buildAlertHtml(issues),
    text: buildAlertText(issues)
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to send scheduled report monitor alert');
  }
}

async function collectIssues(lookbackDays: number): Promise<MonitorIssue[]> {
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id,name,email,contact_emails,reporting_frequency,send_day,api_status')
    .eq('api_status', 'valid')
    .neq('reporting_frequency', 'on_demand');

  if (clientsError) {
    throw new Error(`Failed to load clients: ${clientsError.message}`);
  }

  const issues: MonitorIssue[] = [];

  for (let daysAgo = 0; daysAgo <= lookbackDays; daysAgo++) {
    const scheduledDate = getDateDaysAgo(daysAgo);
    const scheduledDateKey = toDateKey(scheduledDate);
    const dueClients = (clients || []).filter(client => isDueOnDate(client as ScheduledClient, scheduledDate));

    for (const client of dueClients as ScheduledClient[]) {
      const period = getReportPeriodForDate(client.reporting_frequency, scheduledDate);
      if (!period) continue;

      const { data: logs, error: logsError } = await supabase
        .from('email_scheduler_logs')
        .select('email_sent,error_message,created_at,email_sent_at')
        .eq('client_id', client.id)
        .eq('operation_type', 'scheduled')
        .eq('report_period_start', period.start)
        .eq('report_period_end', period.end)
        .order('created_at', { ascending: false });

      if (logsError) {
        issues.push({
          clientId: client.id,
          clientName: client.name,
          scheduledDate: scheduledDateKey,
          period,
          status: 'failed',
          errorMessages: [`Failed to inspect scheduler logs: ${logsError.message}`]
        });
        continue;
      }

      const successLog = logs?.find(log => log.email_sent);
      if (successLog) continue;

      const failedMessages = (logs || [])
        .map(log => log.error_message)
        .filter((message): message is string => Boolean(message));

      issues.push({
        clientId: client.id,
        clientName: client.name,
        scheduledDate: scheduledDateKey,
        period,
        status: failedMessages.length > 0 ? 'failed' : 'missing',
        errorMessages: failedMessages
      });
    }
  }

  return issues;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const lookbackDaysParam = Number(request.nextUrl.searchParams.get('lookbackDays') || '2');
    const lookbackDays = Number.isFinite(lookbackDaysParam)
      ? Math.max(0, Math.min(lookbackDaysParam, 14))
      : 2;

    const issues = await collectIssues(lookbackDays);
    await sendAlert(issues);

    return NextResponse.json({
      success: true,
      issueCount: issues.length,
      alerted: issues.length > 0,
      issues,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scheduled report monitor failed', { error: message });

    return NextResponse.json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
