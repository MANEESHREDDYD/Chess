import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthState, AuthUser } from './authTypes';
import { openMirrorDb, type AccountLinkRecord } from '../data/db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabase: SupabaseClient | null = null;
let currentAuthUser: AuthUser | undefined = undefined;
let authListeners: ((state: AuthState) => void)[] = [];

function notifyListeners(state: AuthState) {
  authListeners.forEach(listener => listener(state));
}

function mapSupabaseUser(user: User | null): AuthUser | undefined {
  if (!user) return undefined;
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  };
}

export function initializeAuth(): AuthState {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase auth is not configured. MIRROR will run locally.");
    return { status: 'signed_out' };
  }

  if (!supabase) {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Initialize synchronously where possible, handle async session fetching
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          notifyListeners({ status: 'error', error: error.message });
        } else {
          currentAuthUser = mapSupabaseUser(session?.user ?? null);
          notifyListeners({
            status: currentAuthUser ? 'signed_in' : 'signed_out',
            user: currentAuthUser
          });
        }
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        currentAuthUser = mapSupabaseUser(session?.user ?? null);
        notifyListeners({
          status: currentAuthUser ? 'signed_in' : 'signed_out',
          user: currentAuthUser
        });
      });
    } catch (e) {
      console.error("Failed to initialize Supabase:", e);
      return { status: 'error', error: 'Failed to initialize Supabase.' };
    }
  }
  
  return { status: 'loading' };
}

export function getCurrentAuthUser(): AuthUser | undefined {
  return currentAuthUser;
}

export function isAuthConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Cloud sign-in not configured." };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Magic link redirect not strictly needed for OTP flow if using verifyOtp,
      // but good if they click the magic link email.
      // We will encourage the OTP token verification in the UI.
    }
  });

  return { error: error ? error.message : null };
}

export async function verifyOtp(email: string, token: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Cloud sign-in not configured." };

  const { error, data } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  if (data.session?.user) {
    currentAuthUser = mapSupabaseUser(data.session.user);
  }

  return { error: error ? error.message : null };
}

export async function signOut(): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  if (!error) {
    currentAuthUser = undefined;
  }
  return { error: error ? error.message : null };
}

export function onAuthStateChange(callback: (state: AuthState) => void): () => void {
  authListeners.push(callback);
  // trigger immediately
  callback({
    status: isAuthConfigured() ? (currentAuthUser ? 'signed_in' : 'loading') : 'signed_out',
    user: currentAuthUser
  });
  
  return () => {
    authListeners = authListeners.filter(l => l !== callback);
  };
}

// -----------------------------------------------------------------------------
// Account Linking
// -----------------------------------------------------------------------------

export async function linkCurrentPlayer(playerId: string): Promise<{ error: string | null }> {
  if (!currentAuthUser) return { error: "Must be signed in to link profile." };
  
  const db = await openMirrorDb();
  const tx = db.transaction('account_links', 'readwrite');
  const store = tx.objectStore('account_links');

  const linkId = `${playerId}:supabase:${currentAuthUser.id}`;
  const existing = await store.get(linkId);

  const now = new Date().toISOString();

  if (existing) {
    existing.status = 'linked';
    existing.updated_at = now;
    await store.put(existing);
  } else {
    await store.put({
      id: linkId,
      player_id: playerId,
      provider: 'supabase',
      cloud_user_id: currentAuthUser.id,
      email: currentAuthUser.email,
      linked_at: now,
      updated_at: now,
      status: 'linked'
    });
  }

  await tx.done;
  return { error: null };
}

export async function unlinkPlayer(playerId: string): Promise<{ error: string | null }> {
  if (!currentAuthUser) return { error: "Must be signed in to unlink profile." };
  
  const db = await openMirrorDb();
  const tx = db.transaction('account_links', 'readwrite');
  const store = tx.objectStore('account_links');

  const linkId = `${playerId}:supabase:${currentAuthUser.id}`;
  const existing = await store.get(linkId);

  if (existing) {
    existing.status = 'unlinked';
    existing.updated_at = new Date().toISOString();
    await store.put(existing);
  }

  await tx.done;
  return { error: null };
}

export async function getAccountLinks(): Promise<AccountLinkRecord[]> {
  const db = await openMirrorDb();
  return db.getAll('account_links');
}
