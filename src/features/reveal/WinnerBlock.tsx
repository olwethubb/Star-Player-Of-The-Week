import { IconTrophy, IconWallet } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { BONUS_AMOUNT } from '@/lib/constants';
import type { Profile, Settings } from '@/types/firestore';

function TrophyHeader() {
  return (
    <div className="relative mb-3.5 inline-flex h-[76px] w-[76px] items-center justify-center">
      <div className="animate-glow-pulse absolute -inset-2 rounded-full bg-[radial-gradient(circle,var(--accent-glow-35),transparent_70%)]" />
      <div className="relative text-accent">
        <IconTrophy />
      </div>
    </div>
  );
}

export function WinnerBlock({
  settings,
  profiles,
}: {
  settings: Settings;
  profiles: Record<string, Profile>;
}) {
  const { totalVotes, winnerUids } = settings;

  if (totalVotes === 0) {
    return (
      <EmptyState icon={<IconTrophy width={18} height={18} />}>No votes were cast this week.</EmptyState>
    );
  }

  if (winnerUids.length === 1) {
    const winner = profiles[winnerUids[0]!];
    return (
      <div className="mb-[26px] animate-reveal-in rounded-[20px] border border-border bg-bg-card px-5 py-[34px] text-center shadow-card">
        <TrophyHeader />
        <p className="m-0 mb-1.5 font-display text-[clamp(22px,6vw,32px)] font-bold [overflow-wrap:anywhere]">
          {winner?.name ?? 'Unknown'}
        </p>
        <p className="m-0 font-mono text-xs uppercase tracking-[0.05em] text-text-muted">Star Player of the Week</p>
        <p className="mt-3.5 inline-flex items-center gap-1.5 font-mono text-sm font-bold text-accent">
          <IconWallet /> + B${BONUS_AMOUNT} awarded
        </p>
      </div>
    );
  }

  return (
    <div className="mb-[26px] animate-reveal-in rounded-[20px] border border-border bg-bg-card px-5 py-[34px] text-center shadow-card">
      <TrophyHeader />
      <p className="m-0 mb-1.5 font-display text-[clamp(22px,6vw,32px)] font-bold">It's a tie</p>
      <p className="m-0 mb-3.5 font-mono text-xs uppercase tracking-[0.05em] text-text-muted [overflow-wrap:anywhere]">
        {winnerUids.map((u) => profiles[u]?.name ?? '?').join(' · ')}
      </p>
      <p className="m-0 text-sm text-text-muted">A runoff between just these players starts automatically in a few seconds.</p>
    </div>
  );
}
