import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ActiveTheme = 'standard' | string;

interface SettingsState {
  activeTheme: ActiveTheme;
  setActiveTheme: (themeId: ActiveTheme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeTheme: 'standard',
      setActiveTheme: (themeId) => set({ activeTheme: themeId }),
    }),
    {
      name: 'mirror-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeTheme: state.activeTheme }),
    }
  )
);