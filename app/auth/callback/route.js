import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabaseServer';

// Handles the magic-link redirect: exchanges the code for a session,
// then routes the person to the right place based on their role.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/drill';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set(name, value, options) { cookieStore.set({ name, value, ...options }); },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.user) {
      // Use the admin (service_role) client for this lookup, not the
      // just-created user session — querying an RLS-protected table on the
      // same client in the same request right after exchangeCodeForSession
      // can race the auth context and silently return zero rows.
      const { data: profile, error } = await supabaseAdmin()
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      if (error) {
        console.error('auth/callback: profile lookup failed', error);
      }
      if (profile?.role === 'teacher') {
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
