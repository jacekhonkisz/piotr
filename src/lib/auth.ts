import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from './database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, fullName: string, role: 'admin' | 'client' = 'client') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  console.log('Attempting to sign in with email:', email);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    } else if (error.message.includes('Email not confirmed')) {
      throw new Error('Please check your email and confirm your account before signing in.');
    } else if (error.message.includes('Too many requests')) {
      throw new Error('Too many login attempts. Please wait a moment before trying again.');
    } else {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  console.log('Sign in successful:', data.user?.email);
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Get current user profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return profile;
}

/**
 * Update user profile
 */
export async function updateProfile(updates: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('No user logged in');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin';
} 