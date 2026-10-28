'use client';
import { useState } from 'react';
import { supabaseBrowser } from '../../lib/supabaseBrowser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function sendLink(e) {
    e.preventDefault();
    setError('');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // provisioned accounts only — no open self-signup
      },
    });
    if (error) {
      setError(
        error.message?.toLowerCase().includes('signup')
          ? "That email hasn't been registered by your teacher yet."
          : error.message
      );
    } else {
      setSent(true);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Vocab Drill</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Sign in with the email your teacher registered for you.
      </p>
      {sent ? (
        <p style={{ fontSize: 14 }}>
          Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={sendLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)',
              background: 'var(--surface)', color: 'var(--ink)', fontSize: 15,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 14px', borderRadius: 9, border: '1px solid var(--accent)',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14,
            }}
          >
            Send sign-in link
          </button>
          {error && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
