import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../../../lib/meta-api-optimized';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    // Await params before using
    const { id } = await params;
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token and get user
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('Token verification failed:', userAuthError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const clientId = id;

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('admin_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    console.log(`🔄 Refreshing token for client: ${client.name}`);

    // Validate and convert the current token
    const metaService = new MetaAPIService(client.meta_access_token);
    const tokenValidation = await metaService.validateAndConvertToken();

    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: `Token validation failed: ${tokenValidation.error}` 
      }, { status: 400 });
    }

    // Use the converted long-lived token if available
    const finalToken = tokenValidation.convertedToken || client.meta_access_token;
    
    // Update client record with new token information
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        meta_access_token: finalToken,
        token_expires_at: tokenValidation.expiresAt?.toISOString() || null,
        token_refresh_count: (client.token_refresh_count || 0) + (tokenValidation.convertedToken ? 1 : 0),
        last_token_validation: new Date().toISOString(),
        token_health_status: tokenValidation.isLongLived ? 'valid' : 
          (tokenValidation.expiresAt && tokenValidation.expiresAt > new Date()) ? 'valid' : 'expired',
        api_status: 'valid'
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error updating client token:', updateError);
      return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
    }

    console.log(`✅ Token refreshed successfully for client: ${client.name}`);

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      tokenInfo: {
        converted: !!tokenValidation.convertedToken,
        isLongLived: tokenValidation.isLongLived,
        expiresAt: tokenValidation.expiresAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('Error in token refresh API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 