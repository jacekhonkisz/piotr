import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { supabase, supabaseAdmin as supabaseAdminClient } from '../../../../lib/supabase';

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

    // Get user profile to check if admin using admin client to bypass RLS
    console.log('Checking user profile for admin role...');
    console.log('User ID from token:', user.id);
    console.log('User email from token:', user.email);
    
    if (!supabaseAdminClient) {
      console.log('Admin client not available');
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 });
    }
    
    const { data: profile, error: profileError } = await supabaseAdminClient
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

    // Get the client details using admin client to bypass RLS
    console.log('Getting client details...');
    const { data: client, error: clientError } = await supabaseAdminClient
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
      const authPromise = supabaseAdmin.auth.admin.listUsers();
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
          const deletePromise = supabaseAdmin.auth.admin.deleteUser(clientUser.id);
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

    // Delete the client record using admin client to bypass RLS
    console.log('Deleting client record from database...');
    const { error: deleteClientError } = await supabaseAdminClient
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