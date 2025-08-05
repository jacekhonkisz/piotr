require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Production passwords - these should NEVER be hardcoded in scripts
const PRODUCTION_PASSWORDS = {
  'admin@example.com': process.env.ADMIN_PASSWORD || null,
  'jac.honkisz@gmail.com': process.env.JACEK_PASSWORD || 'v&6uP*1UqTQN',
  'client@example.com': process.env.CLIENT_PASSWORD || null
};

// Development passwords (only for local development)
const DEV_PASSWORDS = {
  'admin@example.com': 'password123',
  'jac.honkisz@gmail.com': 'password123',
  'client@example.com': 'password123'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function isProduction() {
  return process.env.NODE_ENV === 'production' || 
         process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co') ||
         process.env.VERCEL_ENV === 'production';
}

function getPassword(email) {
  if (isProduction()) {
    // In production, use environment variables or prompt user
    const envPassword = PRODUCTION_PASSWORDS[email];
    if (envPassword) {
      return envPassword;
    }
    
    // If no environment variable, prompt user securely
    console.warn(`⚠️  WARNING: No environment variable found for ${email} password in production!`);
    console.warn(`   Set ${email.toUpperCase().replace('@', '_').replace('.', '_')}_PASSWORD environment variable`);
    return null;
  } else {
    // In development, use dev passwords
    return DEV_PASSWORDS[email] || 'password123';
  }
}

async function getPasswordSecurely(email) {
  const password = getPassword(email);
  
  if (password) {
    return password;
  }
  
  // Prompt user for password if not available
  console.log(`\n🔐 Please enter password for ${email}:`);
  const userPassword = await question('Password: ');
  return userPassword;
}

async function authenticateUser(email) {
  try {
    const password = await getPasswordSecurely(email);
    
    if (!password) {
      throw new Error('No password provided');
    }
    
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw error;
    }
    
    return { user, session: await supabase.auth.getSession() };
  } catch (error) {
    console.error(`❌ Authentication failed for ${email}:`, error.message);
    return null;
  }
}

async function resetPassword(email, newPassword) {
  try {
    // Get user ID
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw usersError;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      throw new Error(`User ${email} not found`);
    }
    
    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (updateError) {
      throw updateError;
    }
    
    console.log(`✅ Password updated for ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update password for ${email}:`, error.message);
    return false;
  }
}

async function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Export functions for use in other scripts
module.exports = {
  getPassword,
  getPasswordSecurely,
  authenticateUser,
  resetPassword,
  generateSecurePassword,
  isProduction,
  PRODUCTION_PASSWORDS,
  DEV_PASSWORDS
};

// CLI interface
async function main() {
  const command = process.argv[2];
  const email = process.argv[3];
  
  console.log(`🔐 Secure Password Manager`);
  console.log(`Environment: ${isProduction() ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);
  
  switch (command) {
    case 'get':
      if (!email) {
        console.error('❌ Please provide an email address');
        process.exit(1);
      }
      const password = await getPasswordSecurely(email);
      console.log(`Password for ${email}: ${password}`);
      break;
      
    case 'reset':
      if (!email) {
        console.error('❌ Please provide an email address');
        process.exit(1);
      }
      const newPassword = await generateSecurePassword();
      const success = await resetPassword(email, newPassword);
      if (success) {
        console.log(`New password: ${newPassword}`);
      }
      break;
      
    case 'auth':
      if (!email) {
        console.error('❌ Please provide an email address');
        process.exit(1);
      }
      const auth = await authenticateUser(email);
      if (auth) {
        console.log(`✅ Authentication successful for ${email}`);
        console.log(`User ID: ${auth.user.id}`);
      } else {
        console.log(`❌ Authentication failed for ${email}`);
      }
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/secure-password-manager.js get <email>');
      console.log('  node scripts/secure-password-manager.js reset <email>');
      console.log('  node scripts/secure-password-manager.js auth <email>');
      break;
  }
  
  rl.close();
}

if (require.main === module) {
  main().catch(console.error);
} 