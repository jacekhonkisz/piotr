import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user profile to check if admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`Admin ${user.email} attempting to delete user: ${email}`);

    // List all users to find the one with the specified email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
    }

    const targetUser = users.users.find(u => u.email === email);
    
    if (!targetUser) {
      return NextResponse.json({ 
        error: `User with email ${email} not found` 
      }, { status: 404 });
    }

    // Check if this is the current admin user (prevent self-deletion)
    if (targetUser.id === user.id) {
      return NextResponse.json({ 
        error: 'Cannot delete your own account' 
      }, { status: 400 });
    }

    // Delete the user from Supabase auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ 
        error: `Failed to delete user: ${deleteError.message}` 
      }, { status: 500 });
    }

    // Also delete any associated client records
    const { error: clientDeleteError } = await supabase
      .from('clients')
      .delete()
      .eq('email', email);

    if (clientDeleteError) {
      console.error('Error deleting client records:', clientDeleteError);
      // Don't fail the request if client deletion fails
    }

    console.log(`Successfully deleted user: ${email} (ID: ${targetUser.id})`);

    return NextResponse.json({
      success: true,
      message: `User ${email} deleted successfully`,
      details: {
        deletedUserId: targetUser.id,
        deletedUserEmail: email,
        deletedBy: user.email,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in delete user API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 