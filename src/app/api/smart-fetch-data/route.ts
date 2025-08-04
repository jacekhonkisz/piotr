import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SmartDataLoader } from '../../../lib/smart-data-loader';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🚀 Smart data fetch request started');
  
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a client with the JWT token
    const jwtClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Get user from the JWT token
    const { data: { user: jwtUser }, error: authError } = await jwtClient.auth.getUser();
    
    if (authError || !jwtUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { clientId, dateRange } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Missing required parameters: clientId and dateRange' }, { status: 400 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', jwtUser.id)
      .single();

    if (!profile || (profile.role !== 'client' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate client access
    let targetClientId = clientId;
    
    if (profile.role === 'client') {
      // Client can only access their own data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', jwtUser.email)
        .single();

      if (clientError || !clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      
      targetClientId = clientData.id;
    } else if (profile.role === 'admin') {
      // Admin can access any client, but we need to validate the clientId
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
    }

    console.log(`🔍 Smart data loading for client ${targetClientId}:`, {
      dateRange,
      userRole: profile.role,
      userEmail: jwtUser.email
    });

    // Use smart data loader
    const smartLoader = SmartDataLoader.getInstance();
    const result = await smartLoader.loadData(targetClientId, dateRange);

    // Get data source indicator for UI
    const dataSourceIndicator = smartLoader.getDataSourceIndicator(result);

    console.log(`✅ Smart data loading completed:`, {
      source: result.source,
      isHistorical: result.isHistorical,
      dataAge: result.dataAge
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        source: result.source,
        lastUpdated: result.lastUpdated,
        isHistorical: result.isHistorical,
        dataAge: result.dataAge,
        indicator: dataSourceIndicator
      }
    });

  } catch (error) {
    console.error('❌ Error in smart data fetch:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 