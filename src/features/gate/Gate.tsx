import { useEffect, useState } from 'react';
import { getWeekLabel } from '@/lib/week';
import { BONUS_AMOUNT } from '@/lib/constants';
import { getRememberedCredential } from '@/lib/deviceCredential';
import { login } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { GateActions, GateBody, GateEyebrow, GateHeading, GateLink, GateLinks, GateShell } from './GateShell';

export function Gate({ onVote, onSignup }: { onVote: () => void; onSignup: () => void }) {
  // Best-effort silent sign-in from a credential the browser remembered on a
  // previous visit — on a supported platform this is what a Face/Touch ID prompt
  // gates. Falls straight through to the normal gate if there's nothing stored,
  // the platform doesn't support it, or the stored credential no longer works.
  const [trying, setTrying] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRememberedCredential()
      .then((cred) => {
        if (cancelled || !cred) return;
        return login(cred.email, cred.secret).catch(() => {});
      })
      .finally(() => {
        if (!cancelled) setTrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (trying) {
    return (
      <GateShell>
        <Spinner label="Signing you in" />
      </GateShell>
    );
  }

  return (
    <GateShell
      brand={
        <>
          <GateEyebrow>{getWeekLabel()}</GateEyebrow>
          <GateHeading>Star Player of the Week</GateHeading>
          <GateBody>
            Vote for the teammate who went above and beyond this week. The winner takes home B${BONUS_AMOUNT} in
            Blacfox Dollars.
          </GateBody>
        </>
      }
    >
      <p className="m-0 mb-1.5 text-center font-display text-lg font-bold text-text">Ready to vote?</p>
      <p className="m-0 mb-6 text-center text-sm leading-relaxed text-text-muted">
        Sign in with your Blacfox email to cast this week's vote.
      </p>
      <GateActions>
        <Button variant="gate" onClick={onVote}>
          Vote Now
        </Button>
      </GateActions>
      <GateLinks>
        <GateLink onClick={onSignup}>New here? Create an account</GateLink>
      </GateLinks>
    </GateShell>
  );
}
