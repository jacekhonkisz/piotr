require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGenerateReport() {
  try {
    console.log('🔍 Testing Generate Report API...');
    
    // First, let's get a valid client and user
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);
    
    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientsError);
      return;
    }
    
    const client = clients[0];
    console.log('📋 Found client:', {
      id: client.id,
      name: client.name,
      email: client.email,
      has_token: !!client.meta_access_token,
      ad_account_id: client.ad_account_id
    });
    
    // Get a user (admin) to test with
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ No admin users found:', usersError);
      return;
    }
    
    const user = users[0];
    console.log('👤 Found admin user:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Create a session token for the user
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: 'password123' // Default admin password
    });
    
    if (sessionError || !session) {
      console.error('❌ Failed to create session:', sessionError);
      return;
    }
    
    console.log('🔑 Created session with token');
    
    // Test the generate-report API
    const response = await fetch('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      })
    });
    
    console.log('📡 API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
    } else {
      const data = await response.json();
      console.log('✅ API Success:', data);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testGenerateReport(); 