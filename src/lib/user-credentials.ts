/**
 * User Credentials Generator
 * Generates secure usernames and passwords for client accounts
 */

import { createHash } from 'crypto';

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 12): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate a username based on client name and company
 */
export function generateUsername(name: string, company?: string): string {
  // Clean the name and company
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanCompany = company ? company.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  
  // Generate base username
  let baseUsername = cleanName;
  if (cleanCompany && cleanCompany.length > 0) {
    baseUsername = `${cleanName}.${cleanCompany}`;
  }
  
  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${baseUsername}.${suffix}`;
}

/**
 * Hash a password for storage
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Verify a password against its hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate complete user credentials
 */
export function generateUserCredentials(name: string, company?: string) {
  const username = generateUsername(name, company);
  const password = generatePassword();
  const passwordHash = hashPassword(password);
  
  return {
    username,
    password, // Return plain password for display
    passwordHash, // Return hash for storage
  };
} 