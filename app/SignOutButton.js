'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../lib/supabaseBrowser';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      style={{
        fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--line)',
        background: 'var(--surface)', color: 'var(--muted)', padding: '7px 12px',
      }}
    >
      Sign out
    </button>
  );
}
