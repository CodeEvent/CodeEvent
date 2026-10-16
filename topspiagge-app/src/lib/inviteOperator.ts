import { supabase } from './supabase';

export type InviteOperatorResult = { ok: true } | { ok: false; error: string };

// Calls the invite-operator Edge Function (see supabase/functions/invite-operator/index.ts) --
// inviting staff needs the project's service_role key, which never ships in the client, so the
// actual invite + beach_operators insert happens server-side. This just forwards the request
// with the caller's own session so the function can verify they belong to this beach.
export async function inviteOperator(email: string, beachId: string): Promise<InviteOperatorResult> {
  if (!supabase) return { ok: false, error: 'Supabase non configurato in questo ambiente.' };
  const { data, error } = await supabase.functions.invoke('invite-operator', {
    body: { email, beachId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
