import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Profile = Database['public']['Tables']['profiles']['Row'];

// Helper function to verify user existence
export async function verifyUserExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error verifying user:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in verifyUserExists:', error);
    return false;
  }
}

// Helper function for user creation with better error handling
export async function createUserProfile(user: any): Promise<void> {
  try {
    console.log('Creating profile for user:', user.email);
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        role: 'client',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Profile creation error:', error);
      // Don't throw error for duplicate key (user already exists)
      if (error.code !== '23505') {
        throw error;
      } else {
        console.log('Profile already exists, continuing...');
      }
    } else {
      console.log('Profile created successfully:', data);
    }
  } catch (error: any) {
    console.error('Error in createUserProfile:', error);
    // Only throw if it's not a duplicate key error
    if (error.code !== '23505') {
      throw error;
    }
  }
}

// Helper function for updating profile timestamp  
export async function updateProfileTimestamp(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile timestamp:', error);
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// Enhanced caching with localStorage persistence and request deduplication
let profileCache: { [key: string]: { profile: Profile | null; timestamp: number } } = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const PROFILE_FETCH_TIMEOUT = 5000; // increased timeout for better reliability
const MAX_RETRIES = 2; // increased retries with exponential backoff

// Request deduplication to prevent race conditions
let ongoingProfileRequests = new Map<string, Promise<Profile | null>>();

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
  
  try {
    const sessionStart = performance.now();
    const { data: { session }, error } = await supabase.auth.getSession();
    const sessionTime = performance.now() - sessionStart;
    
    if (error) {
      console.error('getCurrentProfile: Session error:', error);
      return null;
    }

    if (!session?.user) {
      console.log('getCurrentProfile: No session or user found');
      return null;
    }

    const user = session.user;
    console.log(`getCurrentProfile: Session retrieved in ${sessionTime.toFixed(2)}ms`);
    console.log('getCurrentProfile: User found:', user.email, 'ID:', user.id);

    const cacheKey = user.id;
    
    // Check if there's already an ongoing request for this user (deduplication)
    if (ongoingProfileRequests.has(cacheKey)) {
      console.log('getCurrentProfile: Returning ongoing request for user:', user.id);
      return ongoingProfileRequests.get(cacheKey)!;
    }

    // Check cache first (enhanced caching)
    const cached = profileCache[cacheKey];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('getCurrentProfile: Returning cached profile');
      const totalTime = performance.now() - startTime;
      console.log(`getCurrentProfile: Total time (cached): ${totalTime.toFixed(2)}ms`);
      return cached.profile || null;
    }

    console.log('getCurrentProfile: Cache miss, fetching from database for user ID:', user.id);
    
    // Create promise for this request and store it for deduplication
    const profileRequest = (async (): Promise<Profile | null> => {
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
              const delay = Math.pow(2, attempt) * 1000; // 1s, 2s backoff
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
          console.log(`getCurrentProfile: Total time (database): ${totalTime.toFixed(2)}ms`);
          
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
        timestamp: now - (CACHE_DURATION - 60000) // Cache for only 1 minute
      };
      saveCacheToStorage();
      
      const totalTime = performance.now() - startTime;
      console.log(`getCurrentProfile: Total time (failed): ${totalTime.toFixed(2)}ms`);
      
      return null;
    })();

    // Store the ongoing request for deduplication
    ongoingProfileRequests.set(cacheKey, profileRequest);

    try {
      const result = await profileRequest;
      return result;
    } finally {
      // Clean up completed request
      ongoingProfileRequests.delete(cacheKey);
    }
    
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
    ongoingProfileRequests.delete(userId);
  } else {
    profileCache = {};
    ongoingProfileRequests.clear();
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
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    throw new Error('User not authenticated');
  }

  console.log('Updating profile for user:', user.id);

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }

  // Update cache with new data
  profileCache[user.id] = {
    profile: data,
    timestamp: Date.now()
  };
  saveCacheToStorage();

  console.log('Profile updated successfully');
  return data;
}

/**
 * Get cache statistics for monitoring
 */
export function getProfileCacheStats() {
  const now = Date.now();
  const cacheEntries = Object.entries(profileCache);
  
  return {
    totalEntries: cacheEntries.length,
    validEntries: cacheEntries.filter(([_, entry]) => 
      (now - entry.timestamp) < CACHE_DURATION
    ).length,
    ongoingRequests: ongoingProfileRequests.size,
    oldestEntry: Math.min(...cacheEntries.map(([_, entry]) => entry.timestamp)),
    newestEntry: Math.max(...cacheEntries.map(([_, entry]) => entry.timestamp))
  };
}

/**
 * Sign in user with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    console.log('Signing in user:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    console.log('Sign in successful');
    return { data, error: null };
  } catch (error) {
    console.error('Error in signIn:', error);
    return { data: null, error };
  }
}

/**
 * Sign up user with email and password
 */
export async function signUp(email: string, password: string) {
  try {
    console.log('Signing up user:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      console.error('Sign up error:', error);
      throw error;
    }

    console.log('Sign up successful');
    return { data, error: null };
  } catch (error) {
    console.error('Error in signUp:', error);
    return { data: null, error };
  }
}

/**
 * Sign out user
 */
export async function signOut() {
  try {
    console.log('Signing out user');
    
    // Clear profile cache
    clearProfileCache();
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }

    console.log('Sign out successful');
    return { error: null };
  } catch (error) {
    console.error('Error in signOut:', error);
    return { error };
  }
}

/**
 * Auth state interface for context
 */
export interface AuthState {
  user: any;
  profile: Profile | null;
  loading: boolean;
} 