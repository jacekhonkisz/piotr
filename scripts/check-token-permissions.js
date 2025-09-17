require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTokenPermissions() {
  console.log('🔍 CHECKING META API TOKEN PERMISSIONS\n');
  console.log('='.repeat(50));

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.name);
    console.log('🔑 Token preview:', client.meta_access_token.substring(0, 30) + '...');

    // Check token permissions
    console.log('\n🔍 Checking token permissions...');
    const permissionsUrl = `https://graph.facebook.com/v18.0/me/permissions?access_token=${client.meta_access_token}`;
    
    try {
      const response = await fetch(permissionsUrl);
      const data = await response.json();

      if (data.error) {
        console.error('❌ Error checking permissions:', data.error);
        return;
      }

      console.log('📋 Current permissions:');
      const permissions = data.data || [];
      
      if (permissions.length === 0) {
        console.log('   ⚠️ No permissions found');
      } else {
        permissions.forEach(permission => {
          const status = permission.status === 'granted' ? '✅' : '❌';
          console.log(`   ${status} ${permission.permission}: ${permission.status}`);
        });
      }

      // Check for required permissions
      console.log('\n🎯 Required permissions for rankings:');
      const requiredPermissions = [
        'ads_read',
        'ads_management', 
        'business_management',
        'read_insights'
      ];

      const grantedPermissions = permissions
        .filter(p => p.status === 'granted')
        .map(p => p.permission);

      requiredPermissions.forEach(permission => {
        const hasPermission = grantedPermissions.includes(permission);
        const status = hasPermission ? '✅' : '❌';
        console.log(`   ${status} ${permission}`);
      });

      // Summary
      const missingPermissions = requiredPermissions.filter(
        p => !grantedPermissions.includes(p)
      );

      if (missingPermissions.length === 0) {
        console.log('\n🎉 All required permissions are granted!');
      } else {
        console.log('\n⚠️ Missing permissions:', missingPermissions.join(', '));
        console.log('\n📋 To fix this:');
        console.log('   1. Go to https://developers.facebook.com/');
        console.log('   2. Navigate to your app');
        console.log('   3. Go to "Tools" → "Graph API Explorer"');
        console.log('   4. Add the missing permissions');
        console.log('   5. Generate a new token');
        console.log('   6. Update the token in your database');
      }

    } catch (error) {
      console.error('❌ Error checking permissions:', error.message);
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the check
checkTokenPermissions(); 