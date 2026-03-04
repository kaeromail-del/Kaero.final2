import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';

/** Admin client — uses service_role key, bypasses RLS. Server-side only. */
let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _adminClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

/** Anon client — public access only. */
let _anonClient: SupabaseClient | null = null;

export function getSupabaseAnon(): SupabaseClient {
  if (!_anonClient) {
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    _anonClient = createClient(config.supabase.url, config.supabase.anonKey);
  }
  return _anonClient;
}

export const STORAGE_BUCKET = 'listings';
