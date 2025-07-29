import { NextRequest, NextResponse } from 'next/server';
import { MetaAPIService } from '../../../lib/meta-api';

export async function POST(request: NextRequest) {
  try {
    const { token, adAccountId } = await request.json();

    if (!token) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Token is required' 
      });
    }

    const metaService = new MetaAPIService(token);

    // Test basic token validation
    try {
      const userInfo = await metaService.validateToken();
      
      if (!userInfo.valid) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Invalid token' 
        });
      }

      // If no ad account specified, just return token validation result
      if (!adAccountId) {
        return NextResponse.json({ 
          valid: true, 
          message: 'Token is valid'
        });
      }

      // Test ad account access
      try {
        const adAccountInfo = await metaService.validateAdAccount(adAccountId);
        
        if (!adAccountInfo.valid) {
          return NextResponse.json({ 
            valid: false, 
            error: `Cannot access ad account ${adAccountId}` 
          });
        }

        // Test campaigns access
        try {
          const campaigns = await metaService.getCampaigns(adAccountId);
          
          return NextResponse.json({ 
            valid: true, 
            adAccount: adAccountInfo,
            campaigns: campaigns,
            message: `Successfully connected to ad account ${adAccountId}`
          });
        } catch (campaignError) {
          return NextResponse.json({ 
            valid: false, 
            error: `Cannot access campaigns: ${(campaignError as any).message}` 
          });
        }
      } catch (adAccountError) {
        return NextResponse.json({ 
          valid: false, 
          error: `Ad account error: ${(adAccountError as any).message}` 
        });
      }
    } catch (tokenError) {
      return NextResponse.json({ 
        valid: false, 
        error: `Token validation error: ${(tokenError as any).message}` 
      });
    }
  } catch (error) {
    console.error('Meta validation error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 