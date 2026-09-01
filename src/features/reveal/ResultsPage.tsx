import { Suspense } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { LazyManageTeamPanel } from '@/features/team-admin/ManageTeamPanel.lazy';
import { VotingProgress } from '@/features/voting/VotingProgress';
import { useSession } from '@/hooks/useSession';
import { WinnerBlock } from './WinnerBlock';

export function ResultsPage() {
  const { me, profiles, claims, settings, voters, isHost, canManageTeam } = useSession();

  if (!me) return null;

  const total = settings.totalVotes || 0;

  return (
    <>
      <TopBar me={me} />
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Results</p>
      <h1 className="m-0 mb-5 font-serif text-[clamp(22px,5vw,30px)] font-bold italic leading-[1.15]">
        {total} vote{total === 1 ? '' : 's'} cast this week
      </h1>

      <WinnerBlock settings={settings} profiles={profiles} />

      {/* Turnout only, never a per-candidate breakdown — how many of the claimed
          names voted, not who they voted for or how the count split between
          candidates. */}
      {isHost && (
        <VotingProgress voters={voters} weekKey={settings.currentWeek} eligibleCount={Object.keys(claims).length - 1} />
      )}

      {isHost && (
        <p className="mb-5 text-xs text-text-muted">Voting reopens automatically on Friday, when the new week starts.</p>
      )}
      <Suspense fallback={null}>{canManageTeam && <LazyManageTeamPanel />}</Suspense>
    </>
  );
}
