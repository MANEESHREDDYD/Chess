import { describe, it, expect, beforeEach } from 'vitest';
import { audioEngine } from './audioEngine';

describe('audioEngine', () => {
  beforeEach(() => {
    // Clear out AudioContext if it somehow existed
    if (typeof window !== 'undefined') {
      (window as any).AudioContext = undefined;
      (window as any).webkitAudioContext = undefined;
    }
  });

  it('fails safely without crashing when AudioContext is missing', () => {
    expect(() => {
      audioEngine.playMoveSound({ theme: 'standard', volume: 0.5 });
    }).not.toThrow();

    expect(() => {
      audioEngine.playCaptureSound({ theme: 'mahabharata', volume: 1 });
    }).not.toThrow();
    
    expect(() => {
      audioEngine.playCheckSound({ theme: 'standard', volume: 0 });
    }).not.toThrow();

    expect(() => {
      audioEngine.playCheckmateSound({ theme: 'mahabharata', volume: 0.5 });
    }).not.toThrow();

    expect(() => {
      audioEngine.playPuzzleSuccessSound({ theme: 'standard', volume: 0.5 });
    }).not.toThrow();

    expect(() => {
      audioEngine.playPuzzleFailureSound({ theme: 'mahabharata', volume: 0.5 });
    }).not.toThrow();
    
    expect(() => {
      audioEngine.playStoryCompleteSound({ theme: 'standard', volume: 0.5 });
    }).not.toThrow();
  });
});
