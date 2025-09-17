const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupUsers() {
  console.log('🚀 Setting up demo users...\n');

  try {
    // Create admin user
    console.log('Creating admin user...');
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || (() => {
        console.error('❌ CRITICAL: ADMIN_PASSWORD not set! Using insecure default.');
        return 'password123';
      })(),
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin User',
        role: 'admin'
      }
    });

    if (adminError) {
      if (adminError.message.includes('already registered')) {
        console.log('✅ Admin user already exists');
      } else {
        throw adminError;
      }
    } else {
      console.log('✅ Admin user created successfully');
    }

    // Create client user
    console.log('Creating client user...');
    const { data: clientData, error: clientError } = await supabase.auth.admin.createUser({
      email: 'client@example.com',
      password: process.env.CLIENT_PASSWORD || (() => {
        console.error('❌ CRITICAL: CLIENT_PASSWORD not set! Using insecure default.');
        return 'password123';
      })(),
      email_confirm: true,
      user_metadata: {
        full_name: 'Client User',
        role: 'client'
      }
    });

    if (clientError) {
      if (clientError.message.includes('already registered')) {
        console.log('✅ Client user already exists');
      } else {
        throw clientError;
      }
    } else {
      console.log('✅ Client user created successfully');
    }

    // Get user IDs
    const { data: adminUser } = await supabase.auth.admin.listUsers();
    const admin = adminUser.users.find(u => u.email === 'admin@example.com');
    const client = adminUser.users.find(u => u.email === 'client@example.com');

    if (!admin || !client) {
      throw new Error('Could not find created users');
    }

    console.log('\n📝 Creating user profiles...');

    // Create admin profile
    const { error: adminProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: admin.id,
        email: admin.email,
        role: 'admin',
        full_name: 'Admin User'
      });

    if (adminProfileError) {
      console.error('❌ Error creating admin profile:', adminProfileError);
    } else {
      console.log('✅ Admin profile created');
    }

    // Create client profile
    const { error: clientProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: client.id,
        email: client.email,
        role: 'client',
        full_name: 'Client User'
      });

    if (clientProfileError) {
      console.error('❌ Error creating client profile:', clientProfileError);
    } else {
      console.log('✅ Client profile created');
    }

    // Create demo client records
    console.log('\n🏢 Creating demo client records...');
    
    const { error: clientRecordError } = await supabase
      .from('clients')
      .upsert({
        admin_id: admin.id,
        name: 'TechCorp Solutions',
        email: 'client@techcorp.com',
        company: 'TechCorp Inc.',
        meta_access_token: 'DEMO_TOKEN_REPLACE_WITH_REAL_META_TOKEN',
        ad_account_id: '123456789',
        reporting_frequency: 'monthly',
        api_status: 'pending',
        notes: 'Demo client for testing'
      });

    if (clientRecordError) {
      console.error('❌ Error creating client record:', clientRecordError);
    } else {
      console.log('✅ Demo client record created');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('Admin: admin@example.com / password123');
    console.log('Client: client@example.com / password123');
    console.log('\n🔗 You can now test the login at: http://localhost:3000/auth/login');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupUsers(); 