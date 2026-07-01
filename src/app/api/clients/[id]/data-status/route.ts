import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../../lib/logger';
import { getClientDataStatus, initializeClientData } from '../../../../../lib/client-data-initializer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authorizeAdminForClient(request: NextRequest, clientId: string) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
  if (userAuthError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  // Ensure the client belongs to this admin.
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('admin_id', user.id)
    .single();

  if (clientError || !client) {
    return { error: NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 }) };
  }

  return { user };
}

/**
 * GET /api/clients/[id]/data-status
 * Returns the portal data readiness + live initialization progress for a client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeAdminForClient(request, id);
    if (auth.error) return auth.error;

    const status = await getClientDataStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    logger.error('Error in client data-status GET:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/clients/[id]/data-status
 * (Re)triggers portal data initialization for a client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeAdminForClient(request, id);
    if (auth.error) return auth.error;

    // Kick off without awaiting; the job registers synchronously so the
    // immediately-following status reflects "collecting".
    initializeClientData(id).catch(error => {
      logger.error(`Failed to (re)initialize portal data for ${id}:`, error);
    });

    const status = await getClientDataStatus(id);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    logger.error('Error in client data-status POST:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
