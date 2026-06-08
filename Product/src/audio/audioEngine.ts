let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext && !(window as any).webkitAudioContext) {
    return null; // Safe fallback for non-browser or unsupported environments
  }
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new Ctx();
    } catch (e) {
      console.warn('Web Audio API not supported or failed to initialize.', e);
      return null;
    }
  }
  // Resume if suspended (browser auto-play policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.warn('Failed to resume AudioContext', e));
  }
  return audioCtx;
}

interface AudioOptions {
  volume: number;
  theme: 'standard' | 'mahabharata' | string;
}

// Internal helper for procedural sound generation
function playTone(
  freqs: number[], 
  type: OscillatorType, 
  duration: number, 
  vol: number,
  options: { decay?: boolean; attack?: number; pitchBend?: number } = {}
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const masterGain = ctx.createGain();
  masterGain.gain.value = vol;
  masterGain.connect(ctx.destination);

  const t = ctx.currentTime;
  
  freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (options.pitchBend) {
      osc.frequency.exponentialRampToValueAtTime(freq * options.pitchBend, t + duration);
    }

    // Envelope
    oscGain.gain.setValueAtTime(0, t);
    
    const attack = options.attack || 0.02;
    oscGain.gain.linearRampToValueAtTime(1, t + attack);
    
    if (options.decay) {
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    } else {
      oscGain.gain.setValueAtTime(1, t + duration - 0.05);
      oscGain.gain.linearRampToValueAtTime(0, t + duration);
    }

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(t);
    osc.stop(t + duration);
  });
}

export const audioEngine = {
  playMoveSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([110, 165], 'triangle', 0.15, options.volume * 0.7, { decay: true, attack: 0.01 });
    } else {
      playTone([440], 'sine', 0.1, options.volume * 0.4, { decay: true, attack: 0.01 });
    }
  },

  playCaptureSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      // Lower, duller thud
      playTone([80, 120, 160], 'sawtooth', 0.2, options.volume * 0.6, { decay: true, attack: 0.01, pitchBend: 0.5 });
    } else {
      playTone([440, 554], 'square', 0.15, options.volume * 0.2, { decay: true, attack: 0.01 });
    }
  },

  playCheckSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([150, 200], 'square', 0.4, options.volume * 0.5, { decay: true, attack: 0.05, pitchBend: 1.2 });
    } else {
      playTone([660], 'sine', 0.3, options.volume * 0.5, { decay: false, attack: 0.05 });
    }
  },

  playCheckmateSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([80, 100, 120], 'sawtooth', 0.8, options.volume * 0.8, { decay: true, attack: 0.05, pitchBend: 0.2 });
    } else {
      // Minor chord drop
      playTone([440, 523, 659], 'square', 0.6, options.volume * 0.3, { decay: true, attack: 0.05, pitchBend: 0.5 });
    }
  },

  playPuzzleSuccessSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([220, 330, 440], 'triangle', 0.5, options.volume * 0.6, { decay: true, attack: 0.02, pitchBend: 1.1 });
    } else {
      playTone([523, 659, 784, 1046], 'sine', 0.4, options.volume * 0.4, { decay: true, attack: 0.05 });
    }
  },

  playPuzzleFailureSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([90, 95], 'sawtooth', 0.3, options.volume * 0.6, { decay: true, attack: 0.05, pitchBend: 0.8 });
    } else {
      playTone([300, 250], 'square', 0.3, options.volume * 0.2, { decay: true, attack: 0.05, pitchBend: 0.8 });
    }
  },

  playStoryCompleteSound(options: AudioOptions) {
    if (options.theme === 'mahabharata') {
      playTone([110, 165, 220, 330], 'triangle', 1.5, options.volume * 0.7, { decay: true, attack: 0.1 });
    } else {
      playTone([440, 554, 659, 880], 'sine', 1.2, options.volume * 0.4, { decay: true, attack: 0.1 });
    }
  }
};
