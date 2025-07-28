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
  
  // Use refs to prevent race conditions
  const mountedRef = useRef(true);
  const profileLoadingRef = useRef(false);
  const initializingRef = useRef(false);

  const refreshProfile = useCallback(async (userToRefresh?: User) => {
    const currentUser = userToRefresh || user;
    if (!currentUser) {
      console.log('refreshProfile: No user provided');
      return;
    }

    // Prevent concurrent profile loads
    if (profileLoadingRef.current) {
      console.log('refreshProfile: Already loading profile, skipping');
      return;
    }

    profileLoadingRef.current = true;
    console.log('Refreshing profile for user:', currentUser.email, 'ID:', currentUser.id);
    
    try {
      const profile = await getCurrentProfile();
      console.log('Profile loaded successfully:', profile);
      
      if (mountedRef.current) {
        setProfile(profile);
        console.log('Profile state updated successfully');
      } else {
        console.log('Component unmounted, not updating profile state');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      
      if (mountedRef.current) {
        setProfile(null);
        console.log('Profile state set to null due to error');
      }
    } finally {
      profileLoadingRef.current = false;
      console.log('Profile loading finished');
    }
  }, [user]);

  // Add a timeout fallback for profile loading
  const refreshProfileWithTimeout = useCallback(async (userToRefresh?: User) => {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Profile refresh timeout')), 8000);
    });

    try {
      await Promise.race([refreshProfile(userToRefresh), timeoutPromise]);
    } catch (error) {
      console.error('Profile refresh timed out, setting loading to false:', error);
      if (mountedRef.current) {
        setLoading(false);
        setInitialized(true);
      }
    }
  }, [refreshProfile]);

  const signOut = async () => {
    try {
      // Clear local state first
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
        console.log('Already initializing auth, skipping');
        return;
      }
      
      initializingRef.current = true;
      
      try {
        console.log('Initializing authentication...');
        
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
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
            console.log('User found in session:', sessionUser.email);
            await refreshProfileWithTimeout(sessionUser);
          } else {
            console.log('No user in session');
            setProfile(null);
          }
          
          // Always set loading to false and initialized to true after processing
          setLoading(false);
          setInitialized(true);
          console.log('Auth initialization completed');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mountedRef.current) {
          setLoading(false);
          setInitialized(true);
        }
      } finally {
        initializingRef.current = false;
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (!mountedRef.current) {
        console.log('Component unmounted, ignoring auth state change');
        return;
      }
      
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      
      if (sessionUser) {
        console.log('User session found, loading profile...');
        await refreshProfileWithTimeout(sessionUser);
      } else {
        console.log('No user session, clearing profile');
        setProfile(null);
      }
      
      // Ensure loading is always set to false after auth state change
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
  }, []); // Empty dependency array to run only once

  const value = {
    user,
    profile,
    loading: loading && !initialized, // Only loading if not initialized
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