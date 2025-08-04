import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🔄 /api/fetch-meta-tables called');
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header');
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
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

    const { dateStart, dateEnd, clientId } = await request.json();
    console.log('📅 Request data received:', { dateStart, dateEnd, clientId });

    if (!dateStart || !dateEnd) {
      console.log('❌ Missing date range');
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', jwtUser.id)
      .single();

    console.log('👤 User profile:', profile);

    let client;

    if (profile?.role === 'admin') {
      // Admin can access any client's data
      if (clientId) {
        // Admin specified a specific client
        console.log('👨‍💼 Admin accessing client:', clientId);
        const { data: adminClient, error: adminClientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();
          
        if (adminClientError || !adminClient) {
          console.log('❌ Client not found for admin:', adminClientError);
          return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }
        client = adminClient;
      } else {
        console.log('❌ Admin must specify clientId');
        return NextResponse.json({ error: 'Client ID required for admin access' }, { status: 400 });
      }
    } else if (profile?.role === 'client') {
      // Client can only access their own data
      console.log('🔍 Looking for client with email:', jwtUser.email);
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', jwtUser.email)
        .single();

      if (clientError || !clientData) {
        console.log('❌ Client not found:', clientError);
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      client = clientData;
    } else {
      console.log('❌ Invalid user role');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('✅ Client found:', { id: client.id, email: client.email, hasToken: !!client.meta_access_token });

    if (!client.meta_access_token) {
      console.log('❌ No Meta token available for client');
      return NextResponse.json({ error: 'No Meta token available' }, { status: 400 });
    }

    // Initialize Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);

    // Fetch all three tables data with individual error handling
    let placementData: any[] = [];
    let demographicData: any[] = [];
    let adRelevanceData: any[] = [];

    try {
      placementData = await metaService.getPlacementPerformance(client.ad_account_id, dateStart, dateEnd);
      console.log('✅ Placement data fetched successfully:', placementData.length, 'records');
    } catch (error) {
      console.log('⚠️ Placement data fetch failed:', error instanceof Error ? error.message : String(error));
    }

    try {
      demographicData = await metaService.getDemographicPerformance(client.ad_account_id, dateStart, dateEnd);
      console.log('✅ Demographic data fetched successfully:', demographicData.length, 'records');
    } catch (error) {
      console.log('⚠️ Demographic data fetch failed:', error instanceof Error ? error.message : String(error));
    }

    try {
      adRelevanceData = await metaService.getAdRelevanceResults(client.ad_account_id, dateStart, dateEnd);
      console.log('✅ Ad relevance data fetched successfully:', adRelevanceData.length, 'records');
    } catch (error) {
      console.log('⚠️ Ad relevance data fetch failed:', error instanceof Error ? error.message : String(error));
    }

    return NextResponse.json({
      success: true,
      data: {
        placementPerformance: placementData,
        demographicPerformance: demographicData,
        adRelevanceResults: adRelevanceData
      }
    });

  } catch (error) {
    console.error('Error fetching Meta tables data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Meta tables data' },
      { status: 500 }
    );
  }
} 