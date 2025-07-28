import { NextRequest, NextResponse } from 'next/server';
import { MetaAPIService } from '../../../lib/meta-api';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, adAccountId } = await request.json();

    if (!accessToken || !adAccountId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: accessToken and adAccountId' 
      }, { status: 400 });
    }

    const metaService = new MetaAPIService(accessToken);
    const results: any = {};

    // Test 1: Basic token validation
    console.log('Testing basic token validation...');
    results.tokenValidation = await metaService.validateToken();
    console.log('Token validation result:', results.tokenValidation);

    // Test 2: Ad account validation
    console.log('Testing ad account validation...');
    results.accountValidation = await metaService.validateAdAccount(adAccountId);
    console.log('Account validation result:', results.accountValidation);

    // Test 3: Get ad accounts list
    console.log('Testing ad accounts list...');
    try {
      results.adAccounts = await metaService.getAdAccounts();
      console.log('Ad accounts result:', results.adAccounts);
    } catch (error) {
      results.adAccountsError = error instanceof Error ? error.message : String(error);
      console.log('Ad accounts error:', error);
    }

    // Test 4: Get campaigns
    console.log('Testing campaigns access...');
    try {
      const cleanAccountId = adAccountId.replace('act_', '');
      results.campaigns = await metaService.getCampaigns(cleanAccountId);
      console.log('Campaigns result:', results.campaigns);
    } catch (error) {
      results.campaignsError = error instanceof Error ? error.message : String(error);
      console.log('Campaigns error:', error);
    }

    // Test 5: Raw API call to see exact error
    console.log('Testing raw API call...');
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`
      );
      
      results.rawApiCall = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      };
      
      console.log('Raw API call result:', results.rawApiCall);
    } catch (error) {
      results.rawApiCallError = error instanceof Error ? error.message : String(error);
      console.log('Raw API call error:', error);
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 