import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ActiveTheme = 'standard' | string;

interface SettingsState {
  activeTheme: ActiveTheme;
  setActiveTheme: (themeId: ActiveTheme) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeTheme: 'standard',
      setActiveTheme: (themeId) => set({ activeTheme: themeId }),
      audioEnabled: false,
      setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
      audioVolume: 0.5,
      setAudioVolume: (volume) => set({ audioVolume: volume }),
    }),
    {
      name: 'mirror-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        activeTheme: state.activeTheme,
        audioEnabled: state.audioEnabled,
        audioVolume: state.audioVolume
      }),
    }
  )
);