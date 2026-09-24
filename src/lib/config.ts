// Metro only inlines EXPO_PUBLIC_* when accessed as a literal `process.env.NAME`.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** EXPO_PUBLIC_DEMO=1: in-memory fixtures instead of Supabase (offline demos, screenshots). Never set in production. */
export const demo = process.env.EXPO_PUBLIC_DEMO === '1';

export const config = { supabaseUrl: url ?? '', supabaseAnonKey: anonKey ?? '' };

/** Names (never values) of required settings that are absent. */
export const missingSettings: string[] = demo
  ? []
  : [
      ...(url ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
      ...(anonKey ? [] : ['EXPO_PUBLIC_SUPABASE_ANON_KEY']),
    ];
