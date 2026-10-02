import { useEffect, useState } from 'react';
import { joinNames } from '@/lib/winners';
import type { Profile } from '@/types/firestore';

export function WinnerPopup({
  totalVotes,
  winnerUids,
  profiles,
  delayMs = 0,
}: {
  totalVotes: number;
  winnerUids: string[];
  profiles: Record<string, Profile>;
  /** Holds the pop-in back this long — used on a tie, so the wheel visibly breaks
   * apart first and the names are what it breaks open to reveal. */
  delayMs?: number;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const timer = setTimeout(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [delayMs]);

  let label: string;
  let name: string | null = null;
  if (totalVotes === 0) {
    label = 'No votes were cast';
  } else if (winnerUids.length === 1) {
    label = 'Star Player of the Week';
    name = profiles[winnerUids[0]!]?.name ?? 'Unknown';
  } else {
    label = `It's a ${winnerUids.length}-way tie — all Star Players of the Week!`;
    name = joinNames(
      winnerUids.map((u) => profiles[u]?.name ?? '?'),
      '&',
    );
  }
  // Three or more tied names in the full-size type won't fit the popup on a phone.
  const nameSize = winnerUids.length > 2 ? 'text-[clamp(18px,4.6vw,26px)]' : 'text-[clamp(22px,6vw,34px)]';

  return (
    // Static, in-flow below the wheel on narrow screens (so it never overlaps the
    // trophy hub/pointer there); only from `sm:` up does it become the classic
    // absolute-centered overlay, where there's enough room for it to sit on top.
    <div
      className={`relative z-[5] mx-auto mt-4 max-w-[92%] rounded-[20px] border-[3px] border-accent bg-bg-card px-6 py-4 text-center shadow-[0_12px_40px_rgba(10,10,10,0.35)] transition-[transform,opacity] duration-500 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] sm:absolute sm:left-1/2 sm:top-1/2 sm:mt-0 sm:max-w-[88%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-7 sm:py-5 ${
        shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0 sm:scale-0'
      }`}
    >
      <p className="m-0 mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent-ink">{label}</p>
      {name && (
        <p className={`m-0 ${nameSize} font-extrabold italic leading-[1.1] text-accent`}>{name}</p>
      )}
    </div>
  );
}
