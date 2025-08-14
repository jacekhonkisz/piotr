import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import logger from './logger';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Profile = Database['public']['Tables']['profiles']['Row'];

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
    logger.warn('Failed to load profile cache from localStorage:', error);
  }
}

// Save cache to localStorage
function saveCacheToStorage() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('profile_cache', JSON.stringify(profileCache));
    } catch (error) {
      logger.warn('Failed to save profile cache to localStorage:', error);
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
      logger.error('getCurrentProfile: Session error:', error);
      return null;
    }

    if (!session?.user) {
      logger.info('getCurrentProfile: No session or user found');
      return null;
    }

    const user = session.user;
    logger.info(`getCurrentProfile: Session retrieved in ${sessionTime.toFixed(2)}ms`);
    logger.info('getCurrentProfile: User found:', user.email, 'ID:', user.id);

    const cacheKey = user.id;
    
    // Check if there's already an ongoing request for this user (deduplication)
    if (ongoingProfileRequests.has(cacheKey)) {
      logger.info('getCurrentProfile: Returning ongoing request for user:', user.id);
      return ongoingProfileRequests.get(cacheKey)!;
    }

    // Check cache first (enhanced caching)
    const cached = profileCache[cacheKey];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      logger.info('getCurrentProfile: Returning cached profile');
      const totalTime = performance.now() - startTime;
      logger.info(`getCurrentProfile: Total time (cached): ${totalTime.toFixed(2)}ms`);
      return cached.profile || null;
    }

    logger.info('getCurrentProfile: Cache miss, fetching from database for user ID:', user.id);
    
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
            logger.error(`Attempt ${attempt + 1} failed:`, error);
            lastError = error;
            
            // Don't retry on certain errors
            if (error.code === 'PGRST116' || error.message.includes('not found')) {
              break;
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < MAX_RETRIES) {
              const delay = Math.pow(2, attempt) * 1000; // 1s, 2s backoff
              logger.info(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            continue;
          }

          logger.info(`getCurrentProfile: Profile fetched successfully in ${queryTime.toFixed(2)}ms`);
          logger.info('getCurrentProfile: Profile data:', profile);

          // Cache the result
          profileCache[cacheKey] = {
            profile,
            timestamp: now
          };
          
          // Save to localStorage
          saveCacheToStorage();

          const totalTime = performance.now() - startTime;
          logger.info(`getCurrentProfile: Total time (database): ${totalTime.toFixed(2)}ms`);
          
          return profile;
          
        } catch (error: any) {
          logger.error(`Attempt ${attempt + 1} failed with exception:`, error);
          lastError = error;
          
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000;
            logger.info(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      logger.error('getCurrentProfile: All retry attempts failed');
      logger.error('Last error:', lastError);
      
      // Cache null result to prevent repeated failed requests (with shorter duration)
      profileCache[cacheKey] = {
        profile: null,
        timestamp: now - (CACHE_DURATION - 60000) // Cache for only 1 minute
      };
      saveCacheToStorage();
      
      const totalTime = performance.now() - startTime;
      logger.info(`getCurrentProfile: Total time (failed): ${totalTime.toFixed(2)}ms`);
      
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
    logger.error('Unexpected error in getCurrentProfile:', error);
    const totalTime = performance.now() - startTime;
    logger.info(`getCurrentProfile: Total time (error): ${totalTime.toFixed(2)}ms`);
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
    logger.info('Warming profile cache for user:', userId);
    const profile = await getCurrentProfile();
    if (profile) {
      logger.info('Profile cache warmed successfully');
    }
  } catch (error) {
    logger.warn('Failed to warm profile cache:', error);
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

  logger.info('Updating profile for user:', user.id);

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating profile:', error);
    throw error;
  }

  // Update cache with new data
  profileCache[user.id] = {
    profile: data,
    timestamp: Date.now()
  };
  saveCacheToStorage();

  logger.info('Profile updated successfully');
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