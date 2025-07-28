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
 * Get current user profile with caching and timeout protection
 */
let profileCache: { [key: string]: { profile: Profile | null; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PROFILE_FETCH_TIMEOUT = 5000; // 5 seconds (reduced from 10)

export async function getCurrentProfile(): Promise<Profile | null> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('Profile fetch timeout - aborting request');
    timeoutController.abort();
  }, PROFILE_FETCH_TIMEOUT);
  
  try {
    console.log('getCurrentProfile: Starting profile fetch...');
    
    // Get the current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      clearTimeout(timeoutId);
      return null;
    }
    
    if (!session?.user) {
      console.log('getCurrentProfile: No session or user found');
      clearTimeout(timeoutId);
      return null;
    }

    const user = session.user;
    console.log('getCurrentProfile: User found:', user.email, 'ID:', user.id);

    // Check cache first
    const cacheKey = user.id;
    const cached = profileCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('getCurrentProfile: Returning cached profile');
      clearTimeout(timeoutId);
      return cached.profile;
    }

    console.log('getCurrentProfile: Fetching profile from database for user ID:', user.id);
    
    // Use Promise.race to ensure timeout works
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timeout')), PROFILE_FETCH_TIMEOUT);
    });

    const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

    clearTimeout(timeoutId);

    if (error) {
      console.error('Error fetching profile:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Cache null result to prevent repeated failed requests
      profileCache[cacheKey] = {
        profile: null,
        timestamp: Date.now()
      };
      
      return null;
    }

    console.log('getCurrentProfile: Profile fetched successfully:', profile);

    // Cache the result
    profileCache[cacheKey] = {
      profile,
      timestamp: Date.now()
    };

    return profile;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.message === 'Profile fetch timeout') {
      console.error('Profile fetch timeout - operation took too long');
    } else if (error.name === 'AbortError') {
      console.error('Profile fetch aborted - operation took too long');
    } else {
      console.error('Unexpected error in getCurrentProfile:', error);
    }
    
    // Return null instead of throwing to prevent app hanging
    return null;
  }
}

/**
 * Clear profile cache for a user
 */
export function clearProfileCache(userId?: string) {
  if (userId) {
    delete profileCache[userId];
  } else {
    profileCache = {};
  }
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