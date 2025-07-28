require('dotenv').config({ path: '.env.local' });

console.log('🔍 Debugging API environment...\n');

console.log('Environment variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

console.log('\nURL preview:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...');
console.log('Anon key preview:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
console.log('Service key preview:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...'); 