import { NextRequest, NextResponse } from 'next/server';
import { MetaAPIService } from '../../../lib/meta-api-optimized';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Token is required' 
      });
    }

    const metaService = new MetaAPIService(token);

    try {
      // First validate the token
      const tokenValidation = await metaService.validateToken();
      
      if (!tokenValidation.valid) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid token' 
        });
      }

      // Get available ad accounts
      const adAccounts = await metaService.getAdAccounts();
      
      return NextResponse.json({ 
        success: true, 
        adAccounts: adAccounts,
        message: `Found ${adAccounts.length} ad accounts`
      });
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        error: `Error fetching ad accounts: ${(error as any).message}` 
      });
    }
  } catch (error) {
    console.error('Get ad accounts error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 