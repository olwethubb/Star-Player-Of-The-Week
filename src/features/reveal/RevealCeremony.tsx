import { useEffect } from 'react';
import { speak } from '@/lib/speech';
import { useTtsPreference } from '@/hooks/useTtsPreference';
import type { Profile, Settings } from '@/types/firestore';
import type { CeremonyPhase } from '@/hooks/useRevealCeremony';
import { Countdown } from './Countdown';
import { DrumrollShell } from './DrumrollShell';
import { Wheel } from './Wheel';
import { WinnerPopup } from './WinnerPopup';
import { Sparks } from './Sparks';

function winnerAnnouncement(totalVotes: number, winnerUids: string[], profiles: Record<string, Profile>): string {
  if (totalVotes === 0) return 'No votes were cast this week.';
  if (winnerUids.length === 1) {
    const name = profiles[winnerUids[0]!]?.name ?? 'Unknown';
    return `And the Star Player of the Week is... ${name}!`;
  }
  const names = winnerUids.map((u) => profiles[u]?.name ?? '?').join(' and ');
  return `It's a tie, between ${names}!`;
}

export function RevealCeremony({
  phase,
  count,
  spinMs,
  settings,
  profiles,
}: {
  phase: CeremonyPhase;
  count: number;
  spinMs: number;
  settings: Settings;
  profiles: Record<string, Profile>;
}) {
  const [ttsEnabled] = useTtsPreference();

  useEffect(() => {
    if (phase !== 'landed' || !ttsEnabled) return;
    speak(winnerAnnouncement(settings.totalVotes, settings.winnerUids, profiles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ttsEnabled]);

  if (phase === 'countdown') return <Countdown count={count} />;

  return (
    <DrumrollShell>
      <p className="animate-pulse-fade mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Drum roll…
      </p>
      <h1 className="m-0 mb-6 max-w-[26ch] font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15]">
        Revealing the Star Player of the Week
      </h1>
      <Wheel profiles={profiles} winnerUids={settings.winnerUids} totalVotes={settings.totalVotes} spinMs={spinMs}>
        {phase === 'landed' && (
          <WinnerPopup totalVotes={settings.totalVotes} winnerUids={settings.winnerUids} profiles={profiles} />
        )}
      </Wheel>
      {phase === 'landed' && <Sparks />}
    </DrumrollShell>
  );
}
