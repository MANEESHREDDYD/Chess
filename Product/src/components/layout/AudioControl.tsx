import { NovaPopover } from '../ui/NovaPopover';
import { NovaButton } from '../ui/NovaButton';
import { VolumeIcon, MuteIcon } from '../ui/icons';

type AudioControlProps = {
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
};

export function AudioControl({
  audioEnabled,
  setAudioEnabled,
  audioVolume,
  setAudioVolume,
}: AudioControlProps) {
  return (
    <NovaPopover
      align="right"
      ariaLabel="Sound settings"
      panelRole="dialog"
      panelClassName="nova-audio-panel"
      renderTrigger={({ triggerProps }) => (
        <button
          type="button"
          className="nova-trigger nova-trigger--icon"
          data-popover-trigger
          aria-label={audioEnabled ? 'Sound on' : 'Sound off'}
          aria-pressed={audioEnabled}
          {...triggerProps}
        >
          <span className="nova-trigger__icon">
            {audioEnabled ? <VolumeIcon size={18} /> : <MuteIcon size={18} />}
          </span>
        </button>
      )}
    >
      {() => (
        <div className="nova-audio-panel__body">
          <div className="nova-audio-panel__row">
            <span className="nova-audio-panel__label">Sound effects</span>
            <NovaButton
              size="sm"
              variant={audioEnabled ? 'selected' : 'ghost'}
              onClick={() => setAudioEnabled(!audioEnabled)}
              aria-pressed={audioEnabled}
            >
              {audioEnabled ? 'On' : 'Off'}
            </NovaButton>
          </div>
          <label className="nova-audio-panel__volume">
            <span className="nova-audio-panel__label">Volume</span>
            <input
              className="nova-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioVolume}
              disabled={!audioEnabled}
              onChange={(event) => setAudioVolume(parseFloat(event.target.value))}
              aria-label="Audio volume"
            />
          </label>
        </div>
      )}
    </NovaPopover>
  );
}
