// Metro only inlines EXPO_PUBLIC_* when accessed as a literal `process.env.NAME`.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Web only: `?demo=patient|family|join` in the URL switches demo mode on for that page load. */
function demoFromUrl(): boolean {
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search;
    const kind = search ? new URLSearchParams(search).get('demo') : null;
    return kind === 'patient' || kind === 'family' || kind === 'join';
  } catch {
    return false;
  }
}

/**
 * Demo mode = in-memory fixtures instead of Supabase (offline demos, design reviews, screenshots).
 * On via EXPO_PUBLIC_DEMO=1 at build time, or `?demo=patient|family` at runtime in ANY web build.
 * Demo never reads or writes the real stored session (see session.ts).
 */
export const demo = process.env.EXPO_PUBLIC_DEMO === '1' || demoFromUrl();

export const config = { supabaseUrl: url ?? '', supabaseAnonKey: anonKey ?? '' };

/** Names (never values) of required settings that are absent. */
export const missingSettings: string[] = demo
  ? []
  : [
      ...(url ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
      ...(anonKey ? [] : ['EXPO_PUBLIC_SUPABASE_ANON_KEY']),
    ];
