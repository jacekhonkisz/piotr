import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../lib/logger';

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

    logger.info('🔧 Creating System User for client:', clientName);

    // Step 1: Create System User via Meta Business Manager API
    const systemUserName = `API Access User - ${clientName}`;
    
    try {
      // Note: This requires Business Manager access token with admin permissions
      // You'll need to implement this with proper Meta API calls
      
      // For now, we'll provide instructions for manual setup
      const setupInstructions = {
        manual: true,
        steps: [
          {
            step: 1,
            title: "Access Business Manager",
            description: `Go to https://business.facebook.com/ and access Business Manager ID: ${businessManagerId}`,
            url: "https://business.facebook.com/"
          },
          {
            step: 2,
            title: "Create System User",
            description: "Navigate to Business Settings → Users → System Users → Add → System User",
            details: `Name: ${systemUserName}, Role: Admin`
          },
          {
            step: 3,
            title: "Assign Ad Account",
            description: `Assign Ad Account ${adAccountId} to the System User with Admin role`
          },
          {
            step: 4,
            title: "Generate Token",
            description: "In System User settings, go to Access Tokens → Generate New Token",
            permissions: ["ads_read", "ads_management", "business_management", "read_insights"]
          }
        ]
      };

      // Store the setup instructions
      const { error: systemUserError } = await supabase
        .from('system_users')
        .insert([{
          client_id: clientId,
          name: systemUserName,
          business_manager_id: businessManagerId,
          ad_account_id: adAccountId,
          status: 'pending_setup',
          setup_instructions: setupInstructions,
          created_at: new Date().toISOString()
        }]);

      if (systemUserError) {
        console.error('Error storing System User:', systemUserError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to store System User information' 
        });
      }

      logger.info('✅ System User setup instructions created');

      return NextResponse.json({ 
        success: true, 
        manual: true,
        setupInstructions,
        message: 'System User setup instructions created. Manual setup required.',
        nextSteps: [
          'Follow the setup instructions to create the System User manually',
          'Generate a permanent token with required permissions',
          'Update the client with the generated token'
        ]
      });

    } catch (apiError) {
      console.error('Meta API error:', apiError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create System User via Meta API. Manual setup required.',
        manual: true
      });
    }

  } catch (error) {
    console.error('Create System User error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 