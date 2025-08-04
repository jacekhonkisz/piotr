import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  console.log('🔍 Debug Meta API endpoint called');
  
  try {
    const body = await request.json();
    const { clientId } = body;
    
    console.log('📋 Debug request:', { clientId });
    
    // Step 1: Get client data
    console.log('🔍 Step 1: Getting client data...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return NextResponse.json({ 
        error: 'Client not found',
        step: 'client_lookup',
        details: clientError 
      }, { status: 404 });
    }
    
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
    });
    
    // Step 2: Initialize Meta API service
    console.log('🔍 Step 2: Initializing Meta API service...');
    const metaService = new MetaAPIService(client.meta_access_token);
    
    // Step 3: Validate token
    console.log('🔍 Step 3: Validating Meta API token...');
    console.log('🔑 Token length:', client.meta_access_token?.length || 0);
    console.log('🔑 Token preview:', client.meta_access_token?.substring(0, 20) + '...');
    
    const tokenValidation = await metaService.validateToken();
    console.log('🔐 Token validation result:', tokenValidation);
    
    if (!tokenValidation.valid) {
      console.log('❌ Token validation failed:', tokenValidation.error);
      return NextResponse.json({
        error: 'Invalid Meta API token',
        step: 'token_validation',
        details: tokenValidation.error
      }, { status: 400 });
    }
    
    console.log('✅ Token validation successful');
    
    // Step 4: Get token info
    console.log('🔍 Step 4: Getting token info...');
    const tokenInfo = await metaService.getTokenInfo();
    console.log('🔐 Token info:', tokenInfo);
    
    // Step 5: Validate ad account
    console.log('🔍 Step 5: Validating ad account...');
    console.log('🏢 Ad account ID:', client.ad_account_id);
    const adAccountValidation = await metaService.validateAdAccount(client.ad_account_id);
    console.log('🏢 Ad account validation:', adAccountValidation);
    
    if (!adAccountValidation.valid) {
      console.log('❌ Ad account validation failed:', adAccountValidation.error);
      return NextResponse.json({
        error: 'Invalid ad account',
        step: 'ad_account_validation',
        details: adAccountValidation.error
      }, { status: 400 });
    }
    
    console.log('✅ Ad account validation successful');
    
    // Step 6: Try to get campaigns
    console.log('🔍 Step 6: Getting campaigns...');
    const campaigns = await metaService.getCampaigns(client.ad_account_id);
    console.log('📊 Campaigns found:', campaigns.length);
    
    // Step 7: Try to get insights for August 2025
    console.log('🔍 Step 7: Getting insights for August 2025...');
    const insights = await metaService.getMonthlyCampaignInsights(
      client.ad_account_id,
      2025,
      8
    );
    console.log('📈 Insights found:', insights.length);
    
    return NextResponse.json({
      success: true,
      steps: {
        client_lookup: '✅ Success',
        token_validation: '✅ Success',
        token_info: tokenInfo.success ? '✅ Success' : '⚠️ Failed',
        ad_account_validation: '✅ Success',
        campaigns: `✅ Found ${campaigns.length} campaigns`,
        insights: `✅ Found ${insights.length} insights`
      },
      data: {
        client: {
          id: client.id,
          name: client.name,
          adAccountId: client.ad_account_id
        },
        tokenInfo: tokenInfo.info ? {
          scopes: tokenInfo.info.scopes,
          isLongLived: tokenInfo.isLongLived,
          expiresAt: tokenInfo.expiresAt
        } : null,
        campaigns: campaigns.length,
        insights: insights.length,
        sampleInsights: insights.slice(0, 3)
      }
    });
    
  } catch (error) {
    console.error('💥 Error in debug Meta API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      step: 'unknown',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 