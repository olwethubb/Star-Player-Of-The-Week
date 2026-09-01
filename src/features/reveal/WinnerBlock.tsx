import type { Profile, Settings } from '@/types/firestore';

/** Deliberately plain text, not a card — this used to be a glowing trophy graphic
 * with its own heading and subhead. The job here is just to state the outcome
 * clearly, not stage a moment; the reveal ceremony (the wheel, the confetti) is
 * where the moment already lives, right before this page ever renders. */
export function WinnerBlock({ settings, profiles }: { settings: Settings; profiles: Record<string, Profile> }) {
  const { totalVotes, winnerUids } = settings;

  if (totalVotes === 0) {
    return <p className="mb-6 text-base leading-relaxed text-text-muted">No votes were cast this week.</p>;
  }

  if (winnerUids.length === 1) {
    const winner = profiles[winnerUids[0]!];
    return (
      <p className="mb-6 text-base leading-relaxed text-text">
        🏆 <strong className="font-display font-semibold">{winner?.name ?? 'Unknown'}</strong> is the Star Player of
        the Week!
      </p>
    );
  }

  return (
    <p className="mb-6 text-base leading-relaxed text-text">
      It's a tie between{' '}
      <strong className="font-display font-semibold">
        {winnerUids.map((u) => profiles[u]?.name ?? '?').join(' and ')}
      </strong>
      . A runoff between just them starts automatically in a few seconds.
    </p>
  );
}
