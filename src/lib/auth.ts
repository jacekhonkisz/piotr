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

// Enhanced caching with localStorage persistence
let profileCache: { [key: string]: { profile: Profile | null; timestamp: number } } = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const PROFILE_FETCH_TIMEOUT = 3000; // tighter timeout to avoid long waits
const MAX_RETRIES = 1; // reduce retries to speed up failures

// Load cache from localStorage on module load
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('profile_cache');
    if (cached) {
      profileCache = JSON.parse(cached);
      // Clean expired entries
      const now = Date.now();
      Object.keys(profileCache).forEach(key => {
        const entry = profileCache[key];
        if (entry && (now - entry.timestamp) > CACHE_DURATION) {
          delete profileCache[key];
        }
      });
    }
  } catch (error) {
    console.warn('Failed to load profile cache from localStorage:', error);
  }
}

// Save cache to localStorage
function saveCacheToStorage() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('profile_cache', JSON.stringify(profileCache));
    } catch (error) {
      console.warn('Failed to save profile cache to localStorage:', error);
    }
  }
}

/**
 * Get current user profile with enhanced caching and performance optimizations
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const startTime = performance.now();
  console.log('getCurrentProfile: Starting profile fetch...');
  
  try {
    // Get the current session first (this is usually fast)
    const sessionStart = performance.now();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionTime = performance.now() - sessionStart;
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return null;
    }
    
    if (!session?.user) {
      console.log('getCurrentProfile: No session or user found');
      return null;
    }

    const user = session.user;
    console.log(`getCurrentProfile: Session retrieved in ${sessionTime.toFixed(2)}ms`);
    console.log('getCurrentProfile: User found:', user.email, 'ID:', user.id);

    // Check cache first (enhanced caching)
    const cacheKey = user.id;
    const cached = profileCache[cacheKey];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('getCurrentProfile: Returning cached profile');
      const totalTime = performance.now() - startTime;
      console.log(`getCurrentProfile: Total time (cached): ${totalTime.toFixed(2)}ms`);
      return cached.profile || null;
    }

    console.log('getCurrentProfile: Cache miss, fetching from database for user ID:', user.id);
    
    // Implement retry mechanism with exponential backoff
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const queryStart = performance.now();
        
        // Use Promise.race with timeout for each attempt
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Profile fetch timeout')), PROFILE_FETCH_TIMEOUT);
        });

        const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
        const queryTime = performance.now() - queryStart;

        if (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);
          lastError = error;
          
          // Don't retry on certain errors
          if (error.code === 'PGRST116' || error.message.includes('not found')) {
            break;
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 500; // faster backoff: 0.5s, 1s
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          continue;
        }

        console.log(`getCurrentProfile: Profile fetched successfully in ${queryTime.toFixed(2)}ms`);
        console.log('getCurrentProfile: Profile data:', profile);

        // Cache the result
        profileCache[cacheKey] = {
          profile,
          timestamp: now
        };
        
        // Save to localStorage
        saveCacheToStorage();

        const totalTime = performance.now() - startTime;
        console.log(`getCurrentProfile: Total time: ${totalTime.toFixed(2)}ms`);
        
        return profile;
        
      } catch (error: any) {
        console.error(`Attempt ${attempt + 1} failed with exception:`, error);
        lastError = error;
        
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('getCurrentProfile: All retry attempts failed');
    console.error('Last error:', lastError);
    
    // Cache null result to prevent repeated failed requests (with shorter duration)
    profileCache[cacheKey] = {
      profile: null,
      timestamp: now
    };
    saveCacheToStorage();
    
    const totalTime = performance.now() - startTime;
    console.log(`getCurrentProfile: Total time (failed): ${totalTime.toFixed(2)}ms`);
    
    return null;
    
  } catch (error: any) {
    console.error('Unexpected error in getCurrentProfile:', error);
    const totalTime = performance.now() - startTime;
    console.log(`getCurrentProfile: Total time (error): ${totalTime.toFixed(2)}ms`);
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
  saveCacheToStorage();
}

/**
 * Warm up profile cache for a user
 */
export async function warmProfileCache(userId: string): Promise<void> {
  try {
    console.log('Warming profile cache for user:', userId);
    const profile = await getCurrentProfile();
    if (profile) {
      console.log('Profile cache warmed successfully');
    }
  } catch (error) {
    console.warn('Failed to warm profile cache:', error);
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

  // Update cache with new data
  profileCache[user.id] = {
    profile: data,
    timestamp: Date.now()
  };
  saveCacheToStorage();

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