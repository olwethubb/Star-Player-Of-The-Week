import { useEffect } from 'react';
import { speak } from '@/lib/speech';
import { playChime } from '@/lib/chime';
import { useTtsPreference } from '@/hooks/useTtsPreference';
import { joinNames } from '@/lib/winners';
import { REVEAL_TIE_BREAK_MS } from '@/lib/constants';
import type { Profile, Settings } from '@/types/firestore';
import type { CeremonyPhase } from '@/hooks/useRevealCeremony';
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
  const names = joinNames(
    winnerUids.map((u) => profiles[u]?.name ?? '?'),
    'and',
  );
  return `It's a tie, between ${names} — they're all Star Players of the Week!`;
}

export function RevealCeremony({
  phase,
  spinMs,
  settings,
  profiles,
}: {
  phase: CeremonyPhase;
  spinMs: number;
  settings: Settings;
  profiles: Record<string, Profile>;
}) {
  const [ttsEnabled] = useTtsPreference();
  // On a tie the wheel cracks apart first (see Wheel), and only then do the names,
  // confetti and announcement land — "spun, broke, revealed", in that order.
  const isTie = settings.totalVotes > 0 && settings.winnerUids.length > 1;
  const revealDelayMs = isTie ? REVEAL_TIE_BREAK_MS : 0;

  useEffect(() => {
    if (phase !== 'landed' || !ttsEnabled) return;
    const timer = setTimeout(() => {
      playChime();
      speak(winnerAnnouncement(settings.totalVotes, settings.winnerUids, profiles));
    }, revealDelayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ttsEnabled]);

  return (
    <DrumrollShell>
      <p className="animate-pulse-fade mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink">
        Drum roll…
      </p>
      <h1 className="m-0 mb-6 max-w-[26ch] text-[clamp(24px,6vw,34px)] font-extrabold leading-[1.05] tracking-[-0.02em]">
        Revealing the Star Player <em className="text-accent italic">of the Week</em>
      </h1>
      <Wheel
        profiles={profiles}
        winnerUids={settings.winnerUids}
        totalVotes={settings.totalVotes}
        spinMs={spinMs}
        landed={phase === 'landed'}
      >
        {phase === 'landed' && (
          <WinnerPopup
            totalVotes={settings.totalVotes}
            winnerUids={settings.winnerUids}
            profiles={profiles}
            delayMs={revealDelayMs}
          />
        )}
      </Wheel>
      {phase === 'landed' && <Sparks delayMs={revealDelayMs} />}
    </DrumrollShell>
  );
}
