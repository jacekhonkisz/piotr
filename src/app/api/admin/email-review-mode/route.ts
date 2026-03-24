import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isReviewMode, setReviewMode, EMAIL_CONFIG } from '../../../../lib/email-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.substring(7));
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user.id : null;
}

export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const enabled = await isReviewMode();
  const hasCustomSmtp = !!(process.env.CUSTOM_SMTP_HOST && process.env.CUSTOM_SMTP_USER);
  const smtpUser = process.env.CUSTOM_SMTP_USER || null;

  return NextResponse.json({
    reviewMode: enabled,
    reviewEmail: EMAIL_CONFIG.REVIEW_EMAIL,
    hasCustomSmtp,
    smtpUser,
    provider: process.env.EMAIL_PROVIDER || 'auto'
  });
}

export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { enabled } = await request.json();
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const success = await setReviewMode(enabled);
    if (!success) {
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reviewMode: enabled,
      reviewEmail: EMAIL_CONFIG.REVIEW_EMAIL,
      message: enabled
        ? `Tryb weryfikacji WŁĄCZONY — wszystkie raporty trafiają do ${EMAIL_CONFIG.REVIEW_EMAIL}`
        : 'Tryb weryfikacji WYŁĄCZONY — raporty trafiają bezpośrednio do klientów'
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
