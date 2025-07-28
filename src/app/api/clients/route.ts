import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePassword, generateUsername } from '../../../lib/user-credentials';
import { MetaAPIService } from '../../../lib/meta-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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

    // Parse request body
    const requestData = await request.json();

    // Validate and convert Meta access token to long-lived token
    console.log('🔐 Validating and converting Meta access token...');
    const metaService = new MetaAPIService(requestData.meta_access_token);
    const tokenValidation = await metaService.validateAndConvertToken();

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
    console.log('🏢 Validating ad account access...');
    const accountValidation = await metaService.validateAdAccount(requestData.ad_account_id);
    
    if (!accountValidation.valid) {
      return NextResponse.json({ 
        error: `Ad account validation failed: ${accountValidation.error}` 
      }, { status: 400 });
    }

    console.log('✅ Ad account validation successful');

    // Check if user already exists in auth
    try {
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      if (!listError && existingUsers?.users) {
        const existingUser = existingUsers.users.find(u => u.email === requestData.email);
        if (existingUser) {
          return NextResponse.json({ 
            error: `A user with email ${requestData.email} already exists. Please use a different email or delete the existing user first.` 
          }, { status: 400 });
        }
      }
    } catch (error) {
      console.error('Error checking existing users:', error);
      // Continue with creation attempt
    }

    // Generate client credentials
    const generatedPassword = generatePassword();
    const generatedUsername = requestData.email; // Use email as username

    // Create client user account using service role
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: requestData.email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: requestData.name,
        company: requestData.company,
        role: 'client'
      }
    });

    if (createUserError || !authData.user) {
      console.error('Error creating user:', createUserError);
      
      // Provide more specific error message
      if (createUserError?.message?.includes('already been registered')) {
        return NextResponse.json({ 
          error: `A user with email ${requestData.email} already exists. Please use a different email or delete the existing user first.` 
        }, { status: 400 });
      }
      
      return NextResponse.json({ 
        error: `Failed to create user account: ${createUserError?.message || 'Unknown error'}` 
      }, { status: 400 });
    }

    // Check if profile already exists (Supabase might auto-create it)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (!existingProfile) {
      // Create profile for the new client user only if it doesn't exist
      const { error: newProfileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: requestData.email,
          full_name: requestData.name,
          role: 'client'
        });

      if (newProfileError) {
        console.error('Error creating profile:', newProfileError);
        // Try to clean up the created user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 400 });
      }
      console.log('Profile created successfully');
    } else {
      // Update existing profile with our data (likely auto-created by Supabase)
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          email: requestData.email,
          full_name: requestData.name,
          role: 'client'
        })
        .eq('id', authData.user.id);

      if (updateProfileError) {
        console.error('Error updating profile:', updateProfileError);
        // Try to clean up the created user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: 'Failed to update user profile' }, { status: 400 });
      }
      console.log('Profile updated successfully');
    }

    // Add client to clients table with the long-lived token
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: requestData.name,
        email: requestData.email,
        ad_account_id: requestData.ad_account_id,
        meta_access_token: finalToken, // Use the converted long-lived token
        admin_id: user.id,
        api_status: 'valid',
        company: requestData.company || null,
        reporting_frequency: requestData.reporting_frequency || 'monthly',
        notes: requestData.notes || null,
        generated_password: generatedPassword,
        generated_username: generatedUsername,
        credentials_generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating client record:', clientError);
      // Clean up created user and profile
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: 'Failed to create client record' }, { status: 400 });
    }

    console.log('✅ Client created successfully:', newClient.id);
    console.log(`📊 Ad Account: ${accountValidation.account?.name || requestData.ad_account_id}`);
    console.log(`🔑 Token Status: ${tokenValidation.convertedToken ? 'Converted to long-lived' : 'Already long-lived'}`);

    return NextResponse.json({
      success: true,
      client: newClient,
      credentials: {
        username: generatedUsername,
        password: generatedPassword
      },
      tokenInfo: {
        converted: !!tokenValidation.convertedToken,
        isLongLived: tokenValidation.isLongLived
      }
    });

  } catch (error) {
    console.error('Error in client creation API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 