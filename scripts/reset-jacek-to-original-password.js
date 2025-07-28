const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetJacekToOriginalPassword() {
  try {
    console.log('🔍 Resetting jacek password to original generated password...\n');

    const originalPassword = 'v&6uP*1UqTQN';

    // Get jacek's user ID
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error listing users:', usersError);
      return;
    }

    const jacek = users.find(u => u.email === 'jac.honkisz@gmail.com');
    
    if (!jacek) {
      console.log('❌ jacek user not found');
      return;
    }

    console.log(`📋 Found jacek: ${jacek.email} (${jacek.id})`);

    // Reset password using admin API
    const { data: resetData, error: resetError } = await supabase.auth.admin.updateUserById(
      jacek.id,
      { password: originalPassword }
    );

    if (resetError) {
      console.error('❌ Error resetting password:', resetError.message);
      return;
    }

    console.log('✅ Password reset successful!');
    console.log(`🔑 New password: ${originalPassword}`);

    // Test the new password
    console.log('\n🔐 Testing the reset password...');
    
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: 'jac.honkisz@gmail.com',
        password: originalPassword
      });

      if (error) {
        console.log(`   ❌ Password test failed: ${error.message}`);
      } else {
        console.log(`   ✅ SUCCESS! Original password now works`);
        console.log(`   🔑 Session valid: ${session ? 'Yes' : 'No'}`);
        
        // Test API call
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            dateRange: {
              start: '2024-01-01',
              end: '2025-12-31'
            }
          })
        });

        console.log(`   📡 API status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ API working! ${data.data?.campaigns?.length || 0} campaigns, $${data.data?.stats?.totalSpend || 0} spend`);
        } else {
          const errorData = await response.text();
          console.log(`   ❌ API failed: ${errorData}`);
        }
      }
    } catch (testError) {
      console.log(`   ❌ Error: ${testError.message}`);
    }

    console.log('\n🎉 Password reset completed!');
    console.log(`jacek can now log in with the original password: ${originalPassword}`);

  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
}

resetJacekToOriginalPassword(); 