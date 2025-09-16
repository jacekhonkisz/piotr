'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentProfile, type AuthState } from '../lib/auth';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null | undefined>;
  authLoading?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  
  // Use refs to prevent race conditions and concurrent loads
  const mountedRef = useRef(true);
  const profileLoadingRef = useRef(false);
  const initializingRef = useRef(false);
  const profileCacheRef = useRef<{ [key: string]: Profile | null }>({});
  const lastAuthEventRef = useRef<string>('');

  const profileRequestQueueRef = useRef<Promise<Profile | null> | null>(null);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  
  // Enhanced development mode detection and stabilization
  const isDevelopment = process.env.NODE_ENV === 'development';
  const stableUserRef = useRef<User | null>(null);
  const authStabilizedRef = useRef(false);
  const signedInEventCountRef = useRef(0);
  const authStabilizationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshProfile = useCallback(async (userToRefresh?: User) => {
    const currentUser = userToRefresh || user;
    if (!currentUser) {
      return null;
    }

    // Prevent concurrent profile loads by reusing existing request
    if (profileRequestQueueRef.current) {
      console.log('Profile request already in progress, waiting for completion');
      return profileRequestQueueRef.current;
    }

    // Check cache first (10 minute cache - aligned with auth.ts)
    const cacheKey = currentUser.id;
    const cached = profileCacheRef.current[cacheKey];
    const cacheTime = performance.now();
    
    if (cached && (cacheTime - (cached as any)._cacheTime) < 600000) { // 10 minutes
      console.log('Using cached profile - setting loading to false');
      if (mountedRef.current) {
        setProfile(cached);
        setLoading(false);
        setInitialized(true);
        console.log('✅ Auth state updated: loading=false, initialized=true, profile=loaded (cached)');
      }
      return cached;
    }

    // Create a single profile request that can be shared
    const profileRequest = (async () => {
      profileLoadingRef.current = true;
      console.log('Loading profile for user:', currentUser.email);
      
      try {
        const profile = await getCurrentProfile();
        
        if (profile) {
          // Cache the profile with timestamp
          (profile as any)._cacheTime = performance.now();
          profileCacheRef.current[cacheKey] = profile;
        }
        
        if (mountedRef.current) {
          setProfile(profile);
          setLoading(false);
          setInitialized(true);
          console.log('Profile loaded successfully');
        }
        
        return profile;
      } catch (error) {
        console.error('Error loading profile:', error);
        
        if (mountedRef.current) {
          setProfile(null);
          setLoading(false);
          setInitialized(true);
        }
        return null;
      } finally {
        profileLoadingRef.current = false;
        profileRequestQueueRef.current = null;
      }
    })();

    // Store the request for potential reuse
    profileRequestQueueRef.current = profileRequest;
    
    return profileRequest;
  }, [user]);

  const signOut = async () => {
    try {
      // Clear cache and local state
      profileCacheRef.current = {};
      profileRequestQueueRef.current = null;
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  useEffect(() => {
    console.log('🔧 AuthProvider useEffect starting...');
    mountedRef.current = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      console.log('🔧 initializeAuth called');
      // Prevent multiple initializations
      if (initializingRef.current) {
        console.log('🔧 Already initializing, skipping');
        return;
      }
      
      initializingRef.current = true;
      
      try {
        console.log('🔧 Initializing auth...');
        
        // Get initial session with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session timeout')), 3000); // Increased to 3 seconds
        });

        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mountedRef.current) {
            setLoading(false);
            setInitialized(true);
          }
          return;
        }

        if (mountedRef.current) {
          const sessionUser = session?.user ?? null;
          setUser(sessionUser);
          
          if (sessionUser) {
            console.log('User found:', sessionUser.email);
            // Load profile with timeout to prevent infinite loading
            const profilePromise = refreshProfile(sessionUser);
            
            // Set a timeout to ensure we don't wait forever
            initializationTimeoutRef.current = setTimeout(() => {
              // Use ref flags rather than stale state in closures
              if (mountedRef.current && profileLoadingRef.current) {
                console.warn('Profile loading timed out, setting initialized anyway');
                setLoading(false);
                setInitialized(true);
              }
            }, 5000); // 5 second timeout
            
            profilePromise.finally(() => {
              if (initializationTimeoutRef.current) {
                clearTimeout(initializationTimeoutRef.current);
                initializationTimeoutRef.current = null;
              }
              if (mountedRef.current) {
                setLoading(false);
                setInitialized(true);
                console.log('Auth initialized with profile');
              }
            });
          } else {
            console.log('No user in session');
            setProfile(null);
            setLoading(false);
            setInitialized(true);
            console.log('Auth initialized without user');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mountedRef.current) {
          setLoading(false);
          setInitialized(true);
        }
      } finally {
        initializingRef.current = false;
      }
    };

  // Set up auth state change listener with enhanced development mode handling
  const handleAuthStateChange = async (event: string, session: any) => {
    const eventKey = `${event}_${session?.user?.id || 'null'}`;
    const nowTs = Date.now();
    
    // Skip TOKEN_REFRESHED events entirely as they don't require profile reloads
    if (event === 'TOKEN_REFRESHED') {
      console.log('Skipping TOKEN_REFRESHED event');
      return;
    }
    
    // Enhanced development mode stabilization
    if (isDevelopment && event === 'SIGNED_IN') {
      signedInEventCountRef.current++;
      
      // If we've seen multiple SIGNED_IN events rapidly, implement stabilization
      if (signedInEventCountRef.current > 1 && !authStabilizedRef.current) {
        console.log(`🔧 Development mode: SIGNED_IN event #${signedInEventCountRef.current}, implementing stabilization`);
        
        // Clear any existing stabilization timeout
        if (authStabilizationTimeoutRef.current) {
          clearTimeout(authStabilizationTimeoutRef.current);
        }
        
        // Set a stabilization timeout - only process if no more events come in the next 3 seconds
        authStabilizationTimeoutRef.current = setTimeout(() => {
          console.log('🔧 Auth stabilized, processing final SIGNED_IN event');
          authStabilizedRef.current = true;
          // Process the event after stabilization
          processAuthEvent(event, session, nowTs);
        }, 3000);
        
        return; // Don't process immediately
      }
      
      // If already stabilized, check for user consistency
      if (authStabilizedRef.current && stableUserRef.current?.id === session?.user?.id) {
        console.log('🔧 Auth already stabilized for this user, skipping duplicate SIGNED_IN');
        return;
      }
    }
    
    // Standard duplicate event prevention
    if (lastAuthEventRef.current === eventKey && (nowTs - lastEventTimeRef.current) < 2000) {
      console.log('Skipping duplicate auth event:', event);
      return;
    }
    
    // Process the event
    processAuthEvent(event, session, nowTs);
  };

  const processAuthEvent = (event: string, session: any, nowTs: number) => {
    const eventKey = `${event}_${session?.user?.id || 'null'}`;
    
    lastAuthEventRef.current = eventKey;
    lastEventTimeRef.current = nowTs;
    console.log('Auth state changed:', event, 'user:', !!session?.user);
      
      if (!mountedRef.current) return;
      
      const sessionUser = session?.user ?? null;
      
      // Update stable user reference for development mode
      if (isDevelopment && sessionUser) {
        stableUserRef.current = sessionUser;
      }
      
      setUser(sessionUser);
      
      if (sessionUser) {
        // Only refresh profile on true sign-in events, not token refreshes
        if (event === 'SIGNED_IN') {
          console.log('Processing SIGNED_IN event');
          
          // In development mode, add extra check to prevent unnecessary refreshes
          if (isDevelopment && authStabilizedRef.current && profile && profile.id === sessionUser.id) {
            console.log('🔧 Development mode: User already has profile, skipping refresh');
            return;
          }
          
          // Always call refreshProfile - it will handle cache internally and set loading states
          refreshProfile(sessionUser).then((loadedProfile: Profile | null) => {
            console.log('Profile refresh completed, profile loaded:', !!loadedProfile);
          }).catch((error: any) => {
            console.error('Profile refresh failed:', error);
            if (mountedRef.current) {
              setLoading(false);
              setInitialized(true);
            }
          });
        } else {
          console.log('Non-SIGNED_IN event, maintaining current state');
        }
      } else {
        setProfile(null);
        profileCacheRef.current = {}; // Clear cache on logout
        profileRequestQueueRef.current = null; // Clear pending requests
        // Reset development mode flags on logout
        if (isDevelopment) {
          authStabilizedRef.current = false;
          signedInEventCountRef.current = 0;
          stableUserRef.current = null;
        }
        if (mountedRef.current) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    authSubscription = subscription;
    
    // Start initialization
    console.log('🔧 About to call initializeAuth');
    initializeAuth();

    return () => {
      console.log('AuthProvider cleanup');
      mountedRef.current = false;
      initializingRef.current = false;
      profileLoadingRef.current = false;
      profileRequestQueueRef.current = null;
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      if (authStabilizationTimeoutRef.current) {
        clearTimeout(authStabilizationTimeoutRef.current);
      }
      
      // Reset development mode flags on cleanup
      if (isDevelopment) {
        authStabilizedRef.current = false;
        signedInEventCountRef.current = 0;
        stableUserRef.current = null;
      }
      
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array

  const computedLoading = loading || !initialized;
  
  const value = {
    user,
    profile,
    loading: computedLoading,
    authLoading: computedLoading,
    signOut,
    refreshProfile: () => refreshProfile(),
  };

  // Debug logging for loading state
  if (computedLoading !== !user || computedLoading) {
    console.log('🔍 AuthProvider state:', {
      loading,
      initialized,
      computedLoading,
      hasUser: !!user,
      hasProfile: !!profile
    });
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 