// Metro only inlines EXPO_PUBLIC_* when accessed as a literal `process.env.NAME`.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const config = { supabaseUrl: url ?? '', supabaseAnonKey: anonKey ?? '' };

/** Names (never values) of required settings that are absent. */
export const missingSettings: string[] = [
  ...(url ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
  ...(anonKey ? [] : ['EXPO_PUBLIC_SUPABASE_ANON_KEY']),
];
