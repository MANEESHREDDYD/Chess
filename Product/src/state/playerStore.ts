import { create } from 'zustand';
import { PlayerRecord, getLocalPlayer } from '../data/db';

interface PlayerState {
  activePlayerId: string | null;
  activePlayer: PlayerRecord | null;
  
  setActivePlayer: (playerId: string) => Promise<void>;
  loadActivePlayer: () => Promise<void>;
  clearActivePlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activePlayerId: null,
  activePlayer: null,

  setActivePlayer: async (playerId: string) => {
    const player = await getLocalPlayer(playerId);
    if (player) {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('mirror_active_player_id', player.id);
      }
      set({ activePlayerId: player.id, activePlayer: player });
    }
  },

  loadActivePlayer: async () => {
    const storedId = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('mirror_active_player_id') : null;
    if (storedId) {
      const player = await getLocalPlayer(storedId);
      if (player) {
        set({ activePlayerId: player.id, activePlayer: player });
        return;
      }
    }
    // If no active player is found, we do NOT auto-create one here.
    // That is the job of the onboarding route.
    set({ activePlayerId: null, activePlayer: null });
  },

  clearActivePlayer: () => {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem('mirror_active_player_id');
    }
    set({ activePlayerId: null, activePlayer: null });
  }
}));
