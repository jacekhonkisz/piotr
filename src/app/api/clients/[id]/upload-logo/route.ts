import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
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
      console.log('Access denied for user:', user.email, 'Role:', profile?.role);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the client exists and belongs to this admin
    const { data: existingClient, error: fetchError } = await supabase
      .from('clients')
      .select('id, name, logo_url')
      .eq('id', params.id)
      .eq('admin_id', user.id)
      .single();

    if (fetchError || !existingClient) {
      console.error('Error fetching client:', fetchError);
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('logo') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or SVG image.' 
      }, { status: 400 });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB.' 
      }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${params.id}/logo-${Date.now()}.${fileExt}`;

    // Delete old logo if exists
    if (existingClient.logo_url) {
      try {
        const oldPath = existingClient.logo_url.split('/client-logos/')[1];
        if (oldPath) {
          await supabase.storage
            .from('client-logos')
            .remove([oldPath]);
        }
      } catch (error) {
        console.warn('Could not delete old logo:', error);
        // Continue with upload anyway
      }
    }

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to upload file: ' + uploadError.message 
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('client-logos')
      .getPublicUrl(fileName);

    // Update client record with logo URL
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({ logo_url: publicUrl })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      // Try to clean up uploaded file
      await supabase.storage
        .from('client-logos')
        .remove([fileName]);
      return NextResponse.json({ 
        error: 'Failed to update client record: ' + updateError.message 
      }, { status: 500 });
    }

    console.log('✅ Logo uploaded successfully for client:', existingClient.name);

    return NextResponse.json({
      success: true,
      client: updatedClient,
      logo_url: publicUrl
    });

  } catch (error) {
    console.error('Error in logo upload API:', error);
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

    // Get the client and their current logo
    const { data: existingClient, error: fetchError } = await supabase
      .from('clients')
      .select('id, name, logo_url')
      .eq('id', params.id)
      .eq('admin_id', user.id)
      .single();

    if (fetchError || !existingClient) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Delete logo from storage if exists
    if (existingClient.logo_url) {
      try {
        const logoPath = existingClient.logo_url.split('/client-logos/')[1];
        if (logoPath) {
          await supabase.storage
            .from('client-logos')
            .remove([logoPath]);
        }
      } catch (error) {
        console.warn('Could not delete logo file:', error);
        // Continue with database update anyway
      }
    }

    // Update client record to remove logo URL
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({ logo_url: null })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update client record: ' + updateError.message 
      }, { status: 500 });
    }

    console.log('✅ Logo deleted successfully for client:', existingClient.name);

    return NextResponse.json({
      success: true,
      client: updatedClient
    });

  } catch (error) {
    console.error('Error in logo delete API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 