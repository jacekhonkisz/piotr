const { createClient } = require('@supabase/supabase-js');

// Use the same configuration as the project
const supabaseUrl = 'https://xbklptrrfdspyvnjaojf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2oiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMjY5NzI5MCwiZXhwIjoyMDQ4Mjc1MjkwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMetaAPI() {
  console.log('🔍 Testing Meta API step by step...\n');

  try {
    // Step 1: Get client data
    console.log('1. Getting client data...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError) {
      console.error('❌ Error getting client:', clientError);
      return;
    }

    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
    });

    // Step 2: Test the debug API endpoint
    console.log('\n2. Testing debug API endpoint...');
    
    const response = await fetch('http://localhost:3006/api/debug-meta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: client.id
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Debug API response:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

testMetaAPI(); 