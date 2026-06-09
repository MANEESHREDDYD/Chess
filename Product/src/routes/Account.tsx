import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import {
  initializeAuth,
  onAuthStateChange,
  signInWithEmail,
  verifyOtp,
  signOut,
  linkCurrentPlayer,
  unlinkPlayer,
  getAccountLinks,
  isAuthConfigured
} from '../auth/authService';
import type { AuthState } from '../auth/authTypes';
import type { AccountLinkRecord } from '../data/db';

export function Account() {
  const { activePlayer } = usePlayerStore();
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [waitingForOtp, setWaitingForOtp] = useState(false);
  const [linkStatus, setLinkStatus] = useState<AccountLinkRecord | null>(null);

  useEffect(() => {
    // Initialize Auth (safe if missing env vars)
    initializeAuth();

    const unsubscribe = onAuthStateChange((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Check linkage status whenever auth or player changes
    async function checkLink() {
      if (authState.status === 'signed_in' && authState.user && activePlayer) {
        const links = await getAccountLinks();
        const activeLink = links.find(
          (l) =>
            l.player_id === activePlayer.id &&
            l.cloud_user_id === authState.user!.id &&
            l.status === 'linked'
        );
        setLinkStatus(activeLink || null);
      } else {
        setLinkStatus(null);
      }
    }
    checkLink();
  }, [authState, activePlayer]);

  const handleSignInRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Requesting sign-in link...');
    const { error } = await signInWithEmail(email);
    if (error) {
      setMessage(`Error: ${error}`);
    } else {
      setMessage('Check your email for the login code or magic link.');
      setWaitingForOtp(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Verifying code...');
    const { error } = await verifyOtp(email, otp);
    if (error) {
      setMessage(`Error: ${error}`);
    } else {
      setMessage('Signed in successfully.');
      setWaitingForOtp(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      setMessage(`Error signing out: ${error}`);
    } else {
      setMessage('Signed out.');
      setEmail('');
      setOtp('');
      setWaitingForOtp(false);
    }
  };

  const handleLink = async () => {
    if (!activePlayer) return;
    setMessage('Linking profile...');
    const { error } = await linkCurrentPlayer(activePlayer.id);
    if (error) {
      setMessage(`Error linking: ${error}`);
    } else {
      setMessage('Profile linked to cloud account.');
      // Update link state manually or trigger re-check
      const links = await getAccountLinks();
      const activeLink = links.find(
        (l) =>
          l.player_id === activePlayer.id &&
          l.cloud_user_id === authState.user!.id &&
          l.status === 'linked'
      );
      setLinkStatus(activeLink || null);
    }
  };

  const handleUnlink = async () => {
    if (!activePlayer) return;
    setMessage('Unlinking profile...');
    const { error } = await unlinkPlayer(activePlayer.id);
    if (error) {
      setMessage(`Error unlinking: ${error}`);
    } else {
      setMessage('Profile unlinked.');
      setLinkStatus(null);
    }
  };

  return (
    <div className="layout-container account-page">
      <header className="app-header">
        <h1>Cloud Account (Beta)</h1>
      </header>

      <main className="main-content" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        
        <section className="privacy-card" style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <h3>Privacy & Sync Guarantees</h3>
          <ul style={{ lineHeight: '1.6', marginTop: '1rem', color: 'var(--text-secondary)' }}>
            <li><strong>MIRROR works fully without an account.</strong></li>
            <li>Signing in only links your local profile for future sync.</li>
            <li>This milestone does <strong>not</strong> upload your games, analysis, story progress, puzzle history, StyleVector, or achievements.</li>
          </ul>
        </section>

        {!isAuthConfigured() && (
          <div className="alert alert-warning" style={{ padding: '1rem', background: '#ffcc0033', color: '#ddaa00', borderRadius: '8px' }}>
            <strong>Cloud sign-in not configured.</strong>
            <p>Missing Supabase environment variables. MIRROR continues to run safely in local-only mode.</p>
          </div>
        )}

        {isAuthConfigured() && authState.status === 'signed_out' && (
          <section className="auth-form-card">
            <h2>Sign In</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Enter your email to receive a secure login code.</p>
            
            {!waitingForOtp ? (
              <form onSubmit={handleSignInRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="email" 
                  required 
                  placeholder="player@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
                <button type="submit" className="btn btn-primary">Send Magic Code</button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="text" 
                  required 
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                />
                <button type="submit" className="btn btn-primary">Verify Code</button>
                <button type="button" className="btn btn-text" onClick={() => setWaitingForOtp(false)}>Back</button>
              </form>
            )}
            
            {message && <p style={{ marginTop: '1rem', color: 'var(--accent-color)' }}>{message}</p>}
          </section>
        )}

        {authState.status === 'signed_in' && authState.user && (
          <section className="auth-dashboard">
            <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '8px' }}>
              <h2>Signed In</h2>
              <p>Email: <strong>{authState.user.email}</strong></p>
              
              <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                <h3>Local Profile Link</h3>
                {!activePlayer ? (
                  <p style={{ color: 'var(--error-color)', marginTop: '0.5rem' }}>No active local player. Please create a profile in the main menu before linking.</p>
                ) : (
                  <>
                    <p style={{ margin: '1rem 0' }}>Current Profile: <strong>{activePlayer.display_name}</strong></p>
                    {linkStatus ? (
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--success-color)' }}>✓ Linked</span>
                        <button className="btn btn-outline" onClick={handleUnlink}>Unlink Profile</button>
                      </div>
                    ) : (
                      <button className="btn btn-primary" onClick={handleLink}>Link Local Profile</button>
                    )}
                  </>
                )}
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button className="btn btn-text" onClick={handleSignOut}>Sign Out</button>
              </div>

              {message && <p style={{ marginTop: '1rem', color: 'var(--accent-color)' }}>{message}</p>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
