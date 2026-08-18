import { DrumrollShell } from './DrumrollShell';

export function Countdown({ count }: { count: number }) {
  return (
    <DrumrollShell>
      <p className="animate-pulse-fade mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Drum roll…
      </p>
      <h1 className="m-0 mb-6 max-w-[26ch] font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        Revealing the Star Worker of the Week
      </h1>
      <div
        className="animate-pulse-fade mt-[18px] font-display text-[clamp(64px,18vw,140px)] font-bold leading-none text-accent"
        aria-live="polite"
        role="status"
      >
        {count}
      </div>
    </DrumrollShell>
  );
}
