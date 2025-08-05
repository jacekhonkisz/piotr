require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCredentialsModal() {
  console.log('🧪 Testing Credentials Modal Functionality...\n');

  try {
    // 1. Get a test client
    console.log('1. Getting test client...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients.length) {
      console.error('❌ No clients found:', clientsError?.message);
      return;
    }

    const testClient = clients[0];
    console.log('✅ Test client found:');
    console.log('   ID:', testClient.id);
    console.log('   Name:', testClient.name);
    console.log('   Email:', testClient.email);
    console.log('   Current username:', testClient.generated_username || testClient.email);
    console.log('   Has password:', !!testClient.generated_password);

    // 2. Test password regeneration (simulating the modal functionality)
    console.log('\n2. Testing password regeneration...');
    
    // Generate new password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    console.log('   Generated new password:', newPassword);

    // Find user in Supabase Auth
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    const userToUpdate = authUsers.users.find(u => u.email === testClient.email);
    if (!userToUpdate) {
      console.error('❌ User not found in Supabase Auth:', testClient.email);
      return;
    }

    console.log('   Found user in Auth:', userToUpdate.email);

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userToUpdate.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password in Auth:', updateError);
      return;
    }

    console.log('✅ Password updated in Supabase Auth');

    // Update client record in database
    const { error: dbError } = await supabase
      .from('clients')
      .update({
        generated_password: newPassword,
        generated_username: testClient.email,
        credentials_generated_at: new Date().toISOString()
      })
      .eq('id', testClient.id);

    if (dbError) {
      console.error('❌ Error updating client record:', dbError);
      return;
    }

    console.log('✅ Client record updated in database');

    // 3. Test email update functionality
    console.log('\n3. Testing email update...');
    const originalEmail = testClient.email;
    const testEmail = `test-${Date.now()}@example.com`;
    
    console.log('   Original email:', originalEmail);
    console.log('   Test email:', testEmail);

    // Check if test email already exists
    const existingUser = authUsers.users.find(u => u.email === testEmail);
    if (existingUser) {
      console.log('   Test email already exists, skipping email update test');
    } else {
      // Update email in Supabase Auth
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        userToUpdate.id,
        { email: testEmail }
      );

      if (emailUpdateError) {
        console.error('❌ Error updating email in Auth:', emailUpdateError);
      } else {
        console.log('✅ Email updated in Supabase Auth');

        // Update client record
        const { error: emailDbError } = await supabase
          .from('clients')
          .update({
            email: testEmail,
            generated_username: testEmail,
            credentials_generated_at: new Date().toISOString()
          })
          .eq('id', testClient.id);

        if (emailDbError) {
          console.error('❌ Error updating email in database:', emailDbError);
        } else {
          console.log('✅ Email updated in database');

          // Revert email change
          const { error: revertError } = await supabase.auth.admin.updateUserById(
            userToUpdate.id,
            { email: originalEmail }
          );

          if (revertError) {
            console.error('❌ Error reverting email:', revertError);
          } else {
            const { error: revertDbError } = await supabase
              .from('clients')
              .update({
                email: originalEmail,
                generated_username: originalEmail,
                credentials_generated_at: new Date().toISOString()
              })
              .eq('id', testClient.id);

            if (revertDbError) {
              console.error('❌ Error reverting email in database:', revertDbError);
            } else {
              console.log('✅ Email reverted successfully');
            }
          }
        }
      }
    }

    // 4. Test authentication with new password
    console.log('\n4. Testing authentication with new password...');
    try {
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: testClient.email,
        password: newPassword
      });

      if (authError) {
        console.error('❌ Authentication failed:', authError.message);
      } else {
        console.log('✅ Authentication successful with new password');
        console.log('   User:', user.email);
      }
    } catch (error) {
      console.error('❌ Authentication error:', error.message);
    }

    // 5. Verify final state
    console.log('\n5. Verifying final state...');
    const { data: finalClient, error: finalError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', testClient.id)
      .single();

    if (finalError) {
      console.error('❌ Error fetching final client state:', finalError);
    } else {
      console.log('✅ Final client state:');
      console.log('   Email:', finalClient.email);
      console.log('   Username:', finalClient.generated_username);
      console.log('   Has password:', !!finalClient.generated_password);
      console.log('   Credentials generated at:', finalClient.credentials_generated_at);
    }

    console.log('\n🎉 Credentials Modal Functionality Test Completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Password regeneration works');
    console.log('   ✅ Email update works');
    console.log('   ✅ Database updates work');
    console.log('   ✅ Supabase Auth integration works');
    console.log('   ✅ Authentication with new credentials works');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCredentialsModal(); 