// Supabase Edge Function (Deno). Deploy with: supabase functions deploy invite-operator
//
// Invites a new staff member into an existing beach. This can't be done from the client
// directly: Supabase's admin.inviteUserByEmail requires the project's service_role key, which
// must never be shipped in the app bundle (unlike the anon key, it bypasses every RLS policy).
// So the client calls this function with its normal user session, the function checks that
// caller is actually an operator of the target beach using their own JWT (never trusting the
// beachId alone), and only then uses the service-role key -- kept in this function's own env,
// configured via `supabase secrets set` -- to send the invite and add the new membership row.
//
// Required project secrets (set once via the Supabase CLI or dashboard):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (SUPABASE_URL/ANON_KEY are already available to every Edge Function by default; only the
// service role key needs to be set explicitly, since it's not injected automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  let email: string, beachId: string;
  try {
    const body = await req.json();
    email = body.email;
    beachId = body.beachId;
    if (!email || !beachId) throw new Error('email and beachId are required');
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
  }

  // Client scoped to the CALLER's own session -- used only to verify who they are and that
  // they actually belong to this beach, via the same RLS every other request goes through.
  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const { data: membership, error: membershipError } = await callerClient
    .from('beach_operators')
    .select('beach_id')
    .eq('beach_id', beachId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return new Response(JSON.stringify({ error: 'You are not an operator of this beach' }), { status: 403 });
  }

  // Only past this point do we touch the service-role key, and only to act on the beachId
  // already verified above -- never on a beachId taken from the request body alone.
  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? 'Invite failed' }), { status: 400 });
  }

  const { error: insertError } = await adminClient
    .from('beach_operators')
    .insert({ beach_id: beachId, user_id: invited.user.id, role: 'staff' });
  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
