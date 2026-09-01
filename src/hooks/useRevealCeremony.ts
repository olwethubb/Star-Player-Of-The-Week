import { useEffect, useRef, useState } from 'react';
import { REVEAL_POPUP_HOLD_MS, REVEAL_SPIN_MS, REVEAL_SPIN_MS_REDUCED } from '@/lib/constants';
import { prefersReducedMotion } from '@/lib/motion';

export type CeremonyPhase = 'spinning' | 'landed';

interface CeremonyState {
  pending: boolean;
  phase: CeremonyPhase | null;
  /** How long the wheel's spin (visually) and this hook's "spinning" phase (timing)
   * both last — shorter under prefers-reduced-motion, decided once per ceremony. */
  spinMs: number;
}

/** The reveal ceremony: the moment ANY client sees `revealed` flip to true for the
 * first time, it starts an identical fixed-length sequence (spin, hold on the landed
 * winner) before the full results page shows. This runs for everyone immediately,
 * synchronized purely by everyone's Firestore listener observing the same
 * false→true transition within milliseconds of each other — no shared clock.
 *
 * A late joiner who opens the app after the flip skips straight to the static results
 * page instead of replaying the ceremony, via the firstSnapshotSeen guard below.
 *
 * `resetKey` should change on every identity switch (an auth "epoch" counter, not
 * just uid — the same browser claiming a name again still counts as a fresh session).
 * Without this, someone who releases a name, misses a reveal happening elsewhere,
 * then claims again would incorrectly replay the full ceremony instead of landing
 * straight on results. */
export function useRevealCeremony(revealed: boolean, loadedSettings: boolean, resetKey: unknown): CeremonyState {
  const [state, setState] = useState<CeremonyState>({
    pending: false,
    phase: null,
    spinMs: REVEAL_SPIN_MS,
  });
  const firstSnapshotSeen = useRef(false);
  const lastRevealed = useRef(false);
  const pendingRef = useRef(false);
  const lastResetKey = useRef(resetKey);

  useEffect(() => {
    if (!loadedSettings) return;
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey;
      firstSnapshotSeen.current = false;
      pendingRef.current = false;
    }
    if (!firstSnapshotSeen.current) {
      firstSnapshotSeen.current = true;
      lastRevealed.current = revealed;
      return;
    }
    const startCeremony = revealed && !lastRevealed.current && !pendingRef.current;
    lastRevealed.current = revealed;

    if (startCeremony) {
      pendingRef.current = true;
      const spinMs = prefersReducedMotion() ? REVEAL_SPIN_MS_REDUCED : REVEAL_SPIN_MS;
      setState({ pending: true, phase: 'spinning', spinMs });

      const spinTimer = setTimeout(() => {
        setState((prev) => ({ ...prev, phase: 'landed' }));
        const holdTimer = setTimeout(() => {
          pendingRef.current = false;
          setState({ pending: false, phase: null, spinMs: REVEAL_SPIN_MS });
        }, REVEAL_POPUP_HOLD_MS);
        return () => clearTimeout(holdTimer);
      }, spinMs);

      return () => {
        clearTimeout(spinTimer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, loadedSettings, resetKey]);

  return state;
}
