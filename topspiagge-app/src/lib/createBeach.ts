import { supabase } from './supabase';

// Keeps slugs URL-safe and collision-obvious: two owners typing "Bagno Mare" both get
// "bagno-mare" and the second one's signup fails on the unique constraint with a clear
// "already taken" error, rather than silently colliding on id.
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'lido'
  );
}

export type CreateBeachResult =
  | { ok: true; needsEmailConfirmation: boolean; beachId: string }
  | { ok: false; error: string };

// Self-service beach signup: creates the Supabase Auth account, then calls the
// create_beach_and_become_owner Postgres function (see supabase/schema.sql) which atomically
// inserts the beaches row and makes this user its first operator -- see that function's
// comment for why this can't just be two plain client-side inserts.
export async function createBeach(opts: {
  beachName: string;
  slug: string;
  email: string;
  password: string;
}): Promise<CreateBeachResult> {
  if (!supabase) return { ok: false, error: 'Supabase non configurato in questo ambiente.' };

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
  });
  if (signUpError) return { ok: false, error: signUpError.message };
  if (!signUpData.user) return { ok: false, error: 'Registrazione non riuscita.' };

  if (!signUpData.session) {
    // Email confirmation is required by this Supabase project's auth settings -- there's no
    // authenticated session yet, so create_beach_and_become_owner (which relies on auth.uid())
    // can't run until they confirm and log in.
    return { ok: true, needsEmailConfirmation: true, beachId: '' };
  }

  const { data: beachId, error: rpcError } = await supabase.rpc('create_beach_and_become_owner', {
    beach_name: opts.beachName,
    beach_slug: opts.slug,
  });
  if (rpcError) {
    return {
      ok: false,
      error: rpcError.message.includes('duplicate') ? 'Questo nome è già in uso, scegline un altro.' : rpcError.message,
    };
  }

  return { ok: true, needsEmailConfirmation: false, beachId: beachId as string };
}
