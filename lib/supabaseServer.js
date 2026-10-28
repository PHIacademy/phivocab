import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Used inside Server Components / Route Handlers. Reads the session from
// cookies set by the browser client after login.
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // called from a Server Component where cookies are read-only;
            // middleware.js is what actually refreshes the session cookie
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (e) {}
        },
      },
    }
  );
}

// Admin client — service_role key, bypasses RLS. Server-only, never import
// this from a Client Component. Used by provisioning and the teacher
// dashboard's account-creation route.
export function supabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
