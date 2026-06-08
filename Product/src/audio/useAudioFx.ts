import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { audioEngine } from './audioEngine';

export function useAudioFx(history: string[]) {
  const { audioEnabled, audioVolume, activeTheme } = useSettingsStore();
  const lastPlyCount = useRef(history.length);

  useEffect(() => {
    if (!audioEnabled) {
      lastPlyCount.current = history.length;
      return;
    }

    if (history.length > lastPlyCount.current) {
      const moveIndex = history.length - 1;
      const moveSan = history[moveIndex];
      
      const isCheckmate = moveSan.includes('#');
      const isCheck = !isCheckmate && moveSan.includes('+');
      const isCapture = moveSan.includes('x');

      const options = { volume: audioVolume, theme: activeTheme };

      if (isCheckmate) {
        audioEngine.playCheckmateSound(options);
      } else if (isCheck) {
        audioEngine.playCheckSound(options);
      } else if (isCapture) {
        audioEngine.playCaptureSound(options);
      } else {
        audioEngine.playMoveSound(options);
      }

      lastPlyCount.current = history.length;
    } else if (history.length < lastPlyCount.current) {
      // Handles undo or game reset smoothly
      lastPlyCount.current = history.length;
    }
  }, [history, audioEnabled, audioVolume, activeTheme]);
}
