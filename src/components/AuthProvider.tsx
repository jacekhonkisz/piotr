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
  const authStateHandlerRef = useRef<any>(null);

  const refreshProfile = useCallback(async (userToRefresh?: User) => {
    const currentUser = userToRefresh || user;
    if (!currentUser) {
      return;
    }

    // Prevent concurrent profile loads
    if (profileLoadingRef.current) {
      console.log('Profile already loading, skipping duplicate request');
      return;
    }

    // Check cache first (30 second cache)
    const cacheKey = currentUser.id;
    const cached = profileCacheRef.current[cacheKey];
    const cacheTime = performance.now();
    
    if (cached && (cacheTime - (cached as any)._cacheTime) < 30000) {
      console.log('Using cached profile - setting loading to false');
      if (mountedRef.current) {
        setProfile(cached);
        setLoading(false); // Ensure loading is set to false when using cache
        setInitialized(true); // Ensure initialized is set to true
        console.log('✅ Auth state updated: loading=false, initialized=true, profile=loaded');
      }
      profileLoadingRef.current = false; // Important: Reset profile loading flag
      return cached; // Return the cached profile
    }

    profileLoadingRef.current = true;
    console.log('Loading profile for user:', currentUser.email);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('Profile loading timed out after 3 seconds');
    }, 3000); // Reduced to 3 seconds

    try {
      const profile = await Promise.race([
        getCurrentProfile(),
        new Promise<null>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Profile loading timeout'));
          });
        })
      ]);
      
      clearTimeout(timeoutId);
      
      if (profile) {
        // Cache the profile with timestamp
        (profile as any)._cacheTime = performance.now();
        profileCacheRef.current[cacheKey] = profile;
      }
      
      if (mountedRef.current) {
        setProfile(profile);
        setLoading(false); // Ensure loading is set to false when profile is loaded
        setInitialized(true); // Ensure initialized is set to true
        console.log('Profile loaded successfully');
      }
      profileLoadingRef.current = false; // Reset profile loading flag
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error loading profile:', error);
      
      // On timeout or error, still set loading to false to prevent infinite loading
      if (mountedRef.current) {
        setProfile(null);
        setLoading(false); // Ensure loading is set to false on error
        setInitialized(true); // Ensure initialized is set to true
      }
      profileLoadingRef.current = false; // Reset profile loading flag
    } finally {
      profileLoadingRef.current = false;
    }
  }, [user]);

  const signOut = async () => {
    try {
      // Clear cache and local state
      profileCacheRef.current = {};
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
          setTimeout(() => reject(new Error('Session timeout')), 2000);
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
            // Load profile but don't wait for it to complete initialization
            refreshProfile(sessionUser).finally(() => {
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

    // Set up auth state change listener with debouncing
    const handleAuthStateChange = async (event: string, session: any) => {
      const currentTime = Date.now();
      const eventKey = `${event}_${session?.user?.id || 'null'}`;
      
      // Prevent duplicate rapid-fire events (common with hot reload)
      // Skip TOKEN_REFRESHED events entirely as they don't require profile reloads
      if (event === 'TOKEN_REFRESHED') {
        console.log('Skipping TOKEN_REFRESHED event');
        return;
      }
      
      // Skip duplicate SIGNED_IN events within 2 seconds
      if (lastAuthEventRef.current === eventKey) {
        console.log('Skipping duplicate auth event:', event);
        return;
      }
      
      lastAuthEventRef.current = eventKey;
      console.log('Auth state changed:', event, 'user:', !!session?.user);
      
      if (!mountedRef.current) return;
      
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      
      if (sessionUser) {
        // Only refresh profile on true sign-in events, not token refreshes
        if (event === 'SIGNED_IN') {
          console.log('Processing SIGNED_IN event');
          // Always call refreshProfile - it will handle cache internally and set loading states
          refreshProfile(sessionUser).then((loadedProfile) => {
            console.log('Profile refresh completed, profile loaded:', !!loadedProfile);
            // refreshProfile handles loading state internally, don't override here
          }).catch((error) => {
            console.error('Profile refresh failed:', error);
            if (mountedRef.current) {
              setLoading(false);
              setInitialized(true);
            }
          });
        } else {
          console.log('Non-SIGNED_IN event, maintaining current state');
          // For other events, don't change loading state
        }
      } else {
        setProfile(null);
        profileCacheRef.current = {}; // Clear cache on logout
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