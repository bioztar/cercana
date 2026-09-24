import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, missingSettings } from './config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (missingSettings.length > 0) {
    throw new Error(`Missing setting: ${missingSettings.join(', ')}`);
  }
  if (!client) {
    // No auth in the demo: the anon key is the only credential.
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
