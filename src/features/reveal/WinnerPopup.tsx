import { useEffect, useState } from 'react';
import type { Profile } from '@/types/firestore';

export function WinnerPopup({
  totalVotes,
  winnerUids,
  profiles,
}: {
  totalVotes: number;
  winnerUids: string[];
  profiles: Record<string, Profile>;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  let label: string;
  let name: string | null = null;
  if (totalVotes === 0) {
    label = 'No votes were cast';
  } else if (winnerUids.length === 1) {
    label = 'Star Worker of the Week';
    name = profiles[winnerUids[0]!]?.name ?? 'Unknown';
  } else {
    label = "It's a tie!";
    name = winnerUids.map((u) => profiles[u]?.name ?? '?').join(' & ');
  }

  return (
    <div
      className={`absolute left-1/2 top-1/2 z-[5] max-w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border-[3px] border-accent bg-bg-card px-7 py-5 text-center shadow-[0_12px_44px_rgba(0,0,0,.6)] transition-[transform,opacity] duration-500 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] ${
        shown ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
      }`}
    >
      <p className="m-0 mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{label}</p>
      {name && (
        <p className="m-0 font-serif text-[clamp(22px,6vw,34px)] font-bold italic text-text">{name}</p>
      )}
    </div>
  );
}
