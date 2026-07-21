import { createClient } from '@supabase/supabase-js';

// Public, client-embeddable values: real access control lives in Postgres Row Level Security
// policies (see supabase/schema.sql), not in keeping this key secret. Read from EXPO_PUBLIC_*
// env vars so Metro inlines them at build time (see .env.example) -- when they're absent (e.g.
// local dev without a .env, or the Claude Artifact preview, which cannot reach any external host
// at all under its CSP) the app falls back to the fully local in-memory/AsyncStorage mode it
// always used, instead of crashing.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: { persistSession: false },
    })
  : null;
