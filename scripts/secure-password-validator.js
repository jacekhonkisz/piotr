#!/usr/bin/env node

/**
 * Secure Password Validator & Manager
 * Ensures production passwords meet security requirements
 */

require('dotenv').config({ path: '.env.local' });

class SecurePasswordValidator {
  constructor() {
    this.requirements = {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      forbiddenPasswords: ['password123', 'admin123', 'client123', '123456789', 'qwerty123']
    };
  }

  validatePassword(password) {
    const errors = [];

    if (!password) {
      errors.push('Password is required');
      return { valid: false, errors };
    }

    if (password.length < this.requirements.minLength) {
      errors.push(`Password must be at least ${this.requirements.minLength} characters long`);
    }

    if (this.requirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requirements.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requirements.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one symbol');
    }

    if (this.requirements.forbiddenPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and forbidden in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: this.calculateStrength(password)
    };
  }

  calculateStrength(password) {
    let score = 0;
    
    if (password.length >= 12) score += 2;
    if (password.length >= 16) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 2;
    if (/[^A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

    if (score >= 8) return 'Very Strong';
    if (score >= 6) return 'Strong';
    if (score >= 4) return 'Medium';
    if (score >= 2) return 'Weak';
    return 'Very Weak';
  }

  generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Ensure at least one character from each required set
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  validateEnvironmentPasswords() {
    console.log('🔒 Validating production passwords...\n');
    
    const passwords = {
      'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD,
      'CLIENT_PASSWORD': process.env.CLIENT_PASSWORD,
      'JACEK_PASSWORD': process.env.JACEK_PASSWORD
    };

    let allValid = true;
    
    for (const [envVar, password] of Object.entries(passwords)) {
      console.log(`Checking ${envVar}:`);
      
      if (!password) {
        console.log(`  ❌ NOT SET - Add ${envVar} to .env.local`);
        allValid = false;
        continue;
      }

      const validation = this.validatePassword(password);
      
      if (validation.valid) {
        console.log(`  ✅ Valid (${validation.strength})`);
      } else {
        console.log(`  ❌ Invalid:`);
        validation.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
        allValid = false;
      }
      console.log('');
    }

    if (allValid) {
      console.log('🎉 All passwords meet security requirements!');
      return true;
    } else {
      console.log('⚠️  Some passwords need to be updated for production security.');
      console.log('\nTo generate secure passwords, run:');
      console.log('node scripts/secure-password-validator.js --generate');
      return false;
    }
  }

  generatePasswordsForEnv() {
    console.log('🔐 Generating secure passwords for production:\n');
    
    const passwords = {
      'ADMIN_PASSWORD': this.generateSecurePassword(16),
      'CLIENT_PASSWORD': this.generateSecurePassword(16),
      'JACEK_PASSWORD': this.generateSecurePassword(16)
    };

    console.log('Add these to your .env.local file:\n');
    for (const [envVar, password] of Object.entries(passwords)) {
      console.log(`${envVar}=${password}`);
    }
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('1. Save these passwords securely');
    console.log('2. Never commit them to git');
    console.log('3. Use different passwords for each environment');
    console.log('4. Share securely with your team');
  }
}

// CLI Interface
if (require.main === module) {
  const validator = new SecurePasswordValidator();
  const args = process.argv.slice(2);

  if (args.includes('--generate')) {
    validator.generatePasswordsForEnv();
  } else if (args.includes('--validate')) {
    const isValid = validator.validateEnvironmentPasswords();
    process.exit(isValid ? 0 : 1);
  } else {
    console.log('🔒 Secure Password Validator & Manager\n');
    console.log('Usage:');
    console.log('  node scripts/secure-password-validator.js --validate   # Check current passwords');
    console.log('  node scripts/secure-password-validator.js --generate   # Generate new secure passwords');
    console.log('');
    
    // Default: validate current passwords
    validator.validateEnvironmentPasswords();
  }
}

module.exports = SecurePasswordValidator;
