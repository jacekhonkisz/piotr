import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../../../lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    // Await params before using
    const { id } = await params;
    // Verify admin authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = authResult;
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('email, generated_username')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate new password
    const newPassword = generateSecurePassword();
    const username = client.generated_username || client.email;

    // Find the user in Supabase Auth by email
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json({ error: 'Failed to access user accounts' }, { status: 500 });
    }

    const userToUpdate = authUsers.users.find(u => u.email === client.email);
    
    if (!userToUpdate) {
      console.error('User not found in Supabase Auth:', client.email);
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userToUpdate.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password in Auth:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Update client record in database
    const { error: dbError } = await supabase
      .from('clients')
      .update({
        generated_password: newPassword,
        generated_username: username,
        credentials_generated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (dbError) {
      console.error('Error updating client record:', dbError);
      return NextResponse.json({ error: 'Failed to update client record' }, { status: 500 });
    }

    // Return the new password
    return NextResponse.json({
      password: newPassword,
      username: username,
      message: 'Password regenerated successfully'
    });

  } catch (error) {
    console.error('Error in regenerate password endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 