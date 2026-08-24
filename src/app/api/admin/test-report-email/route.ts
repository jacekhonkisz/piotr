import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_CONFIG, isReviewMode } from '../../../../lib/email-config';
import { normalizeReviewRecipientsOverride } from '../../../../lib/email-recipients';
import FlexibleEmailService from '../../../../lib/flexible-email';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest): Promise<{ userId: string; token: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? { userId: user.id, token } : null;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, includePdf = true, testRecipient, testRecipients } = body;
    const internalTestRecipients = normalizeReviewRecipientsOverride(testRecipients ?? testRecipient);
    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'clientId is required for 1:1 test send (same as production pipeline)'
      }, { status: 400 });
    }

    if (!includePdf) {
      return NextResponse.json({
        success: false,
        error: 'includePdf must be true for 1:1 test send'
      }, { status: 400 });
    }

    const reviewMode = await isReviewMode();

    const { data: client } = await supabase
      .from('clients')
      .select('name, email, admin_id')
      .eq('id', clientId)
      .eq('admin_id', admin.userId)
      .single();

    if (!client) {
      return NextResponse.json({
        success: false,
        error: 'Client not found or access denied'
      }, { status: 404 });
    }

    // Same-origin: avoids misconfigured NEXT_PUBLIC_APP_URL breaking server→server fetch on Vercel.
    const appOrigin = request.nextUrl.origin;
    const sendResponse = await fetch(`${appOrigin}/api/send-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin.token}`
      },
      body: JSON.stringify({
        clientId,
        includePdf: true,
        reviewRecipientsOverride: internalTestRecipients
      })
    });

    const sendPayload = await sendResponse.json().catch(() => ({}));
    const sendSucceeded = sendResponse.ok && sendPayload.success === true;

    // The provider-level reason (e.g. Resend rejecting an unverified sender)
    // lives in `details`; without it the admin only sees a generic failure.
    const failedRecipients = Array.isArray(sendPayload.details?.failed) ? sendPayload.details.failed : [];
    const upstreamDetails =
      typeof sendPayload.details === 'string'
        ? sendPayload.details
        : failedRecipients.length > 0
          ? failedRecipients.map((entry: any) => `${entry.email}: ${entry.error}`).join('; ')
          : null;

    const upstreamErrorMessage = sendSucceeded
      ? null
      : [
          typeof sendPayload.error === 'string' ? sendPayload.error : `Send pipeline failed (HTTP ${sendResponse.status})`,
          upstreamDetails
        ]
          .filter(Boolean)
          .join(' — ');

    const readiness = FlexibleEmailService.getInstance().getProviderReadiness(client.email || '');

    return NextResponse.json({
      success: sendSucceeded,
      error: upstreamErrorMessage,
      errorDetails: upstreamDetails,
      configBlockers: readiness.blockers,
      provider: readiness.provider,
      fromAddress: readiness.fromAddress,
      reviewMode,
      redirectedTo: null,
      pdfIncluded: true,
      pdfSize: sendPayload.pdfSize || 0,
      pdfError: sendPayload.pdfError ?? null,
      clientName: client.name,
      clientEmail: client.email,
      internalTestRecipients: internalTestRecipients || null,
      attemptedRecipients: sendPayload.details?.successful || [],
      sentTo: Array.isArray(sendPayload.details?.successful) && sendPayload.details.successful.length > 0
        ? sendPayload.details.successful.join(', ')
        : (reviewMode
          ? (internalTestRecipients?.join(', ') || EMAIL_CONFIG.REVIEW_RECIPIENTS.join(', '))
          : client.email),
      upstream: sendPayload
    }, { status: sendSucceeded ? 200 : sendResponse.status });

  } catch (err) {
    console.error('Test report email error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
