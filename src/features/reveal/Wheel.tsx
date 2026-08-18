import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { IconTrophy } from '@/components/ui/Icons';
import type { Profile } from '@/types/firestore';

interface WheelProps {
  profiles: Record<string, Profile>;
  winnerUids: string[];
  totalVotes: number;
  children?: ReactNode;
}

const EXTRA_SPINS = 6;
const WHEEL_COLORS = ['var(--bg-card)', 'var(--bg-elevated)'];

/** The reveal wheel's rotation is set imperatively via refs, deliberately outside React
 * state. The wedges/labels are memoized from props that never change mid-spin, so no
 * unrelated re-render (a payout/balance snapshot landing mid-ceremony) ever touches this
 * subtree or resets the in-flight CSS transition. Making the rotation reactive would risk
 * exactly that regression — the bug this component exists to avoid (see commit e51256c). */
export function Wheel({ profiles, winnerUids, totalVotes, children }: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const names = useMemo(
    () => Object.entries(profiles).sort((a, b) => a[1].name.localeCompare(b[1].name)),
    [profiles],
  );
  const wedge = 360 / Math.max(names.length, 1);

  const bgStops = useMemo(
    () => names.map((_, i) => `${WHEEL_COLORS[i % 2]} ${i * wedge}deg ${(i + 1) * wedge}deg`).join(', '),
    [names, wedge],
  );

  const labelPositions = useMemo(
    () =>
      names.map((_, i) => {
        const mid = i * wedge + wedge / 2;
        const rad = ((mid - 90) * Math.PI) / 180;
        return { x: 50 + 38 * Math.cos(rad), y: 50 + 38 * Math.sin(rad) };
      }),
    [names, wedge],
  );

  const targetDeg = useMemo(() => {
    let deg = EXTRA_SPINS * 360;
    if (totalVotes > 0 && winnerUids.length > 0) {
      const idx = Math.max(0, names.findIndex(([uid]) => uid === winnerUids[0]));
      const mid = idx * wedge + wedge / 2;
      deg += 360 - mid;
    }
    return deg;
  }, [names, wedge, totalVotes, winnerUids]);

  // Two rAFs: the first lets the browser paint the wheel at rotate(0) first, so the
  // transition to targetDeg on the second frame is guaranteed to actually animate
  // instead of jumping straight there.
  useLayoutEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (wheelRef.current) wheelRef.current.style.transform = `rotate(${targetDeg}deg)`;
        // Labels are children of the wheel, so they'd otherwise spin along with it and
        // land sideways/upside-down for most possible landing angles. Counter-rotate
        // each one by the exact same amount, on the same transition, so it visually
        // cancels out and every name stays upright the whole time, not just at rest.
        labelRefs.current.forEach((el) => {
          if (el) el.style.transform = `translate(-50%,-50%) rotate(${-targetDeg}deg)`;
        });
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [targetDeg]);

  return (
    <div className="relative mx-auto mt-2 aspect-square w-[min(80vw,62vh,560px)]">
      <div
        className="absolute -top-2 left-1/2 z-[3] h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[28px] border-x-transparent border-t-accent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      />
      <div
        ref={wheelRef}
        className="absolute inset-0 overflow-hidden rounded-full border-[5px] border-accent shadow-card transition-transform duration-[5000ms] [transition-timing-function:cubic-bezier(.1,.7,.15,1)]"
        style={{ background: `conic-gradient(from 0deg, ${bgStops})` }}
      >
        {names.map(([uid, p], i) => (
          <span
            key={uid}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="absolute max-w-[30%] -translate-x-1/2 -translate-y-1/2 text-center font-display text-[clamp(10px,2.2vw,15px)] font-bold leading-tight text-text [text-shadow:0_1px_3px_rgba(0,0,0,.5)] transition-transform duration-[5000ms] [transition-timing-function:cubic-bezier(.1,.7,.15,1)]"
            style={{ left: `${labelPositions[i]?.x}%`, top: `${labelPositions[i]?.y}%` }}
          >
            {p.name}
          </span>
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 z-[2] flex min-h-14 min-w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-accent bg-bg-card text-accent shadow-card [width:22%] [height:22%]">
        <IconTrophy />
      </div>
      {children}
    </div>
  );
}
