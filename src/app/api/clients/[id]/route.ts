import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../../lib/meta-api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to verify user permissions' }, { status: 500 });
    }

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the client data
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('admin_id', user.id)
      .single();

    if (fetchError || !client) {
      console.error('Error fetching client:', fetchError);
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(client);

  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    console.log('User authenticated:', user.email, 'ID:', user.id);

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to verify user permissions' }, { status: 500 });
    }

    if (profile?.role !== 'admin') {
      console.log('Access denied for user:', user.email, 'Role:', profile?.role);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('Admin access confirmed for user:', user.email);

    // Get the client to update
    const { data: existingClient, error: fetchError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('admin_id', user.id)
      .single();

    if (fetchError || !existingClient) {
      console.error('Error fetching client:', fetchError);
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    console.log('Client found:', existingClient.name);

    // Parse request body
    const requestData = await request.json();
    console.log('Updating client with data:', {
      name: requestData.name,
      email: requestData.email,
      contact_emails: requestData.contact_emails
    });

    // Prepare updates object
    const updates: any = {};

    // Update basic fields if provided
    if (requestData.name !== undefined) updates.name = requestData.name;
    if (requestData.email !== undefined) updates.email = requestData.email;
    if (requestData.company !== undefined) updates.company = requestData.company;
    if (requestData.ad_account_id !== undefined) updates.ad_account_id = requestData.ad_account_id;
    if (requestData.reporting_frequency !== undefined) updates.reporting_frequency = requestData.reporting_frequency;
    if (requestData.notes !== undefined) updates.notes = requestData.notes;
    if (requestData.contact_emails !== undefined) updates.contact_emails = requestData.contact_emails;

    // Handle token update if provided
    let tokenValidation: any = null;
    if (requestData.meta_access_token) {
      console.log('🔐 Validating and converting new Meta access token...');
      const metaService = new MetaAPIService(requestData.meta_access_token);
      tokenValidation = await metaService.validateAndConvertToken();

      if (!tokenValidation.valid) {
        return NextResponse.json({ 
          error: `Meta API token validation failed: ${tokenValidation.error}` 
        }, { status: 400 });
      }

      // Use the converted long-lived token if available
      const finalToken = tokenValidation.convertedToken || requestData.meta_access_token;
      
      if (tokenValidation.convertedToken) {
        console.log('✅ Token successfully converted to long-lived token');
      } else {
        console.log('ℹ️ Token appears to already be long-lived or conversion not needed');
      }

      // Validate the specific ad account ID with the final token
      const accountValidation = await metaService.validateAdAccount(
        requestData.ad_account_id || existingClient.ad_account_id
      );
      
      if (!accountValidation.valid) {
        return NextResponse.json({ 
          error: `Ad account validation failed: ${accountValidation.error}` 
        }, { status: 400 });
      }

      console.log('✅ Ad account validation successful');

      // Update token-related fields
      updates.meta_access_token = finalToken;
      updates.token_expires_at = tokenValidation.expiresAt?.toISOString() || null;
      updates.token_refresh_count = (existingClient.token_refresh_count || 0) + (tokenValidation.convertedToken ? 1 : 0);
      updates.last_token_validation = new Date().toISOString();
      updates.token_health_status = tokenValidation.isLongLived ? 'valid' : 
        (tokenValidation.expiresAt && tokenValidation.expiresAt > new Date()) ? 'valid' : 'expired';
      updates.api_status = 'valid';
    }

    // If email is being changed, check for conflicts
    if (requestData.email && requestData.email !== existingClient.email) {
      const { data: emailConflict } = await supabase
        .from('clients')
        .select('id')
        .eq('admin_id', user.id)
        .eq('email', requestData.email)
        .neq('id', params.id)
        .single();

      if (emailConflict) {
        return NextResponse.json({ 
          error: `A client with email ${requestData.email} already exists` 
        }, { status: 400 });
      }
    }

    // Update the client
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return NextResponse.json({ 
        error: `Failed to update client: ${updateError.message}` 
      }, { status: 500 });
    }

    console.log('✅ Client updated successfully:', updatedClient.id);

    return NextResponse.json({
      success: true,
      client: updatedClient,
      tokenInfo: requestData.meta_access_token ? {
        converted: !!tokenValidation?.convertedToken,
        isLongLived: tokenValidation?.isLongLived
      } : undefined
    });

  } catch (error) {
    console.error('Error in client update API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('DELETE request received for client ID:', params.id);
  
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Unauthorized: Missing or invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('Token received, length:', token.length);

    // Verify the current user
    console.log('Verifying user token...');
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.log('Invalid token:', authError?.message || 'No user found');
      console.log('Auth error details:', authError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    console.log('User verified:', user.email);
    console.log('User ID from token:', user.id);

    // Get user profile to check if admin
    console.log('Checking user profile for admin role...');
    console.log('User ID from token:', user.id);
    console.log('User email from token:', user.email);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Profile query result:', { profile, error: profileError });

    if (profileError) {
      console.log('Profile error:', profileError.message);
      console.log('Profile error details:', profileError);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!profile) {
      console.log('No profile found for user');
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (profile.role !== 'admin') {
      console.log('User role is not admin:', profile.role);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Admin access confirmed for user:', user.email, 'with role:', profile.role);

    // Get the client details
    console.log('Getting client details...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', params.id)
      .eq('admin_id', user.id) // Ensure admin owns this client
      .single();

    if (clientError || !client) {
      console.log('Client not found:', clientError?.message || 'No client data');
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    console.log('Client found:', client.name, client.email);

    // Try to find and delete the associated user from auth
    // We need to search by email since that's how we link them
    try {
      console.log('Searching for user in auth to delete...');
      
      // Use a timeout for the auth operations to prevent hanging
      const authPromise = supabase.auth.admin.listUsers();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth operation timeout')), 10000)
      );
      
      const { data: authUsers, error: listUsersError } = await Promise.race([authPromise, timeoutPromise]) as any;
      
      if (listUsersError) {
        console.error('Error listing users:', listUsersError);
        // Continue with client deletion even if user listing fails
      } else if (authUsers?.users) {
        const clientUser = authUsers.users.find((u: any) => u.email === client.email);
        if (clientUser) {
          console.log(`Found user in auth: ${clientUser.email}, attempting to delete...`);
          
          // Use timeout for user deletion as well
          const deletePromise = supabase.auth.admin.deleteUser(clientUser.id);
          const deleteTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('User deletion timeout')), 10000)
          );
          
          const { error: deleteUserError } = await Promise.race([deletePromise, deleteTimeoutPromise]) as any;
          
          if (deleteUserError) {
            console.error('Error deleting user from auth:', deleteUserError);
            // Continue with client deletion even if user deletion fails
          } else {
            console.log(`Successfully deleted user ${clientUser.email} from auth`);
          }
        } else {
          console.log(`No auth user found for email: ${client.email}`);
        }
      }
    } catch (error) {
      console.error('Error in auth user deletion process:', error);
      // Continue with client deletion even if user search fails
    }

    // Delete the client record
    console.log('Deleting client record from database...');
    const { error: deleteClientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', params.id);

    if (deleteClientError) {
      console.error('Error deleting client record:', deleteClientError);
      throw deleteClientError;
    }

    console.log('Client record deleted successfully');
    return NextResponse.json({ 
      success: true, 
      message: `Client ${client.name} (${client.email}) deleted successfully` 
    });

  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' }, 
      { status: 500 }
    );
  }
} 