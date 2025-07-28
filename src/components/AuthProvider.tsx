'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentProfile, type AuthState } from '../lib/auth';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
      console.log('Using cached profile');
      if (mountedRef.current) {
        setProfile(cached);
      }
      return;
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
        console.log('Profile loaded successfully');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error loading profile:', error);
      
      // On timeout or error, still set loading to false to prevent infinite loading
      if (mountedRef.current) {
        setProfile(null);
      }
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
    mountedRef.current = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (initializingRef.current) {
        return;
      }
      
      initializingRef.current = true;
      
      try {
        console.log('Initializing auth...');
        
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
            // Don't await profile loading to speed up initial render
            refreshProfile(sessionUser);
          } else {
            console.log('No user in session');
            setProfile(null);
          }
          
          // Set loading to false immediately to show UI
          setLoading(false);
          setInitialized(true);
          console.log('Auth initialized');
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

    // Set up auth state change listener (simplified)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (!mountedRef.current) return;
      
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      
      if (sessionUser) {
        // Don't await to keep UI responsive
        refreshProfile(sessionUser);
      } else {
        setProfile(null);
        profileCacheRef.current = {}; // Clear cache on logout
      }
      
      if (mountedRef.current) {
        setLoading(false);
        setInitialized(true);
      }
    });

    authSubscription = subscription;
    
    // Start initialization
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

  const value = {
    user,
    profile,
    loading: loading && !initialized,
    authLoading: loading && !initialized,
    signOut,
    refreshProfile: () => refreshProfile(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 