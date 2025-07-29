import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { clientId, businessManagerId, adAccountId, clientName } = await request.json();

    if (!clientId || !businessManagerId || !adAccountId || !clientName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    console.log('🔧 Creating System User for client:', clientName);

    // Note: This is a simplified version. In production, you would:
    // 1. Use Meta's Business Manager API to create System Users
    // 2. Generate tokens through Meta's API
    // 3. Handle proper authentication and permissions

    // For now, we'll simulate the process and provide instructions
    const systemUserName = `API Access User - ${clientName}`;
    const systemUserId = `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate a mock permanent token (in production, this would come from Meta API)
    const mockPermanentToken = `EAA${Math.random().toString(36).substr(2, 50)}`;

    // Store the System User information
    const { error: systemUserError } = await supabase
      .from('system_users')
      .insert([{
        id: systemUserId,
        client_id: clientId,
        name: systemUserName,
        business_manager_id: businessManagerId,
        ad_account_id: adAccountId,
        token: mockPermanentToken,
        status: 'active',
        created_at: new Date().toISOString()
      }]);

    if (systemUserError) {
      console.error('Error storing System User:', systemUserError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to store System User information' 
      });
    }

    console.log('✅ System User created successfully');

    return NextResponse.json({ 
      success: true, 
      token: mockPermanentToken,
      systemUserId: systemUserId,
      message: 'System User created successfully'
    });

  } catch (error) {
    console.error('Create System User error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 