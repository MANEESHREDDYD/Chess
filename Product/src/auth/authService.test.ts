import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeAuth, isAuthConfigured, signInWithEmail, signOut, linkCurrentPlayer } from './authService';

// We mock the DB and Supabase
vi.mock('../data/db', () => ({
  openMirrorDb: vi.fn(),
}));

describe('authService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Default mock behavior for import.meta.env
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  });

  it('safely handles missing environment variables', () => {
    // Both env vars are missing
    const state = initializeAuth();
    expect(state.status).toBe('signed_out');
    expect(isAuthConfigured()).toBe(false);
  });

  it('signInWithEmail returns error when unconfigured', async () => {
    const { error } = await signInWithEmail('test@example.com');
    expect(error).toBe('Cloud sign-in not configured.');
  });

  it('signOut does not crash when unconfigured', async () => {
    const { error } = await signOut();
    expect(error).toBeNull();
  });

  it('linkCurrentPlayer returns error when not signed in', async () => {
    const { error } = await linkCurrentPlayer('player-123');
    expect(error).toBe('Must be signed in to link profile.');
  });
});
