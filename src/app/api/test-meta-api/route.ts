import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  console.log('🧪 Testing Meta API connectivity...');
  
  try {
    // Check environment variables
    const envCheck = {
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasMetaAppId: !!process.env.META_APP_ID,
      hasMetaAppSecret: !!process.env.META_APP_SECRET,
    };
    
    console.log('🔧 Environment check:', envCheck);
    
    // Test basic fetch to Meta API
    const testUrl = 'https://graph.facebook.com/v18.0/me?access_token=test';
    console.log('🔗 Testing fetch to:', testUrl);
    
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Fetch response status:', response.status);
      const data = await response.json();
      console.log('📡 Fetch response data:', data);
      
      return NextResponse.json({
        success: true,
        envCheck,
        fetchTest: {
          status: response.status,
          data: data,
          canConnect: true
        }
      });
      
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        envCheck,
        fetchTest: {
          error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
          canConnect: false
        }
      });
    }
    
  } catch (error) {
    console.error('💥 Error in test endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 