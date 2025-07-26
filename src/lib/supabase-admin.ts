import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Server-side only admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Server-side helper functions
export const createUserProfile = async (userId: string, profileData: any) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert([{ id: userId, ...profileData }])
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }

  return data;
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }

  return data;
};

export const deleteUserProfile = async (userId: string) => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
}; 