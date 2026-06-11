import { cx } from '../components/ui/classNames';
import type { BoardRenderMode } from './useBattlefieldSettings';

type BattlefieldControlsProps = {
  mode: BoardRenderMode;
  setMode: (mode: BoardRenderMode) => void;
  webGlAvailable: boolean;
};

/**
 * 2D / 3D board mode segmented toggle. Keyboard accessible; 3D is disabled
 * (with a reason) when WebGL is unavailable.
 */
export function BattlefieldControls({ mode, setMode, webGlAvailable }: BattlefieldControlsProps) {
  return (
    <div className="battlefield-toggle" role="group" aria-label="Board rendering mode" data-qa="board-mode-toggle">
      <button
        type="button"
        className={cx('battlefield-toggle__btn', mode === '2d' && 'is-active')}
        aria-pressed={mode === '2d'}
        onClick={() => setMode('2d')}
      >
        2D
      </button>
      <button
        type="button"
        className={cx('battlefield-toggle__btn', mode === '3d' && 'is-active')}
        aria-pressed={mode === '3d'}
        disabled={!webGlAvailable}
        title={webGlAvailable ? 'Kurukshetra battlefield (procedural preview)' : '3D requires WebGL'}
        onClick={() => setMode('3d')}
      >
        3D
      </button>
    </div>
  );
}
