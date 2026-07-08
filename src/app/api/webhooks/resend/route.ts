import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';

/**
 * RESEND WEBHOOK HANDLER
 *
 * Receives Resend delivery events (delivered / bounced / complained / ...) and
 * updates the matching `email_logs` row(s) by provider message id so the admin
 * Email Logs view reflects real delivery status instead of just "sent".
 *
 * Security: Resend signs webhooks with Svix. We verify the `svix-*` headers
 * against RESEND_WEBHOOK_SECRET (HMAC-SHA256) manually to avoid an extra
 * dependency. Fails closed in production when the secret is missing.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Svix tolerates a 5-minute clock skew for replay protection.
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Svix-signed payload. Returns true when at least one provided
 * signature matches the expected HMAC.
 */
function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  body: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, body } = params;

  // Replay protection: reject stale timestamps.
  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  // Secret format: "whsec_<base64>". Strip the prefix before decoding.
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const key = Buffer.from(secretKey, 'base64');

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // Header is a space-delimited list of "v1,<signature>" pairs.
  return svixSignature
    .split(' ')
    .map((part) => part.split(',')[1] || part)
    .some((sig) => timingSafeEqualStr(sig, expected));
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  // Raw body is required for signature verification.
  const body = await request.text();

  if (secret) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      logger.warn('🚫 Resend webhook missing Svix headers');
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }
    const valid = verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body });
    if (!valid) {
      logger.warn('🚫 Resend webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('🚫 RESEND_WEBHOOK_SECRET not configured in production - rejecting webhook');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  } else {
    logger.warn('⚠️ RESEND_WEBHOOK_SECRET not set - accepting webhook in development only');
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type: string = event?.type || '';
  const emailId: string | undefined = event?.data?.email_id || event?.data?.id;

  if (!emailId) {
    logger.info('Resend webhook received without email id, ignoring', { type });
    return NextResponse.json({ received: true });
  }

  // Map Resend event types to our email_status enum.
  let status: 'sent' | 'delivered' | 'failed' | 'bounced' | null = null;
  const update: Record<string, unknown> = {};

  switch (type) {
    case 'email.delivered':
      status = 'delivered';
      update.delivered_at = new Date().toISOString();
      break;
    case 'email.bounced':
      status = 'bounced';
      update.error_message = event?.data?.bounce?.message || 'Bounced';
      break;
    case 'email.complained':
      status = 'bounced';
      update.error_message = 'Spam complaint';
      break;
    case 'email.delivery_delayed':
      // Transient; do not overwrite a terminal status.
      logger.info('Resend delivery delayed', { emailId });
      return NextResponse.json({ received: true });
    case 'email.sent':
      status = 'sent';
      break;
    default:
      // opened/clicked and unknown types are not persisted here.
      return NextResponse.json({ received: true });
  }

  if (status) update.status = status;

  const { error } = await supabase
    .from('email_logs')
    .update(update)
    .eq('message_id', emailId);

  if (error) {
    logger.error('Failed to update email_logs from Resend webhook', {
      emailId,
      type,
      error: error.message
    });
    // 200 so Resend does not retry indefinitely on our persistence issues.
    return NextResponse.json({ received: true, persisted: false });
  }

  logger.info('✅ Updated email_logs from Resend webhook', { emailId, type, status });
  return NextResponse.json({ received: true, persisted: true });
}
