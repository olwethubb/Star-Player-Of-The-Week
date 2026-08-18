import { useEffect, useState } from 'react';
import type { Profile } from '@/types/firestore';

function ScoreRow({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-display font-semibold [overflow-wrap:anywhere]">{name}</span>
        <span className="whitespace-nowrap font-mono text-xs text-text-muted">
          {count} vote{count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-border-soft bg-bg-elevated">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 [transition-timing-function:cubic-bezier(.16,1,.3,1)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Only admins ever see the per-person breakdown — everyone else just sees the winner. */
export function Scoreboard({ profiles, tally, total }: { profiles: Record<string, Profile>; tally: Record<string, number>; total: number }) {
  return (
    <div className="mb-[26px]">
      {Object.entries(profiles).map(([uid, p]) => (
        <ScoreRow key={uid} name={p.name} count={tally[uid] || 0} total={total} />
      ))}
    </div>
  );
}
