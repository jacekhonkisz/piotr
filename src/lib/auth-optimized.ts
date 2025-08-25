/**
 * Optimized Authentication System
 * Fixes 3-5 second authentication delays
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import logger from './logger';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Profile = Database['public']['Tables']['profiles']['Row'];

// Optimized cache with size limits and automatic cleanup
class OptimizedProfileCache {
  private cache = new Map<string, { profile: Profile | null; timestamp: number; hits: number }>();
  private readonly maxSize = 100;
  private readonly cacheDuration = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Auto-cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  get(userId: string): Profile | null | undefined {
    const entry = this.cache.get(userId);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheDuration) {
      this.cache.delete(userId);
      return undefined;
    }

    // Update hit count and timestamp for LRU
    entry.hits++;
    entry.timestamp = now;
    return entry.profile;
  }

  set(userId: string, profile: Profile | null): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(userId, {
      profile,
      timestamp: Date.now(),
      hits: 1
    });
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < leastHits || (entry.hits === leastHits && entry.timestamp < oldestTime)) {
        leastUsedKey = key;
        leastHits = entry.hits;
        oldestTime = entry.timestamp;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.info(`🧹 Cleaned up ${keysToDelete.length} expired profile cache entries`);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  private calculateHitRate(): number {
    const entries = Array.from(this.cache.values());
    if (entries.length === 0) return 0;
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    return totalHits / entries.length;
  }
}

// Global optimized cache instance
const profileCache = new OptimizedProfileCache();

// Request deduplication to prevent race conditions
const ongoingRequests = new Map<string, Promise<Profile | null>>();

/**
 * Optimized profile loading with performance monitoring
 */
export async function getCurrentProfileOptimized(): Promise<Profile | null> {
  const startTime = performance.now();
  
  try {
    // Step 1: Get session (optimized with timeout)
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Session timeout')), 2000); // 2s timeout
    });

    const { data: { session }, error } = await Promise.race([
      sessionPromise,
      timeoutPromise
    ]);
    
    if (error || !session?.user) {
      logger.info('getCurrentProfileOptimized: No session or user found');
      return null;
    }

    const user = session.user;
    const userId = user.id;

    // Step 2: Check cache first
    const cachedProfile = profileCache.get(userId);
    if (cachedProfile !== undefined) {
      const totalTime = performance.now() - startTime;
      logger.info(`getCurrentProfileOptimized: Cache hit in ${totalTime.toFixed(2)}ms`);
      return cachedProfile;
    }

    // Step 3: Check for ongoing request (deduplication)
    if (ongoingRequests.has(userId)) {
      logger.info('getCurrentProfileOptimized: Reusing ongoing request');
      return ongoingRequests.get(userId)!;
    }

    // Step 4: Create new optimized database request
    const profileRequest = (async (): Promise<Profile | null> => {
      try {
        const queryStart = performance.now();
        
        // Optimized query with specific fields and timeout
        const queryPromise = supabase
          .from('profiles')
          .select('id, email, role, full_name, avatar_url, created_at, updated_at')
          .eq('id', userId)
          .single();

        const queryTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Profile query timeout')), 3000); // 3s timeout
        });

        const { data: profile, error } = await Promise.race([
          queryPromise,
          queryTimeoutPromise
        ]);

        const queryTime = performance.now() - queryStart;

        if (error) {
          logger.error(`getCurrentProfileOptimized: Query failed in ${queryTime.toFixed(2)}ms:`, error);
          
          // Cache null result to prevent repeated failed requests
          profileCache.set(userId, null);
          return null;
        }

        logger.info(`getCurrentProfileOptimized: Query succeeded in ${queryTime.toFixed(2)}ms`);
        
        // Cache successful result
        profileCache.set(userId, profile);
        return profile;

      } catch (error) {
        logger.error('getCurrentProfileOptimized: Request failed:', error);
        profileCache.set(userId, null);
        return null;
      } finally {
        ongoingRequests.delete(userId);
      }
    })();

    // Store ongoing request for deduplication
    ongoingRequests.set(userId, profileRequest);
    
    const result = await profileRequest;
    const totalTime = performance.now() - startTime;
    
    logger.info(`getCurrentProfileOptimized: Total time ${totalTime.toFixed(2)}ms`);
    
    return result;

  } catch (error) {
    const totalTime = performance.now() - startTime;
    logger.error(`getCurrentProfileOptimized: Failed in ${totalTime.toFixed(2)}ms:`, error);
    return null;
  }
}

/**
 * Optimized sign in with performance monitoring
 */
export async function signInOptimized(email: string, password: string) {
  const startTime = performance.now();
  
  try {
    logger.info('signInOptimized: Starting sign in for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    const totalTime = performance.now() - startTime;

    if (error) {
      logger.error(`signInOptimized: Failed in ${totalTime.toFixed(2)}ms:`, error);
      return { data: null, error };
    }

    logger.info(`signInOptimized: Success in ${totalTime.toFixed(2)}ms`);
    return { data, error: null };
    
  } catch (error) {
    const totalTime = performance.now() - startTime;
    logger.error(`signInOptimized: Exception in ${totalTime.toFixed(2)}ms:`, error);
    return { data: null, error };
  }
}

/**
 * Clear profile cache for user
 */
export function clearProfileCacheOptimized(userId?: string): void {
  if (userId) {
    profileCache.set(userId, null);
    ongoingRequests.delete(userId);
  } else {
    profileCache.clear();
    ongoingRequests.clear();
  }
}

/**
 * Get cache performance statistics
 */
export function getProfileCacheStats() {
  return {
    ...profileCache.getStats(),
    ongoingRequests: ongoingRequests.size
  };
}

/**
 * Auth state interface
 */
export interface AuthState {
  user: any;
  profile: Profile | null;
  loading: boolean;
}

/**
 * Check if current user is admin (optimized)
 */
export async function isCurrentUserAdminOptimized(): Promise<boolean> {
  try {
    const profile = await getCurrentProfileOptimized();
    return profile?.role === 'admin';
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
}