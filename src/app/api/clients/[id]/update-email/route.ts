import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../../../lib/auth-middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
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

    // Get request body
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get current client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('email')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check if email is already the same
    if (client.email === email) {
      return NextResponse.json({ 
        message: 'Email is already set to this value',
        email: email 
      });
    }

    // Find the user in Supabase Auth by current email
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

    // Check if new email already exists
    const existingUser = authUsers.users.find(u => u.email === email);
    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
    }

    // Update email in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userToUpdate.id,
      { email: email }
    );

    if (updateError) {
      console.error('Error updating email in Auth:', updateError);
      return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
    }

    // Update client record in database
    const { error: dbError } = await supabase
      .from('clients')
      .update({
        email: email,
        generated_username: email, // Update username to match new email
        credentials_generated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (dbError) {
      console.error('Error updating client record:', dbError);
      return NextResponse.json({ error: 'Failed to update client record' }, { status: 500 });
    }

    // Return success response
    return NextResponse.json({
      email: email,
      message: 'Email updated successfully'
    });

  } catch (error) {
    console.error('Error in update email endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 