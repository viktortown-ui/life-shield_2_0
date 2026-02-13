export type CosmosSfxTone = 'select' | 'menuOpen' | 'confirm' | 'cancel';

interface SfxNote {
  frequency: number;
  wave: OscillatorType;
  durationMs: number;
  gain: number;
}

const NOTES: Record<CosmosSfxTone, SfxNote[]> = {
  select: [{ frequency: 540, wave: 'sine', durationMs: 56, gain: 0.18 }],
  menuOpen: [
    { frequency: 460, wave: 'triangle', durationMs: 48, gain: 0.16 },
    { frequency: 660, wave: 'sine', durationMs: 72, gain: 0.12 }
  ],
  confirm: [
    { frequency: 520, wave: 'triangle', durationMs: 52, gain: 0.16 },
    { frequency: 820, wave: 'sine', durationMs: 96, gain: 0.2 }
  ],
  cancel: [{ frequency: 320, wave: 'sawtooth', durationMs: 72, gain: 0.1 }]
};

const ATTACK_S = 0.008;
const RELEASE_S = 0.08;

export const createCosmosSfxEngine = () => {
  let context: AudioContext | null = null;
  let unlocked = false;

  const canUseAudio = () =>
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined';

  const ensureContext = () => {
    if (!canUseAudio()) {
      return null;
    }
    if (!context) {
      context = new window.AudioContext();
    }
    return context;
  };

  const unlock = async () => {
    const audioContext = ensureContext();
    if (!audioContext) return false;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    unlocked = audioContext.state === 'running';
    return unlocked;
  };

  const play = (tone: CosmosSfxTone, volume: number) => {
    if (!unlocked || volume <= 0) return;
    const audioContext = ensureContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    NOTES[tone].forEach((note, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const noteStart = now + index * 0.04;
      const noteDuration = Math.max(0.03, note.durationMs / 1000);
      const noteEnd = noteStart + noteDuration;
      const peak = note.gain * normalizedVolume;

      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);

      gainNode.gain.setValueAtTime(0.0001, noteStart);
      gainNode.gain.linearRampToValueAtTime(peak, noteStart + ATTACK_S);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd + RELEASE_S);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(noteStart);
      oscillator.stop(noteEnd + RELEASE_S + 0.01);
    });
  };

  return {
    unlock,
    play,
    isUnlocked: () => unlocked
  };
};
