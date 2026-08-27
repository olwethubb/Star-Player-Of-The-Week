// Synthesized entirely via the Web Audio API — no audio file to source, license,
// or ship. A short ascending major-chord arpeggio, the same shape as a game's
// "reward" jingle. Silently no-ops where unsupported (same posture as speech.ts).

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx ??= new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

const NOTES_HZ = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

export function playChime(): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    audioCtx.resume?.();
    const start = audioCtx.currentTime;
    NOTES_HZ.forEach((freq, i) => {
      const noteStart = start + i * 0.11;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.7);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.75);
    });
  } catch (e) {
    console.warn('Chime playback unavailable:', e);
  }
}
