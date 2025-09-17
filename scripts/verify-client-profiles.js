const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyClientProfiles() {
  console.log('🔍 Verifying Client Profiles for Dashboard Access\n');
  console.log('='.repeat(60));

  try {
    // Get profiles for the clients
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('email', ['belmonte@hotel.com', 'havet@magialubczyku.pl'])
      .order('email');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    console.log(`📋 Found ${profiles.length} client profiles:\n`);

    profiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.full_name || profile.email}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Full Name: ${profile.full_name || 'Not set'}`);
      console.log(`   Created: ${profile.created_at}`);
      console.log('');
    });

    // Check if profiles exist for both clients
    const belmonteProfile = profiles.find(p => p.email === 'belmonte@hotel.com');
    const havetProfile = profiles.find(p => p.email === 'havet@magialubczyku.pl');

    console.log('🎯 Profile Verification:');
    
    if (belmonteProfile) {
      console.log('\n🏨 Belmonte Hotel Profile:');
      console.log(`   ✅ Profile exists`);
      console.log(`   Role: ${belmonteProfile.role}`);
      console.log(`   Full Name: ${belmonteProfile.full_name || 'Not set'}`);
      
      if (belmonteProfile.role !== 'client') {
        console.log(`   ⚠️  Role should be 'client' but is '${belmonteProfile.role}'`);
      }
    } else {
      console.log('\n❌ Belmonte Hotel profile not found');
    }

    if (havetProfile) {
      console.log('\n🏨 Havet Profile:');
      console.log(`   ✅ Profile exists`);
      console.log(`   Role: ${havetProfile.role}`);
      console.log(`   Full Name: ${havetProfile.full_name || 'Not set'}`);
      
      if (havetProfile.role !== 'client') {
        console.log(`   ⚠️  Role should be 'client' but is '${havetProfile.role}'`);
      }
    } else {
      console.log('\n❌ Havet profile not found');
    }

    // Test login and profile access
    console.log('\n🧪 Testing Login and Profile Access...');

    // Test Belmonte login
    console.log('\n🏨 Testing Belmonte login and profile...');
    const { data: belmonteAuth, error: belmonteAuthError } = await supabase.auth.signInWithPassword({
      email: 'belmonte@hotel.com',
      password: 'cPM1CrKJzXY@'
    });

    if (belmonteAuthError) {
      console.error(`❌ Belmonte login failed:`, belmonteAuthError.message);
    } else {
      console.log(`✅ Belmonte login successful!`);
      
      // Get profile for logged-in user
      const { data: belmonteUserProfile, error: belmonteProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', belmonteAuth.user.id)
        .single();

      if (belmonteProfileError) {
        console.error(`❌ Belmonte profile fetch failed:`, belmonteProfileError.message);
      } else {
        console.log(`✅ Belmonte profile accessible:`);
        console.log(`   Role: ${belmonteUserProfile.role}`);
        console.log(`   Full Name: ${belmonteUserProfile.full_name}`);
      }
    }

    // Sign out
    await supabase.auth.signOut();

    // Test Havet login
    console.log('\n🏨 Testing Havet login and profile...');
    const { data: havetAuth, error: havetAuthError } = await supabase.auth.signInWithPassword({
      email: 'havet@magialubczyku.pl',
      password: '@Z5ntQoYJn@^'
    });

    if (havetAuthError) {
      console.error(`❌ Havet login failed:`, havetAuthError.message);
    } else {
      console.log(`✅ Havet login successful!`);
      
      // Get profile for logged-in user
      const { data: havetUserProfile, error: havetProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', havetAuth.user.id)
        .single();

      if (havetProfileError) {
        console.error(`❌ Havet profile fetch failed:`, havetProfileError.message);
      } else {
        console.log(`✅ Havet profile accessible:`);
        console.log(`   Role: ${havetUserProfile.role}`);
        console.log(`   Full Name: ${havetUserProfile.full_name}`);
      }
    }

    // Sign out
    await supabase.auth.signOut();

    console.log('\n✅ Profile verification completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyClientProfiles(); 